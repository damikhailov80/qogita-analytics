import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QogitaAPIClient } from '@/lib/qogita-client';
import { parseCSVCatalog } from '@/lib/csv-parser';

// Глобальная переменная для отслеживания текущего обновления
let isUpdateRunning = false;

export async function GET() {
    try {
        const update = await prisma.update.findFirst({
            where: { name: 'qogita' },
            orderBy: { updatedAt: 'desc' }
        });

        if (!update) {
            return NextResponse.json({
                status: 'idle',
                progress: 0,
                message: 'Обновление еще не запускалось'
            });
        }

        return NextResponse.json({
            status: update.status,
            progress: update.progress,
            message: update.message,
            startedAt: update.startedAt,
            updatedAt: update.updatedAt
        });
    } catch (error) {
        console.error('Error fetching update status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch update status' },
            { status: 500 }
        );
    }
}

export async function POST() {
    if (isUpdateRunning) {
        return NextResponse.json(
            { error: 'Обновление уже выполняется. Дождитесь завершения текущего обновления.' },
            { status: 409 }
        );
    }

    // Проверяем статус в базе данных
    const currentUpdate = await prisma.update.findFirst({
        where: {
            name: 'qogita',
            status: 'running'
        },
        orderBy: { updatedAt: 'desc' }
    });

    if (currentUpdate) {
        // Проверяем, не зависло ли обновление (более 15 минут без изменений)
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (currentUpdate.updatedAt < fifteenMinutesAgo) {
            console.log('[Qogita Update] Found stale running update, marking as failed');
            await prisma.update.update({
                where: { id: currentUpdate.id },
                data: {
                    status: 'error',
                    message: 'Обновление прервано (превышено время ожидания)',
                    updatedAt: new Date()
                }
            });
        } else {
            return NextResponse.json(
                { error: 'Обновление уже выполняется. Дождитесь завершения текущего обновления.' },
                { status: 409 }
            );
        }
    }

    // Запускаем обновление асинхронно
    isUpdateRunning = true;
    runUpdate().finally(() => {
        isUpdateRunning = false;
    });

    return NextResponse.json({
        message: 'Обновление запущено',
        status: 'running'
    });
}

async function runUpdate() {
    let updateRecord;

    try {
        // Создаем запись об обновлении
        updateRecord = await prisma.update.create({
            data: {
                name: 'qogita',
                status: 'running',
                progress: 0,
                message: 'Инициализация...',
                startedAt: new Date()
            }
        });

        // Шаг 1: Аутентификация
        await updateStatus(updateRecord.id, 10, 'Аутентификация в API Qogita...');
        const client = new QogitaAPIClient();
        await client.authenticate();

        // Шаг 2: Загрузка каталога
        await updateStatus(updateRecord.id, 30, 'Загрузка каталога продуктов...');
        const catalogCSV = await client.getCatalog();

        // Шаг 3: Парсинг данных
        await updateStatus(updateRecord.id, 50, 'Обработка данных...');
        const products = parseCSVCatalog(catalogCSV);

        console.log(`[Qogita Update] Parsed ${products.length} products from CSV`);

        if (products.length === 0) {
            throw new Error('Не удалось получить данные из каталога');
        }

        // Шаг 4: Удаление старых данных
        await updateStatus(updateRecord.id, 60, 'Удаление старых данных...');
        await prisma.product.deleteMany({});

        // Шаг 5: Загрузка новых данных
        await updateStatus(updateRecord.id, 70, `Загрузка ${products.length} продуктов...`);

        const batchSize = 1000;
        let processed = 0;

        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);

            console.log(`[Qogita Update] Inserting batch ${i / batchSize + 1}, size: ${batch.length}`);

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
            console.log(`[Qogita Update] Processed ${processed}/${products.length} products`);
            const progress = 70 + Math.floor((processed / products.length) * 25);
            await updateStatus(
                updateRecord.id,
                progress,
                `Загружено ${processed}/${products.length} продуктов...`
            );
        }

        // Завершение
        console.log(`[Qogita Update] Successfully loaded ${products.length} products`);
        await prisma.update.update({
            where: { id: updateRecord.id },
            data: {
                status: 'success',
                progress: 100,
                message: `Успешно загружено ${products.length} продуктов`,
                updatedAt: new Date()
            }
        });

    } catch (error: any) {
        console.error('[Qogita Update] Update failed:', error);
        console.error('[Qogita Update] Error stack:', error.stack);

        if (updateRecord) {
            await prisma.update.update({
                where: { id: updateRecord.id },
                data: {
                    status: 'error',
                    message: `Ошибка: ${error.message}`,
                    updatedAt: new Date()
                }
            });
        } else {
            // Если updateRecord не был создан, создаем запись об ошибке
            await prisma.update.create({
                data: {
                    name: 'qogita',
                    status: 'error',
                    progress: 0,
                    message: `Ошибка инициализации: ${error.message}`,
                    startedAt: new Date(),
                    updatedAt: new Date()
                }
            });
        }
    }
}

async function updateStatus(id: number, progress: number, message: string) {
    await prisma.update.update({
        where: { id },
        data: {
            progress,
            message,
            updatedAt: new Date()
        }
    });
}
