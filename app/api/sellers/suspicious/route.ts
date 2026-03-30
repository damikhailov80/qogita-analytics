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
                reached_min_order: boolean;
                image_url: string | null;
                product_url: string | null;
                sales_quantity: number | null;
                manual_price: string | null;
            }>
        >`
            WITH ranked_products AS (
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
                    oc.reached_min_order,
                    p.image_url,
                    p.product_url,
                    pa.sales_quantity,
                    pac.manual_price,
                    ROW_NUMBER() OVER (PARTITION BY oc.gtin ORDER BY oc.buy_price ASC) as rn
                FROM order_candidates oc
                LEFT JOIN products p ON p.gtin = oc.gtin
                LEFT JOIN products_allegro pa ON pa.gtin = oc.gtin
                LEFT JOIN products_allegro_changes pac ON pac.gtin = oc.gtin
                WHERE oc.profit_ratio > 30
            )
            SELECT 
                seller_code,
                gtin,
                buy_price,
                sell_price,
                unit_profit,
                profit_ratio,
                inventory,
                total_cost,
                total_profit,
                cumulative_cost,
                cumulative_profit,
                min_order_value,
                reached_min_order,
                image_url,
                product_url,
                sales_quantity,
                manual_price
            FROM ranked_products
            WHERE rn = 1
            ORDER BY profit_ratio DESC
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
