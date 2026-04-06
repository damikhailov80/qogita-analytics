import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { QogitaAPIClient } from '@/lib/qogita-client';
import { parseCSVCatalog } from '@/lib/csv-parser';
import { QogitaUpdateJobData, QOGITA_UPDATE_QUEUE_NAME, workerOptions } from '@/lib/workers/queue';
import { executeWorkerJob, processBatches, calculateProgress, setupWorkerEventHandlers } from '@/lib/workers/worker-utils';
import perfumeCategories from './perfume-categories.json';

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

            // Фильтруем парфюмерию
            const perfumeCategorySet = new Set(perfumeCategories.perfumeCategories);
            const filteredProducts = products.filter(p => !p.category || !perfumeCategorySet.has(p.category));
            const perfumeSkipped = products.length - filteredProducts.length;

            if (perfumeSkipped > 0) {
                await logger.log(`🚫 Filtered out ${perfumeSkipped} perfume products`);
            }
            await logger.log(`${filteredProducts.length} products will be imported`);

            // Шаг 4: Удаление старых данных
            await logger.updateProgress(60);
            await logger.log('Clearing old Qogita products data...');

            // Удаляем только данные из products (без каскадного удаления)
            await logger.log('Deleting products...');
            await prisma.product.deleteMany({});

            await logger.log('Clearing Qogita worker logs and states...');
            await prisma.workerLog.deleteMany({
                where: { workerType: 'qogita-update' }
            });
            await prisma.workerState.deleteMany({
                where: { workerType: 'qogita-update' }
            });

            await logger.log('Old Qogita data cleared');

            // Шаг 5: Загрузка новых данных
            await logger.updateProgress(70);
            await logger.log(`Inserting ${filteredProducts.length} products...`);

            await processBatches(
                filteredProducts,
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
            await logger.log(`✅ Successfully loaded ${filteredProducts.length} products`);
            if (perfumeSkipped > 0) {
                await logger.log(`🚫 Skipped ${perfumeSkipped} perfume products (filtered out)`);
            }

            return {
                success: true,
                count: filteredProducts.length,
                perfumeSkipped
            };
        });
    },
    workerOptions
);

setupWorkerEventHandlers(qogitaUpdateWorker, 'Qogita Update Worker');
