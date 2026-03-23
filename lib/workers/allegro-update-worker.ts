import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { parse } from 'csv-parse';
import { createReadStream, unlink } from 'fs';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { AllegroUploadJobData, ALLEGRO_UPLOAD_QUEUE_NAME, workerOptions, redisConnection } from '@/lib/workers/queue';
import { executeWorkerJob, formatFileSize, setupWorkerEventHandlers } from '@/lib/workers/worker-utils';
import {
    AllegroProduct,
    parseAllegroRow,
    processAllegroProductBatch,
    estimateRowCount
} from '@/lib/workers/allegro-utils';
import Redis from 'ioredis';

const unlinkAsync = promisify(unlink);

const redis = new Redis(redisConnection);

interface WorkerState {
    processedGtins: Set<string>;
    totalProcessed: number;
    totalSkipped: number;
    totalIgnored: number;
    skippedGtins: string[];
}

export const allegroUploadWorker = new Worker<AllegroUploadJobData>(
    ALLEGRO_UPLOAD_QUEUE_NAME,
    async (job: Job<AllegroUploadJobData>) => {
        return executeWorkerJob(job, 'allegro-upload', async (job, logger) => {
            const { filePath, fileName, fileSize } = job.data;
            const stateKey = `allegro-upload:state:${job.id}`;

            await logger.updateProgress(5);
            await logger.log(`Processing file: ${fileName} (${formatFileSize(fileSize)})`);

            // Проверяем, есть ли продукты в базе ПЕРЕД началом обработки
            const productsCount = await prisma.product.count();
            if (productsCount === 0) {
                await logger.log('⚠️ WARNING: No products found in database!');
                await logger.log('Please download products from Qogita first before uploading Allegro data.');

                try {
                    await unlinkAsync(filePath);
                } catch (cleanupError) {
                    console.error('[Allegro Upload Worker] Failed to cleanup file:', cleanupError);
                }

                throw new Error('No products in database. Please download products from Qogita first.');
            }
            await logger.log(`Found ${productsCount} products in database`);

            // Проверяем есть ли сохраненное состояние
            const savedStateStr = await redis.get(stateKey);
            let state: WorkerState;
            let isResume = false;

            if (savedStateStr) {
                const parsed = JSON.parse(savedStateStr);
                state = {
                    processedGtins: new Set(parsed.processedGtins),
                    totalProcessed: parsed.totalProcessed,
                    totalSkipped: parsed.totalSkipped,
                    totalIgnored: parsed.totalIgnored,
                    skippedGtins: parsed.skippedGtins || []
                };
                isResume = true;
                await logger.log(`🔄 Resuming from saved state: ${state.totalProcessed} products already processed`);
            } else {
                state = {
                    processedGtins: new Set(),
                    totalProcessed: 0,
                    totalSkipped: 0,
                    totalIgnored: 0,
                    skippedGtins: []
                };
            }

            // Создаем stream из файла - настоящий streaming!
            const stream = createReadStream(filePath, { encoding: 'utf-8' });

            // Парсер CSV
            const parser = stream.pipe(
                parse({
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                })
            );

            let batch: AllegroProduct[] = [];
            let totalRows = 0;
            const batchSize = 100;

            // Оценка строк по первым N строкам
            let estimatedRows = 0;
            let bytesRead = 0;
            let sampleSize = 0;
            const SAMPLE_ROWS = 10;

            await logger.updateProgress(10);

            try {
                // Удаляем все предыдущие записи только при первом запуске
                if (!isResume) {
                    await logger.log('Clearing existing Allegro products from database...');
                    const deletedCount = await prisma.productAllegro.deleteMany({});
                    await logger.log(`Deleted ${deletedCount.count} existing Allegro products`);
                }
                await logger.updateProgress(15);

                // Обрабатываем построчно из файла
                for await (const row of parser) {
                    totalRows++;

                    // Собираем статистику по первым строкам для оценки
                    if (sampleSize < SAMPLE_ROWS) {
                        const rowSize = JSON.stringify(row).length;
                        bytesRead += rowSize;
                        sampleSize++;

                        if (sampleSize === SAMPLE_ROWS) {
                            const estimation = estimateRowCount(SAMPLE_ROWS, bytesRead, fileSize);
                            estimatedRows = estimation.estimatedRows;
                            await logger.log(`Estimated ~${estimatedRows} rows based on first ${SAMPLE_ROWS} rows (avg ${estimation.avgBytesPerRow.toFixed(0)} bytes/row)`);
                        }
                    }

                    const product = parseAllegroRow(row);
                    if (!product) {
                        state.totalIgnored++;
                        continue;
                    }

                    // Пропускаем уже обработанные продукты
                    if (state.processedGtins.has(product.gtin)) {
                        continue;
                    }

                    batch.push(product);

                    // Когда набрали батч - обрабатываем
                    if (batch.length >= batchSize) {
                        const result = await processAllegroProductBatch(batch);
                        state.totalProcessed += result.processed;
                        state.totalSkipped += result.skipped;
                        state.skippedGtins.push(...result.skippedGtins);

                        // Обновляем прогресс только если есть оценка
                        if (estimatedRows > 0) {
                            const progress = 15 + Math.floor((state.totalProcessed / estimatedRows) * 80);
                            await logger.updateProgress(Math.min(progress, 95));
                        }
                        if (state.totalSkipped > 0) {
                            await logger.log(`Processed ${state.totalProcessed} products, skipped ${state.totalSkipped} (GTIN not found in Qogita products), ignored ${state.totalIgnored} rows`);
                        } else {
                            await logger.log(`Processed ${state.totalProcessed} products, ignored ${state.totalIgnored} rows`);
                        }

                        batch = [];
                    }
                }

                // Обрабатываем остаток
                if (batch.length > 0) {
                    const result = await processAllegroProductBatch(batch);
                    state.totalProcessed += result.processed;
                    state.totalSkipped += result.skipped;
                    state.skippedGtins.push(...result.skippedGtins);
                }

                await logger.updateProgress(100);

                if (state.totalSkipped > 0) {
                    await logger.log(`⚠️ Successfully processed ${state.totalProcessed} products from ${totalRows} rows`);
                    await logger.log(`⚠️ Skipped ${state.totalSkipped} products - GTIN not found in Qogita products database`);
                    await logger.log(`Ignored ${state.totalIgnored} invalid rows`);

                    // Выводим список пропущенных GTIN только в терминал
                    console.log(`[Allegro Upload Worker] --- Skipped GTINs (${state.skippedGtins.length}) ---`);
                    for (const gtin of state.skippedGtins) {
                        console.log(`[Allegro Upload Worker]   ${gtin}`);
                    }
                } else {
                    await logger.log(`✅ Successfully processed ${state.totalProcessed} products from ${totalRows} rows (${state.totalIgnored} ignored)`);
                }

                // Удаляем файл после обработки
                await unlinkAsync(filePath);
                await logger.log(`Cleaned up temporary file`);

                return {
                    success: true,
                    count: state.totalProcessed,
                    totalRows,
                    ignoredRows: state.totalIgnored,
                    skippedRows: state.totalSkipped,
                    fileName
                };
            } catch (error) {
                // Удаляем файл только если он существует и это не ошибка валидации
                const isValidationError = error instanceof Error &&
                    error.message.includes('No products in database');

                if (!isValidationError) {
                    try {
                        await unlinkAsync(filePath);
                        await logger.log('Cleaned up temporary file after error');
                    } catch (cleanupError) {
                        console.error('[Allegro Upload Worker] Failed to cleanup file:', cleanupError);
                    }
                } else {
                    try {
                        await unlinkAsync(filePath);
                        await logger.log('Cleaned up temporary file');
                    } catch (cleanupError) {
                        console.error('[Allegro Upload Worker] Failed to cleanup file:', cleanupError);
                    }
                }

                throw error;
            }
        });
    },
    workerOptions
);

setupWorkerEventHandlers(allegroUploadWorker, 'Allegro Upload Worker');
