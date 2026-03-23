import { prisma } from '@/lib/prisma';

/**
 * Интерфейс для продукта Allegro из CSV
 */
export interface AllegroProduct {
    gtin: string;
    salesQuantity: number;
    price: number;
}

/**
 * Результат обработки батча продуктов
 */
export interface BatchProcessResult {
    processed: number;
    skipped: number;
    skippedGtins: string[];
}

/**
 * Парсит строку CSV в объект AllegroProduct
 * Извлекает GTIN, количество продаж (traffic) и цену (price_netto)
 * Конвертирует цену из PLN в EUR используя курс из переменной окружения
 * Фильтрует товары с sales_quantity ниже порога из ALLEGRO_MIN_TRAFFIC
 */
export function parseAllegroRow(row: Record<string, string>): AllegroProduct | null {
    const gtin = row['GTIN'] || row['gtin'] || '';
    const traffic = row['traffic'] || '';
    const priceNetto = row['price_netto'] || '';

    if (!gtin || !traffic || !priceNetto) return null;

    // Извлекаем число из traffic (например "2 osoby" -> 2)
    const trafficMatch = traffic.match(/^\d+/);
    if (!trafficMatch) {
        return null;
    }
    const salesQuantity = parseInt(trafficMatch[0]);

    // Пропускаем товары с sales_quantity ниже порога
    const minTraffic = parseInt(process.env.ALLEGRO_MIN_TRAFFIC || '100');
    if (salesQuantity < minTraffic) {
        return null;
    }

    // Извлекаем число из price_netto (например "80,49 zł" -> 80.49)
    const priceMatch = priceNetto.match(/[\d,]+/);
    if (!priceMatch) return null;

    // Заменяем запятую на точку для парсинга
    const pricePLN = parseFloat(priceMatch[0].replace(',', '.'));

    if (isNaN(salesQuantity) || isNaN(pricePLN)) return null;

    // Конвертируем цену из PLN в EUR
    const exchangeRate = parseFloat(process.env.PLN_TO_EUR_RATE || '4.28');
    const priceEUR = pricePLN / exchangeRate;

    return {
        gtin,
        salesQuantity,
        price: priceEUR
    };
}

/**
 * Обрабатывает батч продуктов Allegro
 * Проверяет существование GTIN в базе и обновляет/создает записи
 */
export async function processAllegroProductBatch(
    batch: AllegroProduct[]
): Promise<BatchProcessResult> {
    // Проверяем, какие GTIN существуют в базе
    const existingGtins = await prisma.product.findMany({
        where: { gtin: { in: batch.map(p => p.gtin) } },
        select: { gtin: true }
    });

    const existingGtinSet = new Set(existingGtins.map(p => p.gtin));
    const validProducts = batch.filter(p => existingGtinSet.has(p.gtin));
    const skippedProducts = batch.filter(p => !existingGtinSet.has(p.gtin));
    const skippedCount = skippedProducts.length;
    const skippedGtins = skippedProducts.map(p => p.gtin);

    if (validProducts.length > 0) {
        await Promise.all(
            validProducts.map(product =>
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

    return { processed: validProducts.length, skipped: skippedCount, skippedGtins };
}

/**
 * Оценивает количество строк в файле на основе первых N строк
 */
export interface RowEstimation {
    estimatedRows: number;
    avgBytesPerRow: number;
}

export function estimateRowCount(
    sampleSize: number,
    bytesRead: number,
    fileSize: number
): RowEstimation {
    const avgBytesPerRow = bytesRead / sampleSize;
    const estimatedRows = Math.floor(fileSize / avgBytesPerRow);

    return {
        estimatedRows,
        avgBytesPerRow
    };
}
