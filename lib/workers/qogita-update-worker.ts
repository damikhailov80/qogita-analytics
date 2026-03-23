import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { QogitaAPIClient } from '@/lib/qogita-client';
import { parseCSVCatalog } from '@/lib/csv-parser';
import { QogitaUpdateJobData, QOGITA_UPDATE_QUEUE_NAME, workerOptions } from '@/lib/workers/queue';
import { executeWorkerJob, processBatches, calculateProgress, setupWorkerEventHandlers } from '@/lib/workers/worker-utils';

export const qogitaUpdateWorker = new Worker<QogitaUpdateJobData>(
    QOGITA_UPDATE_QUEUE_NAME,
    async (job: Job<QogitaUpdateJobData>) => {
        return executeWorkerJob(job, 'qogita-update', async (job, logger) => {
            await logger.updateProgress(5);
            await logger.log('Starting Qogita products update');

            // Шаг 1: Аутентификация
            await logger.updateProgress(10);
            await logger.log('Authenticating with Qogita API...');

            const client = new QogitaAPIClient();
            await client.authenticate();
            await logger.log('Authentication successful');

            // Шаг 2: Загрузка каталога
            await logger.updateProgress(30);
            await logger.log('Downloading catalog...');

            const catalogCSV = await client.getCatalog();
            await logger.log('Catalog downloaded successfully');

            // Шаг 3: Парсинг данных
            await logger.updateProgress(50);
            await logger.log('Parsing catalog data...');

            const products = parseCSVCatalog(catalogCSV);
            await logger.log(`Parsed ${products.length} products from CSV`);

            if (products.length === 0) {
                throw new Error('Не удалось получить данные из каталога');
            }

            // Шаг 4: Удаление старых данных
            await logger.updateProgress(60);
            await logger.log('Clearing old products data...');

            // Удаляем связанные данные в правильном порядке
            await logger.log('Deleting offers...');
            await prisma.offer.deleteMany({});

            await logger.log('Deleting Allegro products...');
            await prisma.productAllegro.deleteMany({});

            await logger.log('Deleting products...');
            await prisma.product.deleteMany({});

            await logger.log('Clearing worker logs and states...');
            await prisma.workerLog.deleteMany({
                where: { workerType: { in: ['qogita-update', 'allegro-upload', 'offers-updateall'] } }
            });
            await prisma.workerState.deleteMany({
                where: { workerType: { in: ['qogita-update', 'allegro-upload', 'offers-updateall'] } }
            });

            await logger.log('Old data cleared');

            // Шаг 5: Загрузка новых данных
            await logger.updateProgress(70);
            await logger.log(`Inserting ${products.length} products...`);

            await processBatches(
                products,
                1000,
                async (batch) => {
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
                },
                async (processed, total) => {
                    const progress = calculateProgress(processed, total, 70, 95);
                    await logger.updateProgress(progress);
                    await logger.log(`Processed ${processed}/${total} products`);
                }
            );

            // Завершение
            await logger.updateProgress(100);
            await logger.log(`Successfully loaded ${products.length} products`);

            return {
                success: true,
                count: products.length
            };
        });
    },
    workerOptions
);

setupWorkerEventHandlers(qogitaUpdateWorker, 'Qogita Update Worker');
