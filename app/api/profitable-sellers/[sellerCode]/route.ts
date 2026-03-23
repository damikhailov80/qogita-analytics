import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sellerCode: string }> }
) {
    try {
        const { sellerCode } = await params;

        const orders = await prisma.$queryRaw<
            Array<{
                rn: bigint;
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
                is_unprofitable: boolean;
                image_url: string | null;
                product_url: string | null;
                sales_quantity: number | null;
            }>
        >(Prisma.sql`
            SELECT 
                oc.rn,
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
                oc.is_unprofitable,
                p.image_url,
                p.product_url,
                pa.sales_quantity
            FROM order_candidates oc
            LEFT JOIN products p ON p.gtin = oc.gtin
            LEFT JOIN products_allegro pa ON pa.gtin = oc.gtin
            WHERE oc.seller_code = ${sellerCode}
            ORDER BY oc.rn
        `);

        const formattedOrders = orders.map((order) => ({
            rn: Number(order.rn),
            seller_code: order.seller_code,
            gtin: order.gtin,
            buy_price: order.buy_price,
            sell_price: order.sell_price,
            unit_profit: order.unit_profit,
            profit_ratio: order.profit_ratio,
            inventory: order.inventory,
            total_cost: order.total_cost,
            total_profit: order.total_profit,
            cumulative_cost: order.cumulative_cost,
            cumulative_profit: order.cumulative_profit,
            min_order_value: order.min_order_value,
            reached_min_order: order.reached_min_order,
            is_unprofitable: order.is_unprofitable,
            image_url: order.image_url,
            product_url: order.product_url,
            sales_quantity: order.sales_quantity,
        }));

        return NextResponse.json({
            sellerCode,
            orders: formattedOrders,
            count: formattedOrders.length,
        });
    } catch (error) {
        console.error('Error fetching seller orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch seller orders' },
            { status: 500 }
        );
    }
}
