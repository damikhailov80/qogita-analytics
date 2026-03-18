interface CatalogProduct {
    gtin: string;
    name: string;
    category?: string;
    brand?: string;
    lowestPrice?: number;
    unit?: string;
    lowestPricedOfferInventory?: number;
    isPreOrder: boolean;
    estimatedDeliveryTimeWeeks?: number;
    numberOfOffers?: number;
    totalInventoryAllOffers?: number;
    productUrl?: string;
    imageUrl?: string;
}

export function parseCSVCatalog(csvData: string): CatalogProduct[] {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const products: CatalogProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        // Маппинг заголовков CSV к полям элемента каталога
        const gtin = row['GTIN'] || row['gtin'] || '';
        const name = row['Name'] || row['name'] || '';
        const category = row['Category'] || row['category'] || undefined;
        const brand = row['Brand'] || row['brand'] || undefined;
        const priceStr = row['€ Lowest Price inc. shipping'] || row['lowestPrice'] || '';
        const unit = row['Unit'] || row['unit'] || undefined;
        const inventory = row['Lowest Priced Offer Inventory'] || row['lowestPricedOfferInventory'] || '';
        const isPreOrder = (row['Is a pre-order?'] || row['isPreOrder'] || '').toLowerCase() === 'yes';
        const deliveryTime = row['Estimated Delivery Time (weeks)'] || row['estimatedDeliveryTime'] || '';
        const offers = row['Number of Offers'] || row['numberOfOffers'] || '';
        const totalInventory = row['Total Inventory of All Offers'] || row['totalInventory'] || '';
        const productUrl = row['Product URL'] || row['productUrl'] || undefined;
        const imageUrl = row['Image URL'] || row['imageUrl'] || undefined;

        if (!gtin || !name) continue;

        products.push({
            gtin,
            name,
            category,
            brand,
            lowestPrice: priceStr ? parseFloat(priceStr) : undefined,
            unit,
            lowestPricedOfferInventory: inventory ? parseInt(inventory) : undefined,
            isPreOrder,
            estimatedDeliveryTimeWeeks: deliveryTime ? parseInt(deliveryTime) : undefined,
            numberOfOffers: offers ? parseInt(offers) : undefined,
            totalInventoryAllOffers: totalInventory ? parseInt(totalInventory) : undefined,
            productUrl,
            imageUrl,
        });
    }

    return products;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            // Проверяем на двойные кавычки (escaped quotes)
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++; // Пропускаем следующую кавычку
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}
