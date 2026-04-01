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
 * Причины отклонения строки
 */
export type RejectionReason =
    | 'missing_fields'
    | 'invalid_traffic'
    | 'invalid_sellers_count'
    | 'sellers_out_of_range'
    | 'traffic_out_of_range'
    | 'invalid_price'
    | 'price_out_of_range';

/**
 * Результат парсинга строки
 */
export interface ParseResult {
    product: AllegroProduct | null;
    rejectionReason?: RejectionReason;
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
 * Нормализует GTIN, добавляя лидирующие нули до 14 символов
 */
function normalizeGtin(gtin: string): string {
    // Удаляем пробелы и нечисловые символы
    const cleaned = gtin.replace(/\D/g, '');
    // Добавляем лидирующие нули до 13 символов
    return cleaned.padStart(13, '0');
}

/**
 * Парсит строку CSV в объект AllegroProduct
 * Извлекает GTIN, количество продаж (traffic) и цену (price_netto)
 * Конвертирует цену из PLN в EUR используя курс из переменной окружения
 * Фильтрует товары с sales_quantity вне диапазона ALLEGRO_MIN_TRAFFIC - ALLEGRO_MAX_TRAFFIC
 * Фильтрует товары с ценой вне диапазона ALLEGRO_MIN_PRICE - ALLEGRO_MAX_PRICE (в EUR)
 * Фильтрует товары с количеством продавцов вне диапазона ALLEGRO_MIN_SELLERS - ALLEGRO_MAX_SELLERS
 */
export function parseAllegroRow(row: Record<string, string>): ParseResult {
    const gtinRaw = row['GTIN'] || row['gtin'] || '';
    const traffic = row['traffic'] || '';
    const priceNetto = row['price_netto'] || '';
    const offersCount = row['OFFERS_COUNT'] || row['offers_count'] || row['OD|FEERS_COUNT'] || '';

    if (!gtinRaw || !traffic || !priceNetto) {
        return { product: null, rejectionReason: 'missing_fields' };
    }

    // Нормализуем GTIN
    const gtin = normalizeGtin(gtinRaw);

    // Извлекаем число из traffic (например "2 osoby" -> 2)
    const trafficMatch = traffic.match(/^\d+/);
    if (!trafficMatch) {
        return { product: null, rejectionReason: 'invalid_traffic' };
    }
    const salesQuantity = parseInt(trafficMatch[0]);

    // Извлекаем количество продавцов (если есть)
    if (offersCount) {
        const sellersCount = parseInt(offersCount);
        if (isNaN(sellersCount)) {
            return { product: null, rejectionReason: 'invalid_sellers_count' };
        }

        // Пропускаем товары вне диапазона количества продавцов
        const minSellers = parseInt(process.env.ALLEGRO_MIN_SELLERS || '2');
        const maxSellers = parseInt(process.env.ALLEGRO_MAX_SELLERS || '999');
        if (sellersCount < minSellers || sellersCount > maxSellers) {
            return { product: null, rejectionReason: 'sellers_out_of_range' };
        }
    }

    // Пропускаем товары вне диапазона traffic
    const minTraffic = parseInt(process.env.ALLEGRO_MIN_TRAFFIC || '100');
    const maxTraffic = parseInt(process.env.ALLEGRO_MAX_TRAFFIC || '99999');
    if (salesQuantity < minTraffic || salesQuantity > maxTraffic) {
        return { product: null, rejectionReason: 'traffic_out_of_range' };
    }

    // Извлекаем число из price_netto (например "80,49 zł" -> 80.49)
    const priceMatch = priceNetto.match(/[\d,]+/);
    if (!priceMatch) {
        return { product: null, rejectionReason: 'invalid_price' };
    }

    // Заменяем запятую на точку для парсинга
    const pricePLN = parseFloat(priceMatch[0].replace(',', '.'));

    if (isNaN(salesQuantity) || isNaN(pricePLN)) {
        return { product: null, rejectionReason: 'invalid_price' };
    }

    // Конвертируем цену из PLN в EUR
    const exchangeRate = parseFloat(process.env.PLN_TO_EUR_RATE || '5');
    const priceEUR = pricePLN / exchangeRate;

    // Пропускаем товары вне диапазона цены
    const minPrice = parseFloat(process.env.ALLEGRO_MIN_PRICE || '0');
    const maxPrice = parseFloat(process.env.ALLEGRO_MAX_PRICE || '99999');
    if (priceEUR < minPrice || priceEUR > maxPrice) {
        return { product: null, rejectionReason: 'price_out_of_range' };
    }

    return {
        product: {
            gtin,
            salesQuantity,
            price: priceEUR
        }
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
