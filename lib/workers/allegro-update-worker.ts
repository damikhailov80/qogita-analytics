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
    rejectionStats: Record<string, number>;
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
                    skippedGtins: parsed.skippedGtins || [],
                    rejectionStats: parsed.rejectionStats || {}
                };
                isResume = true;
                await logger.log(`🔄 Resuming from saved state: ${state.totalProcessed} products already processed`);
            } else {
                state = {
                    processedGtins: new Set(),
                    totalProcessed: 0,
                    totalSkipped: 0,
                    totalIgnored: 0,
                    skippedGtins: [],
                    rejectionStats: {}
                };
            }

            // Создаем stream из файла - настоящий streaming!
            const stream = createReadStream(filePath, { encoding: 'utf-8' });

            // Определяем разделитель из первой строки
            let delimiter = ';';
            const firstChunk = await new Promise<string>((resolve) => {
                const tempStream = createReadStream(filePath, { encoding: 'utf-8' });
                let data = '';
                tempStream.on('data', (chunk) => {
                    data += chunk;
                    if (data.includes('\n')) {
                        tempStream.destroy();
                        resolve(data.split('\n')[0]);
                    }
                });
                tempStream.on('end', () => resolve(data));
            });

            // Подсчитываем количество разделителей в первой строке
            const semicolonCount = (firstChunk.match(/;/g) || []).length;
            const commaCount = (firstChunk.match(/,/g) || []).length;

            if (commaCount > semicolonCount) {
                delimiter = ',';
                await logger.log(`Detected CSV delimiter: comma (,)`);
            } else {
                await logger.log(`Detected CSV delimiter: semicolon (;)`);
            }

            // Парсер CSV
            const parser = stream.pipe(
                parse({
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                    delimiter: delimiter,
                    relax_column_count: true,
                    quote: '"',
                    escape: '"'
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
                // Оборачиваем обработку в Promise для корректной обработки ошибок парсера
                await new Promise<void>((resolve, reject) => {
                    // Обработка ошибок парсинга и stream
                    parser.on('error', (error) => {
                        stream.destroy();
                        reject(error);
                    });

                    stream.on('error', (error) => {
                        reject(error);
                    });

                    // Обрабатываем построчно из файла
                    (async () => {
                        try {
                            // Удаляем все предыдущие записи только при первом запуске
                            if (!isResume) {
                                await logger.log('Clearing existing Allegro products from database...');
                                const deletedCount = await prisma.productAllegro.deleteMany({});
                                await logger.log(`Deleted ${deletedCount.count} existing Allegro products`);

                                await logger.log('Clearing Allegro worker logs and states...');
                                await prisma.workerLog.deleteMany({
                                    where: { workerType: 'allegro-upload' }
                                });
                                await prisma.workerState.deleteMany({
                                    where: { workerType: 'allegro-upload' }
                                });
                            }
                            await logger.updateProgress(15);

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

                                const parseResult = parseAllegroRow(row);
                                if (!parseResult.product) {
                                    state.totalIgnored++;
                                    if (parseResult.rejectionReason) {
                                        state.rejectionStats[parseResult.rejectionReason] =
                                            (state.rejectionStats[parseResult.rejectionReason] || 0) + 1;
                                    }
                                    continue;
                                }

                                const product = parseResult.product;

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

                            // Формируем читаемые названия для причин отклонения
                            const reasonLabels: Record<string, string> = {
                                'missing_fields': 'Missing required fields (GTIN, traffic, or price)',
                                'invalid_traffic': 'Invalid traffic format',
                                'invalid_sellers_count': 'Invalid sellers count format',
                                'sellers_out_of_range': `Sellers count out of range (${process.env.ALLEGRO_MIN_SELLERS || '2'}-${process.env.ALLEGRO_MAX_SELLERS || '500'})`,
                                'traffic_out_of_range': `Traffic out of range (${process.env.ALLEGRO_MIN_TRAFFIC || '50'}-${process.env.ALLEGRO_MAX_TRAFFIC || '99999'})`,
                                'invalid_price': 'Invalid price format',
                                'price_out_of_range': `Price out of range (€${process.env.ALLEGRO_MIN_PRICE || '0'}-€${process.env.ALLEGRO_MAX_PRICE || '500'})`
                            };

                            await logger.log(`\n📊 Processing Summary:`);
                            await logger.log(`✅ Successfully processed: ${state.totalProcessed} products`);
                            await logger.log(`📋 Total rows in file: ${totalRows}`);

                            if (state.totalSkipped > 0) {
                                await logger.log(`⚠️ Skipped (GTIN not in Qogita DB): ${state.totalSkipped} products`);
                            }

                            if (state.totalIgnored > 0) {
                                await logger.log(`\n❌ Ignored rows: ${state.totalIgnored}`);
                                await logger.log(`Breakdown by rejection reason:`);

                                for (const [reason, count] of Object.entries(state.rejectionStats)) {
                                    const label = reasonLabels[reason] || reason;
                                    await logger.log(`  • ${label}: ${count}`);
                                }
                            }

                            if (state.totalSkipped > 0) {
                                // Выводим список пропущенных GTIN только в терминал
                                console.log(`\n[Allegro Upload Worker] --- Skipped GTINs (${state.skippedGtins.length}) ---`);
                                for (const gtin of state.skippedGtins) {
                                    console.log(`[Allegro Upload Worker]   ${gtin}`);
                                }
                            }

                            // Резолвим Promise только после всех логов
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    })();
                });

                // Удаляем файл после успешной обработки
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
                const errorMessage = error instanceof Error ? error.message : String(error);
                await logger.log(`❌ CSV parsing error: ${errorMessage}`);

                // Удаляем файл после ошибки
                try {
                    await unlinkAsync(filePath);
                    await logger.log('Cleaned up temporary file after error');
                } catch (cleanupError) {
                    console.error('[Allegro Upload Worker] Failed to cleanup file:', cleanupError);
                }

                // Пробрасываем ошибку дальше, чтобы job был помечен как failed
                throw error;
            }
        });
    },
    workerOptions
);

setupWorkerEventHandlers(allegroUploadWorker, 'Allegro Upload Worker');
