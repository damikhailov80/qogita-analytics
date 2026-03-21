import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildWhereCondition, type ProductFilterParams } from '../lib';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const params: ProductFilterParams = {
            whitelist: Array.isArray(body.whitelist) ? body.whitelist : [],
            blacklist: Array.isArray(body.blacklist) ? body.blacklist : [],
            categoryWhitelist: Array.isArray(body.categoryWhitelist) ? body.categoryWhitelist : [],
            categoryBlacklist: Array.isArray(body.categoryBlacklist) ? body.categoryBlacklist : [],
        };

        // Создаем условие фильтрации используя общую функцию
        const whereCondition = buildWhereCondition(params);

        // Если нужны только продукты из Allegro, получаем список GTIN
        if (body.onlyAllegro === true) {
            const allegroProducts = await prisma.productAllegro.findMany({
                select: { gtin: true },
            });
            const allegroGtins = allegroProducts.map(p => p.gtin);

            if (allegroGtins.length > 0) {
                whereCondition.gtin = {
                    in: allegroGtins,
                };
            } else {
                // Если нет продуктов в Allegro, возвращаем пустой CSV
                const csvHeader = '"GTIN","Name","Category","Brand","€ Lowest Price inc. shipping","Unit","Lowest Priced Offer Inventory","Is a pre-order?","Estimated Delivery Time (weeks)","Number of Offers","Total Inventory of All Offers","Product URL","Image URL"';
                return new NextResponse(csvHeader, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().replace(/:/g, '-')}.csv"`,
                    },
                });
            }
        }

        // Получаем все продукты без пагинации
        const products = await prisma.product.findMany({
            where: whereCondition,
            orderBy: {
                id: 'asc',
            },
        });

        // Формируем CSV
        const csvHeader = '"GTIN","Name","Category","Brand","€ Lowest Price inc. shipping","Unit","Lowest Priced Offer Inventory","Is a pre-order?","Estimated Delivery Time (weeks)","Number of Offers","Total Inventory of All Offers","Product URL","Image URL"';

        const csvRows = products.map(item => {
            const fields = [
                item.gtin || '',
                item.name || '',
                item.category || '',
                item.brand || '',
                item.lowestPrice?.toString() || '',
                item.unit || '',
                item.lowestPricedOfferInventory?.toString() || '',
                item.isPreOrder ? 'Yes' : 'No',
                item.estimatedDeliveryTimeWeeks?.toString() || '',
                item.numberOfOffers?.toString() || '',
                item.totalInventoryAllOffers?.toString() || '',
                item.productUrl || '',
                item.imageUrl || '',
            ];

            // Экранируем кавычки и оборачиваем каждое поле в кавычки
            return fields.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [csvHeader, ...csvRows].join('\n');

        // Возвращаем CSV с правильными заголовками
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().replace(/:/g, '-')}.csv"`,
            },
        });
    } catch (error) {
        console.error('Error exporting products:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
