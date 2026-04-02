import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { QogitaAPIClient } from '@/lib/qogita-client';
import { OffersUpdateAllJobData, OFFERS_UPDATEALL_QUEUE_NAME, workerOptions } from '@/lib/workers/queue';
import {
    executeResumableWorkerJob,
    calculateProgress,
    setupWorkerEventHandlers,
    BaseWorkerState,
    ResumableWorkerStateManager
} from '@/lib/workers/worker-utils';

interface ProductWithUrl {
    gtin: string;
    productUrl: string | null;
}

interface OffersWorkerState extends BaseWorkerState {
    processedGtins: string[];
    results: {
        offersCreated: number;
        offersUpdated: number;
        sellersCreated: number;
        sellersUpdated: number;
        errors: string[];
    };
}

export const offersUpdateAllWorker = new Worker<OffersUpdateAllJobData>(
    OFFERS_UPDATEALL_QUEUE_NAME,
    async (job: Job<OffersUpdateAllJobData>) => {
        return executeResumableWorkerJob<OffersUpdateAllJobData, OffersWorkerState, any>(
            job,
            'offers-updateall',
            async (job, logger, stateManager) => {

                await logger.updateProgress(5);
                const startMsg = 'Starting offers update for products with outdated offers (older than 24 hours)';
                console.log(`[Offers UpdateAll Worker] ${startMsg}`);
                await logger.log(startMsg);

                // Шаг 1: Получаем GTIN из products_allegro с устаревшими offers (старше 24 часов) или без offers
                await logger.updateProgress(10);
                await logger.log('Fetching GTINs with outdated or missing offers...');

                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

                // Получаем все продукты из products_allegro
                const allAllegroProducts = await prisma.productAllegro.findMany({
                    select: { gtin: true }
                });

                const allGtins = allAllegroProducts.map(p => p.gtin);

                // Получаем GTIN с актуальными offers (обновленными за последние 24 часа)
                // Разбиваем на батчи по 500 элементов, чтобы избежать переполнения стека
                const batchSize = 500;
                const recentOffersSet = new Set<string>();

                for (let i = 0; i < allGtins.length; i += batchSize) {
                    const batch = allGtins.slice(i, i + batchSize);
                    const batchOffers = await prisma.offer.findMany({
                        where: {
                            gtin: { in: batch },
                            updatedAt: { gte: oneDayAgo }
                        },
                        select: { gtin: true },
                        distinct: ['gtin']
                    });
                    batchOffers.forEach(o => recentOffersSet.add(o.gtin));
                }

                // Фильтруем: оставляем только те GTIN, у которых нет актуальных offers
                const gtins = allGtins.filter(gtin => !recentOffersSet.has(gtin));

                await logger.log(`Found ${gtins.length} GTINs with outdated or missing offers (${allGtins.length} total products)`);

                if (gtins.length === 0) {
                    await logger.updateProgress(100);
                    await logger.log('No outdated or missing offers found - all products are up to date');
                    return {
                        success: true,
                        count: 0,
                        offersDeleted: 0,
                        offersCreated: 0,
                        offersUpdated: 0,
                        sellersCreated: 0,
                        sellersUpdated: 0,
                        sellersDeleted: 0,
                        errors: []
                    };
                }

                // Проверяем есть ли сохраненное состояние
                const savedState = await stateManager.loadState();
                let state: OffersWorkerState;
                let deleteResult: { count: number };

                if (savedState) {
                    // Восстанавливаем состояние
                    state = savedState;
                    const resumeMsg = `🔄 Resuming from saved state: ${state.processedGtins.length} products already processed`;
                    console.log(`[Offers UpdateAll Worker] ${resumeMsg}`);
                    await logger.log(resumeMsg);
                    deleteResult = { count: 0 }; // Уже удалили ранее
                } else {
                    // Новый запуск - удаляем только устаревшие offers для найденных GTIN
                    await logger.updateProgress(15);
                    await logger.log('Deleting outdated offers...');

                    // Удаляем батчами по 500 элементов
                    let totalDeleted = 0;
                    for (let i = 0; i < gtins.length; i += batchSize) {
                        const batch = gtins.slice(i, i + batchSize);
                        const result = await prisma.offer.deleteMany({
                            where: {
                                gtin: { in: batch },
                                updatedAt: { lt: oneDayAgo }
                            }
                        });
                        totalDeleted += result.count;
                    }

                    deleteResult = { count: totalDeleted };
                    await logger.log(`Deleted ${deleteResult.count} outdated offers`);

                    await logger.log('Clearing offers worker logs and states...');
                    await prisma.workerLog.deleteMany({
                        where: { workerType: 'offers-updateall' }
                    });
                    await prisma.workerState.deleteMany({
                        where: { workerType: 'offers-updateall' }
                    });

                    // Инициализируем состояние
                    state = {
                        processedGtins: [],
                        results: {
                            offersCreated: 0,
                            offersUpdated: 0,
                            sellersCreated: 0,
                            sellersUpdated: 0,
                            errors: []
                        }
                    };
                }

                // Шаг 3: Получаем продукты с productUrl для устаревших GTIN
                await logger.updateProgress(20);
                await logger.log('Fetching products with productUrl...');

                // Получаем продукты батчами по 500 элементов
                const allProductsArray: ProductWithUrl[] = [];
                for (let i = 0; i < gtins.length; i += batchSize) {
                    const batch = gtins.slice(i, i + batchSize);
                    const batchProducts = await prisma.product.findMany({
                        where: {
                            gtin: { in: batch },
                            productUrl: { not: null }
                        },
                        select: {
                            gtin: true,
                            productUrl: true
                        }
                    }) as ProductWithUrl[];
                    allProductsArray.push(...batchProducts);
                }

                // Фильтруем уже обработанные продукты
                const products = allProductsArray.filter(p => !state.processedGtins.includes(p.gtin));

                await logger.log(`Found ${allProductsArray.length} products with productUrl, ${products.length} remaining to process`);

                // Шаг 4: Аутентификация с Qogita API
                await logger.updateProgress(25);
                const authMsg = 'Authenticating with Qogita API...';
                console.log(`[Offers UpdateAll Worker] ${authMsg}`);
                await logger.log(authMsg);

                let qogitaClient = new QogitaAPIClient();
                await qogitaClient.authenticate();

                const authSuccessMsg = 'Authentication successful';
                console.log(`[Offers UpdateAll Worker] ${authSuccessMsg}`);
                await logger.log(authSuccessMsg);

                // Шаг 5: Обрабатываем каждый продукт
                await logger.updateProgress(30);
                await logger.log(`Processing ${products.length} products...`);

                const totalProducts = allProductsArray.length;
                let processed = state.processedGtins.length;

                for (const product of products) {
                    try {
                        // Извлекаем fid и slug из productUrl
                        if (!product.productUrl) continue;

                        const urlParts = product.productUrl.split('/').filter(p => p);
                        if (urlParts.length < 2) {
                            const errorMsg = `${product.gtin}: Invalid productUrl format`;
                            console.error(`[Offers UpdateAll Worker] ${errorMsg}`);
                            state.results.errors.push(errorMsg);
                            state.processedGtins.push(product.gtin);
                            await stateManager.saveState(state);
                            continue;
                        }

                        const fid = urlParts[urlParts.length - 2];
                        const slug = urlParts[urlParts.length - 1];

                        // Получаем offers от Qogita с обработкой rate limit
                        let offers;
                        let retryCount = 0;
                        const maxRetries = 3;

                        while (retryCount < maxRetries) {
                            try {
                                offers = await qogitaClient.getVariantOffers(fid, slug);
                                break; // Успешно получили данные
                            } catch (error: any) {
                                if (error.message.includes('Rate limit exceeded')) {
                                    // Извлекаем время ожидания из сообщения
                                    const retryMatch = error.message.match(/Retry after (\d+) seconds/);
                                    const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60;

                                    // Ждем столько сколько указал API
                                    const waitTime = retryAfter;
                                    const waitMinutes = Math.floor(waitTime / 60);
                                    const waitSeconds = waitTime % 60;

                                    const logMsg = `⏸️ Rate limit hit at ${product.gtin}. Pausing for ${waitMinutes}m ${waitSeconds}s...`;
                                    console.log(`[Offers UpdateAll Worker] ${logMsg}`);
                                    await logger.log(logMsg);

                                    const resumeMsg = `Worker will automatically resume at ${new Date(Date.now() + waitTime * 1000).toLocaleTimeString()}`;
                                    console.log(`[Offers UpdateAll Worker] ${resumeMsg}`);
                                    await logger.log(resumeMsg);

                                    // Сохраняем состояние перед паузой (НЕ добавляем текущий GTIN в processedGtins)
                                    await stateManager.saveState(state, true);

                                    // Ждем указанное время с периодическими обновлениями
                                    const updateInterval = 30000; // Обновляем каждые 30 секунд
                                    const totalWaitMs = waitTime * 1000;
                                    let elapsed = 0;

                                    while (elapsed < totalWaitMs) {
                                        const remainingMs = totalWaitMs - elapsed;
                                        const remainingMinutes = Math.floor(remainingMs / 60000);
                                        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

                                        if (elapsed > 0 && elapsed % 60000 === 0) { // Каждую минуту
                                            const waitMsg = `⏳ Waiting... ${remainingMinutes}m ${remainingSeconds}s remaining`;
                                            console.log(`[Offers UpdateAll Worker] ${waitMsg}`);
                                            await logger.log(waitMsg);
                                        }

                                        await new Promise(resolve => setTimeout(resolve, Math.min(updateInterval, remainingMs)));
                                        elapsed += updateInterval;
                                    }

                                    // Переаутентифицируемся после долгой паузы
                                    try {
                                        // Создаем новый клиент для чистой переаутентификации
                                        qogitaClient = new QogitaAPIClient();
                                        await qogitaClient.authenticate();
                                        const resumedMsg = '✅ Resumed after rate limit pause, re-authenticated';
                                        console.log(`[Offers UpdateAll Worker] ${resumedMsg}`);
                                        await logger.log(resumedMsg);

                                        // Добавляем дополнительную паузу после переаутентификации
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                    } catch (authError: any) {
                                        const authErrorMsg = `Failed to re-authenticate: ${authError.message}`;
                                        console.error(`[Offers UpdateAll Worker] ${authErrorMsg}`);
                                        if (authError.stack) {
                                            console.error(`[Offers UpdateAll Worker] Auth error stack:`, authError.stack);
                                        }
                                        await logger.log(`❌ ${authErrorMsg}`);
                                        throw authError;
                                    }

                                    retryCount++;
                                    console.log(`[Offers UpdateAll Worker] Retrying after rate limit (retry ${retryCount}/${maxRetries})...`);
                                } else {
                                    // Логируем полную ошибку с деталями
                                    const errorMsg = `Failed to fetch offers: ${error.message || JSON.stringify(error)}`;
                                    console.error(`[Offers UpdateAll Worker] ${product.gtin}: ${errorMsg}`);
                                    if (error.stack) {
                                        console.error(`[Offers UpdateAll Worker] Error stack:`, error.stack);
                                    }

                                    // Увеличиваем счетчик и пробуем еще раз если есть попытки
                                    retryCount++;
                                    if (retryCount >= maxRetries) {
                                        throw error; // Исчерпали попытки - пробрасываем ошибку
                                    }
                                    console.log(`[Offers UpdateAll Worker] Retrying after error (retry ${retryCount}/${maxRetries})...`);
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // Небольшая пауза перед retry
                                }
                            }
                        }

                        if (!offers) {
                            const errorMsg = `${product.gtin}: Failed to fetch offers after ${maxRetries} retries`;
                            console.error(`[Offers UpdateAll Worker] ${errorMsg}`);
                            state.results.errors.push(errorMsg);
                            state.processedGtins.push(product.gtin);
                            await stateManager.saveState(state);
                            processed++;
                            continue;
                        }

                        // Логируем количество полученных offers
                        console.log(`[Offers UpdateAll Worker] ${product.gtin}: Received ${offers.length} offers from Qogita`);
                        if (offers.length === 0) {
                            console.log(`[Offers UpdateAll Worker] ${product.gtin}: No offers available for this product`);
                        }

                        // Обрабатываем каждый offer
                        for (const offerData of offers) {
                            try {
                                // Проверяем существует ли seller
                                const existingSeller = await prisma.seller.findUnique({
                                    where: { code: offerData.seller }
                                });

                                // Upsert seller
                                await prisma.seller.upsert({
                                    where: { code: offerData.seller },
                                    create: {
                                        code: offerData.seller,
                                        minOrderValue: parseFloat(offerData.mov),
                                        currency: offerData.movCurrency
                                    },
                                    update: {
                                        minOrderValue: parseFloat(offerData.mov),
                                        currency: offerData.movCurrency
                                    }
                                });

                                if (!existingSeller) {
                                    state.results.sellersCreated++;
                                    console.log(`[Offers UpdateAll Worker] ${product.gtin}: Created seller ${offerData.seller} with MOV ${offerData.mov} ${offerData.movCurrency}`);
                                } else {
                                    state.results.sellersUpdated++;
                                    console.log(`[Offers UpdateAll Worker] ${product.gtin}: Updated seller ${offerData.seller} - OLD MOV: ${existingSeller.minOrderValue} ${existingSeller.currency}, NEW MOV: ${offerData.mov} ${offerData.movCurrency}`);
                                }

                                // Upsert offer
                                const offer = await prisma.offer.upsert({
                                    where: {
                                        gtin_sellerCode: {
                                            gtin: product.gtin,
                                            sellerCode: offerData.seller
                                        }
                                    },
                                    create: {
                                        gtin: product.gtin,
                                        sellerCode: offerData.seller,
                                        price: parseFloat(offerData.price),
                                        priceCurrency: offerData.priceCurrency,
                                        inventory: offerData.inventory
                                    },
                                    update: {
                                        price: parseFloat(offerData.price),
                                        priceCurrency: offerData.priceCurrency,
                                        inventory: offerData.inventory
                                    }
                                });

                                const isNewOffer = offer.createdAt.getTime() === offer.updatedAt.getTime();
                                if (isNewOffer) {
                                    state.results.offersCreated++;
                                } else {
                                    state.results.offersUpdated++;
                                }
                            } catch (error: any) {
                                const errorMsg = `${product.gtin} - Seller ${offerData.seller}: ${error.message}`;
                                console.error(`[Offers UpdateAll Worker] Error processing offer:`, errorMsg);
                                if (error.stack) {
                                    console.error(`[Offers UpdateAll Worker] Error stack:`, error.stack);
                                }
                                state.results.errors.push(errorMsg);
                            }
                        }

                        // Отмечаем продукт как обработанный
                        state.processedGtins.push(product.gtin);
                        processed++;

                        // Сохраняем состояние каждые 10 продуктов
                        if (processed % 10 === 0) {
                            await stateManager.saveState(state, true); // Сохраняем в БД каждые 10 продуктов
                        }

                        // Обновляем прогресс
                        const progress = calculateProgress(processed, totalProducts, 30, 90);
                        await logger.updateProgress(progress);

                        if (processed % 10 === 0) {
                            const progressMsg = `Processed ${processed}/${totalProducts} products`;
                            console.log(`[Offers UpdateAll Worker] ${progressMsg}`);
                            await logger.log(progressMsg);
                        }

                        // Небольшая задержка для избежания rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));

                    } catch (error: any) {
                        const errorMsg = `${product.gtin}: ${error.message || JSON.stringify(error)}`;
                        const errorDetails = {
                            gtin: product.gtin,
                            productUrl: product.productUrl,
                            message: error.message,
                            status: error.response?.status,
                            statusText: error.response?.statusText
                        };

                        console.error(`[Offers UpdateAll Worker] Error processing product:`, errorMsg);
                        console.error(`[Offers UpdateAll Worker] Error details:`, JSON.stringify(errorDetails, null, 2));
                        if (error.stack) {
                            console.error(`[Offers UpdateAll Worker] Error stack:`, error.stack);
                        }

                        state.results.errors.push(errorMsg);
                        state.processedGtins.push(product.gtin);
                        processed++;

                        // Сохраняем состояние при ошибке
                        await stateManager.saveState(state);
                    }
                }

                // Шаг 6: Удаляем sellers без offers
                await logger.updateProgress(95);
                await logger.log('Cleaning up sellers without offers...');

                const sellersWithoutOffers = await prisma.seller.findMany({
                    where: {
                        offers: {
                            none: {}
                        }
                    },
                    select: { code: true }
                });

                if (sellersWithoutOffers.length > 0) {
                    const deleteSellersResult = await prisma.seller.deleteMany({
                        where: {
                            code: { in: sellersWithoutOffers.map((s: { code: string }) => s.code) }
                        }
                    });

                    await logger.log(`Deleted ${deleteSellersResult.count} sellers without offers`);
                } else {
                    await logger.log('No sellers without offers found');
                }

                // Состояние будет очищено автоматически в executeResumableWorkerJob

                // Завершение
                await logger.updateProgress(100);
                const completedMsg = `Successfully processed ${processed} products`;
                console.log(`[Offers UpdateAll Worker] ${completedMsg}`);
                await logger.log(completedMsg);

                const offersMsg = `Offers created: ${state.results.offersCreated}, updated: ${state.results.offersUpdated}`;
                console.log(`[Offers UpdateAll Worker] ${offersMsg}`);
                await logger.log(offersMsg);

                const sellersMsg = `Sellers created: ${state.results.sellersCreated}, updated: ${state.results.sellersUpdated}`;
                console.log(`[Offers UpdateAll Worker] ${sellersMsg}`);
                await logger.log(sellersMsg);

                const sellersDeletedMsg = `Sellers deleted: ${sellersWithoutOffers.length}`;
                console.log(`[Offers UpdateAll Worker] ${sellersDeletedMsg}`);
                await logger.log(sellersDeletedMsg);

                if (state.results.errors.length > 0) {
                    const errorsCountMsg = `Errors: ${state.results.errors.length}`;
                    console.log(`[Offers UpdateAll Worker] ${errorsCountMsg}`);
                    await logger.log(errorsCountMsg);
                    await logger.log('--- Error Details ---');
                    console.log(`[Offers UpdateAll Worker] --- Error Details ---`);
                    // Выводим первые 50 ошибок для анализа
                    const errorsToShow = state.results.errors.slice(0, 50);
                    for (const error of errorsToShow) {
                        console.error(`[Offers UpdateAll Worker]   ${error}`);
                        await logger.log(`  ${error}`);
                    }
                    if (state.results.errors.length > 50) {
                        const moreErrorsMsg = `  ... and ${state.results.errors.length - 50} more errors`;
                        console.log(`[Offers UpdateAll Worker] ${moreErrorsMsg}`);
                        await logger.log(moreErrorsMsg);
                    }
                }

                return {
                    success: true,
                    count: processed,
                    offersDeleted: deleteResult.count,
                    offersCreated: state.results.offersCreated,
                    offersUpdated: state.results.offersUpdated,
                    sellersCreated: state.results.sellersCreated,
                    sellersUpdated: state.results.sellersUpdated,
                    sellersDeleted: sellersWithoutOffers.length,
                    errors: state.results.errors
                };
            },
            'current' // Постоянный ключ для возобновления после перезапуска
        );
    },
    workerOptions
);

setupWorkerEventHandlers(offersUpdateAllWorker, 'Offers UpdateAll Worker');
