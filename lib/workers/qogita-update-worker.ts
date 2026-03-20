import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { QogitaAPIClient } from '@/lib/qogita-client';
import { parseCSVCatalog } from '@/lib/csv-parser';
import { QogitaUpdateJobData, QOGITA_UPDATE_QUEUE_NAME, workerOptions } from '@/lib/workers/queue';

export const qogitaUpdateWorker = new Worker<QogitaUpdateJobData>(
    QOGITA_UPDATE_QUEUE_NAME,
    async (job: Job<QogitaUpdateJobData>) => {
        const startTime = new Date();
        const jobLogs: string[] = [];

        const logAndStore = async (message: string) => {
            await job.log(message);
            jobLogs.push(message);
        };

        try {
            await job.updateProgress(5);
            await logAndStore('Starting Qogita products update');

            // Шаг 1: Аутентификация
            await job.updateProgress(10);
            await logAndStore('Authenticating with Qogita API...');

            const client = new QogitaAPIClient();
            await client.authenticate();
            await logAndStore('Authentication successful');

            // Шаг 2: Загрузка каталога
            await job.updateProgress(30);
            await logAndStore('Downloading catalog...');

            const catalogCSV = await client.getCatalog();
            await logAndStore('Catalog downloaded successfully');

            // Шаг 3: Парсинг данных
            await job.updateProgress(50);
            await logAndStore('Parsing catalog data...');

            const products = parseCSVCatalog(catalogCSV);
            await logAndStore(`Parsed ${products.length} products from CSV`);

            if (products.length === 0) {
                throw new Error('Не удалось получить данные из каталога');
            }

            // Шаг 4: Удаление старых данных
            await job.updateProgress(60);
            await logAndStore('Clearing old products data...');

            await prisma.product.deleteMany({});
            await logAndStore('Old data cleared');

            // Шаг 5: Загрузка новых данных
            await job.updateProgress(70);
            await logAndStore(`Inserting ${products.length} products...`);
            await job.log('Clearing old products data...');

            await prisma.product.deleteMany({});
            await job.log('Old data cleared');

            // Шаг 5: Загрузка новых данных
            await job.updateProgress(70);
            await job.log(`Inserting ${products.length} products...`);

            const batchSize = 1000;
            let processed = 0;

            for (let i = 0; i < products.length; i += batchSize) {
                const batch = products.slice(i, i + batchSize);

                await prisma.product.createMany({
                    data: batch.map(product => ({
                        gtin: product.gtin,
                        name: product.name,
                        category: product.category || null,
                        brand: product.brand || null,
                        lowestPrice: product.lowestPrice || null,
                        unit: product.unit || null,
                        lowestPricedOfferInventory: product.lowestPricedOfferInventory || null,
                        isPreOrder: product.isPreOrder,
                        estimatedDeliveryTimeWeeks: product.estimatedDeliveryTimeWeeks || null,
                        numberOfOffers: product.numberOfOffers || null,
                        totalInventoryAllOffers: product.totalInventoryAllOffers || null,
                        productUrl: product.productUrl || null,
                        imageUrl: product.imageUrl || null,
                    })),
                    skipDuplicates: true
                });

                processed += batch.length;
                const progress = 70 + Math.floor((processed / products.length) * 25);

                await job.updateProgress(progress);
                await logAndStore(`Processed ${processed}/${products.length} products`);
            }

            // Завершение
            await job.updateProgress(100);
            await logAndStore(`Successfully loaded ${products.length} products`);

            const result = {
                success: true,
                count: products.length
            };

            // Сохраняем логи в базу данных
            await prisma.workerLog.create({
                data: {
                    workerType: 'qogita-update',
                    jobId: job.id as string,
                    status: 'completed',
                    logs: jobLogs,
                    result: result,
                    startedAt: startTime,
                    completedAt: new Date()
                }
            });

            return result;

        } catch (error: any) {
            await job.log(`Error: ${error.message}`);
            jobLogs.push(`Error: ${error.message}`);
            console.error('[Qogita Update Worker] Update failed:', error);

            // Сохраняем логи об ошибке
            await prisma.workerLog.create({
                data: {
                    workerType: 'qogita-update',
                    jobId: job.id as string,
                    status: 'failed',
                    logs: jobLogs,
                    error: error.message,
                    startedAt: startTime,
                    completedAt: new Date()
                }
            }).catch((err: Error) => console.error('Failed to save error log:', err));

            throw error;
        }
    },
    workerOptions
);

qogitaUpdateWorker.on('completed', (job) => {
    console.log(`Qogita update job ${job.id} completed successfully`);
});

qogitaUpdateWorker.on('failed', (job, err) => {
    console.error(`Qogita update job ${job?.id} failed:`, err);
});
