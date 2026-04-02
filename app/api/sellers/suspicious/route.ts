import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const suspiciousProducts = await prisma.$queryRaw<
            Array<{
                seller_code: string;
                gtin: string;
                buy_price: number;
                sell_price: number;
                unit_profit: number;
                profit_ratio: number;
                inventory: number;
                total_cost: number;
                total_profit: number;
                cumulative_cost: number;
                cumulative_profit: number;
                min_order_value: number | null;
                seller_min_order_value: number | null;
                image_url: string | null;
                product_url: string | null;
                sales_quantity: number | null;
                manual_price: string | null;
            }>
        >`
            SELECT 
                oc.seller_code,
                oc.gtin,
                oc.buy_price,
                oc.sell_price,
                oc.unit_profit,
                oc.profit_ratio,
                oc.inventory,
                oc.total_cost,
                oc.total_profit,
                oc.cumulative_cost,
                oc.cumulative_profit,
                oc.min_order_value,
                s.min_order_value as seller_min_order_value,
                p.image_url,
                p.product_url,
                pa.sales_quantity,
                pac.manual_price
            FROM order_candidates oc
            LEFT JOIN products p ON p.gtin = oc.gtin
            LEFT JOIN products_allegro pa ON pa.gtin = oc.gtin
            LEFT JOIN products_allegro_changes pac ON pac.gtin = oc.gtin
            LEFT JOIN sellers s ON s.code = oc.seller_code
            WHERE oc.profit_ratio > 30
            ORDER BY oc.unit_profit DESC
            LIMIT 100
        `;

        return NextResponse.json({
            products: suspiciousProducts,
            count: suspiciousProducts.length,
        });
    } catch (error) {
        console.error('Error fetching suspicious products:', error);
        return NextResponse.json(
            { error: 'Failed to fetch suspicious products' },
            { status: 500 }
        );
    }
}
