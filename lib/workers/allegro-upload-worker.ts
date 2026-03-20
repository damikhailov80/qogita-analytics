import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { parse } from 'csv-parse';
import { createReadStream, unlink } from 'fs';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { AllegroUploadJobData, ALLEGRO_UPLOAD_QUEUE_NAME, redisConnection } from '@/lib/queue';

const unlinkAsync = promisify(unlink);

interface AllegroProduct {
    gtin: string;
    salesQuantity: number;
    price: number;
}

function parseRow(row: Record<string, string>): AllegroProduct | null {
    const gtin = row['GTIN'] || row['gtin'] || '';
    const traffic = row['traffic'] || '';
    const priceNetto = row['price_netto'] || '';

    if (!gtin || !traffic || !priceNetto) return null;

    // Извлекаем число из traffic (например "2 osoby" -> 2)
    const trafficMatch = traffic.match(/^\d+/);
    if (!trafficMatch) {
        // Если traffic не начинается с числа - пропускаем строку
        return null;
    }
    const salesQuantity = parseInt(trafficMatch[0]);

    // Извлекаем число из price_netto (например "80,49 zł" -> 80.49)
    const priceMatch = priceNetto.match(/[\d,]+/);
    if (!priceMatch) return null;

    // Заменяем запятую на точку для парсинга
    const price = parseFloat(priceMatch[0].replace(',', '.'));

    if (isNaN(salesQuantity) || isNaN(price)) return null;

    return {
        gtin,
        salesQuantity,
        price
    };
}

async function processBatch(batch: AllegroProduct[]): Promise<void> {
    await Promise.all(
        batch.map(product =>
            prisma.productAllegro.upsert({
                where: { gtin: product.gtin },
                update: {
                    salesQuantity: product.salesQuantity,
                    price: product.price
                },
                create: {
                    gtin: product.gtin,
                    salesQuantity: product.salesQuantity,
                    price: product.price
                }
            })
        )
    );
}

export const allegroUploadWorker = new Worker<AllegroUploadJobData>(
    ALLEGRO_UPLOAD_QUEUE_NAME,
    async (job: Job<AllegroUploadJobData>) => {
        const { filePath, fileName, fileSize } = job.data;

        await job.updateProgress(5);
        await job.log(`Processing file: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

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
        let totalProcessed = 0;
        let totalRows = 0;
        let totalIgnored = 0;
        const batchSize = 100;

        // Оценка строк по первым N строкам
        let estimatedRows = 0;
        let bytesRead = 0;
        let sampleSize = 0;
        const SAMPLE_ROWS = 10;

        await job.updateProgress(10);

        try {
            // Удаляем все предыдущие записи перед началом обработки
            await job.log('Clearing existing products from database...');
            const deletedCount = await prisma.productAllegro.deleteMany({});
            await job.log(`Deleted ${deletedCount.count} existing products`);
            await job.updateProgress(15);

            // Обрабатываем построчно из файла
            for await (const row of parser) {
                totalRows++;

                // Собираем статистику по первым строкам для оценки
                if (sampleSize < SAMPLE_ROWS) {
                    const rowSize = JSON.stringify(row).length;
                    bytesRead += rowSize;
                    sampleSize++;

                    if (sampleSize === SAMPLE_ROWS) {
                        const avgBytesPerRow = bytesRead / SAMPLE_ROWS;
                        estimatedRows = Math.floor(fileSize / avgBytesPerRow);
                        await job.log(`Estimated ~${estimatedRows} rows based on first ${SAMPLE_ROWS} rows (avg ${avgBytesPerRow.toFixed(0)} bytes/row)`);
                    }
                }

                const product = parseRow(row);
                if (!product) {
                    totalIgnored++;
                    continue;
                }

                batch.push(product);

                // Когда набрали батч - обрабатываем
                if (batch.length >= batchSize) {
                    await processBatch(batch);
                    totalProcessed += batch.length;

                    // Обновляем прогресс только если есть оценка
                    if (estimatedRows > 0) {
                        const progress = 15 + Math.floor((totalProcessed / estimatedRows) * 80);
                        await job.updateProgress(Math.min(progress, 95));
                    }
                    await job.log(`Processed ${totalProcessed} products, ignored ${totalIgnored} rows`);

                    batch = [];
                }
            }

            // Обрабатываем остаток
            if (batch.length > 0) {
                await processBatch(batch);
                totalProcessed += batch.length;
                await job.log(`Processed ${totalProcessed} products, ignored ${totalIgnored} rows`);
            }

            await job.updateProgress(100);
            await job.log(`Successfully processed ${totalProcessed} products from ${totalRows} rows (${totalIgnored} ignored)`);

            // Удаляем файл после обработки
            await unlinkAsync(filePath);
            await job.log(`Cleaned up temporary file`);

            return {
                success: true,
                count: totalProcessed,
                totalRows,
                ignoredRows: totalIgnored,
                fileName
            };
        } catch (error) {
            // Удаляем файл даже при ошибке
            try {
                await unlinkAsync(filePath);
            } catch (cleanupError) {
                console.error('Failed to cleanup file:', cleanupError);
            }
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 1,
    }
);

allegroUploadWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});

allegroUploadWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
});
