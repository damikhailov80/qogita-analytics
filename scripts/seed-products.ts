import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

interface CatalogProduct {
    gtin: string;
    name: string;
    category?: string;
    brand?: string;
    lowestPrice?: number;
    unit?: string;
    lowestPricedOfferInventory?: number;
    isPreOrder: boolean;
    estimatedDeliveryTime?: string;
    numberOfOffers?: number;
    totalInventory?: number;
    productUrl?: string;
    imageUrl?: string;
}

async function main() {
    console.log('Начинаем загрузку данных...');

    const catalogPath = join(process.cwd(), 'catalog', 'catalog-2026-03-16T20-49-29-911Z.json');
    const catalogData: CatalogProduct[] = JSON.parse(readFileSync(catalogPath, 'utf-8'));

    console.log(`Найдено ${catalogData.length} продуктов для загрузки`);

    const batchSize = 1000;
    let processed = 0;

    for (let i = 0; i < catalogData.length; i += batchSize) {
        const batch = catalogData.slice(i, i + batchSize);

        await prisma.$transaction(
            batch.map((product) => {
                const estimatedWeeks = product.estimatedDeliveryTime
                    ? parseInt(product.estimatedDeliveryTime) || null
                    : null;

                return prisma.product.upsert({
                    where: { gtin: product.gtin },
                    update: {
                        name: product.name,
                        category: product.category || null,
                        brand: product.brand || null,
                        lowestPriceIncShipping: product.lowestPrice || null,
                        unit: product.unit || null,
                        lowestPricedOfferInventory: product.lowestPricedOfferInventory || null,
                        isPreOrder: product.isPreOrder,
                        estimatedDeliveryTimeWeeks: estimatedWeeks,
                        numberOfOffers: product.numberOfOffers || null,
                        totalInventoryAllOffers: product.totalInventory || null,
                        productUrl: product.productUrl || null,
                        imageUrl: product.imageUrl || null,
                    },
                    create: {
                        gtin: product.gtin,
                        name: product.name,
                        category: product.category || null,
                        brand: product.brand || null,
                        lowestPriceIncShipping: product.lowestPrice || null,
                        unit: product.unit || null,
                        lowestPricedOfferInventory: product.lowestPricedOfferInventory || null,
                        isPreOrder: product.isPreOrder,
                        estimatedDeliveryTimeWeeks: estimatedWeeks,
                        numberOfOffers: product.numberOfOffers || null,
                        totalInventoryAllOffers: product.totalInventory || null,
                        productUrl: product.productUrl || null,
                        imageUrl: product.imageUrl || null,
                    },
                });
            })
        );

        processed += batch.length;
        console.log(`Обработано: ${processed}/${catalogData.length} продуктов`);
    }

    console.log('Загрузка завершена успешно!');
}

main()
    .catch((e) => {
        console.error('Ошибка при загрузке данных:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
