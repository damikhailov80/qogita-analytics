import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sellerCode: string }> }
) {
    try {
        const { sellerCode } = await params;

        // Фильтры для Sales Qty и Sell Price
        const searchParams = request.nextUrl.searchParams;
        const minSalesQty = searchParams.get('minSalesQty');
        const maxSalesQty = searchParams.get('maxSalesQty');
        const minSellPrice = searchParams.get('minSellPrice');
        const maxSellPrice = searchParams.get('maxSellPrice');

        const orders = await prisma.$queryRaw<
            Array<{
                rn: bigint;
                seller_code: string;
                gtin: string;
                brand: string | null;
                buy_price: number;
                sell_price: number;
                allegro_price: number | null;
                unit_profit: number;
                profit_ratio: number;
                inventory: number;
                total_cost: number;
                total_profit: number;
                cumulative_cost: number;
                cumulative_profit: number;
                min_order_value: number | null;
                image_url: string | null;
                product_url: string | null;
                sales_quantity: number | null;
                manual_price: string | null;
            }>
        >(Prisma.sql`
            SELECT 
                oc.rn,
                oc.seller_code,
                oc.gtin,
                oc.brand,
                oc.buy_price,
                oc.sell_price,
                pa.price as allegro_price,
                oc.unit_profit,
                oc.profit_ratio,
                oc.inventory,
                oc.total_cost,
                oc.total_profit,
                oc.cumulative_cost,
                oc.cumulative_profit,
                oc.min_order_value,
                p.image_url,
                p.product_url,
                pa.sales_quantity,
                pac.manual_price
            FROM order_candidates oc
            LEFT JOIN products p ON p.gtin = oc.gtin
            LEFT JOIN products_allegro pa ON pa.gtin = oc.gtin
            LEFT JOIN products_allegro_changes pac ON pac.gtin = oc.gtin
            WHERE oc.seller_code = ${sellerCode}
                ${minSalesQty ? Prisma.sql`AND COALESCE(pa.sales_quantity, 0) >= ${Number(minSalesQty)}` : Prisma.empty}
                ${maxSalesQty ? Prisma.sql`AND COALESCE(pa.sales_quantity, 0) <= ${Number(maxSalesQty)}` : Prisma.empty}
                ${minSellPrice ? Prisma.sql`AND oc.sell_price >= ${Number(minSellPrice)}` : Prisma.empty}
                ${maxSellPrice ? Prisma.sql`AND oc.sell_price <= ${Number(maxSellPrice)}` : Prisma.empty}
            ORDER BY oc.unit_profit DESC
        `);

        const formattedOrders = orders.map((order) => ({
            rn: Number(order.rn),
            seller_code: order.seller_code,
            gtin: order.gtin,
            brand: order.brand,
            buy_price: order.buy_price,
            sell_price: order.sell_price,
            allegro_price: order.allegro_price,
            unit_profit: order.unit_profit,
            profit_ratio: order.profit_ratio,
            inventory: order.inventory,
            total_cost: order.total_cost,
            total_profit: order.total_profit,
            cumulative_cost: order.cumulative_cost,
            cumulative_profit: order.cumulative_profit,
            min_order_value: order.min_order_value,
            image_url: order.image_url,
            product_url: order.product_url,
            sales_quantity: order.sales_quantity,
            manual_price: order.manual_price,
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
