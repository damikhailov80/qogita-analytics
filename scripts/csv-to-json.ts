import * as fs from 'fs';

interface Product {
    gtin: string;
    name: string;
    category: string;
    brand: string;
    lowestPrice: number;
    unit: string;
    lowestPricedOfferInventory: number;
    isPreOrder: boolean;
    estimatedDeliveryTime: string;
    numberOfOffers: number;
    totalInventory: number;
    productUrl: string;
    imageUrl: string;
}

function cleanString(str: string): string {
    return str.replace(/[\u200E\u200F\u202A-\u202E]/g, '').trim();
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cleanString(current));
            current = '';
        } else {
            current += char;
        }
    }

    result.push(cleanString(current));
    return result;
}

function convertCSVToJSON(csvFilePath: string, outputPath?: string): void {
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    const headers = parseCSVLine(lines[0]);
    const products: Product[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length !== headers.length) continue;

        const product: Product = {
            gtin: values[0],
            name: values[1],
            category: values[2],
            brand: values[3],
            lowestPrice: parseFloat(values[4]) || 0,
            unit: values[5],
            lowestPricedOfferInventory: parseInt(values[6]) || 0,
            isPreOrder: values[7].toLowerCase() === 'yes',
            estimatedDeliveryTime: values[8],
            numberOfOffers: parseInt(values[9]) || 0,
            totalInventory: parseInt(values[10]) || 0,
            productUrl: values[11],
            imageUrl: values[12]
        };

        products.push(product);
    }

    const output = outputPath || csvFilePath.replace('.csv', '.json');
    fs.writeFileSync(output, JSON.stringify(products, null, 2), 'utf-8');

    console.log(`✓ Преобразовано ${products.length} продуктов`);
    console.log(`✓ Сохранено в: ${output}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Использование: npm run csv-to-json <путь-к-csv> [путь-к-json]');
    process.exit(1);
}

convertCSVToJSON(args[0], args[1]);
