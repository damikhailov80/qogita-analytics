import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const sortBy = searchParams.get('sortBy') || 'positive_items_count';

        // Фильтры для Sales Qty и Sell Price
        const minSalesQty = searchParams.get('minSalesQty');
        const maxSalesQty = searchParams.get('maxSalesQty');
        const minSellPrice = searchParams.get('minSellPrice');
        const maxSellPrice = searchParams.get('maxSellPrice');

        const sellers = await prisma.$queryRaw<
            Array<{
                seller_code: string;
                positive_items_count: bigint;
                max_cumulative_profit: number;
                min_order_value: number | null;
                total_positive_sales: bigint | null;
            }>
        >`
      SELECT 
        oc.seller_code,
        COUNT(CASE WHEN oc.profit_ratio > 0 THEN 1 END) AS positive_items_count,
        MAX(oc.cumulative_profit) AS max_cumulative_profit,
        s.min_order_value,
        SUM(CASE WHEN oc.profit_ratio > 0 THEN COALESCE(pa.sales_quantity, 0) ELSE 0 END) AS total_positive_sales
      FROM order_candidates oc
      LEFT JOIN sellers s ON oc.seller_code = s.code
      LEFT JOIN products_allegro pa ON oc.gtin = pa.gtin
      WHERE 1=1
        ${minSalesQty ? Prisma.sql`AND COALESCE(pa.sales_quantity, 0) >= ${Number(minSalesQty)}` : Prisma.empty}
        ${maxSalesQty ? Prisma.sql`AND COALESCE(pa.sales_quantity, 0) <= ${Number(maxSalesQty)}` : Prisma.empty}
        ${minSellPrice ? Prisma.sql`AND oc.sell_price >= ${Number(minSellPrice)}` : Prisma.empty}
        ${maxSellPrice ? Prisma.sql`AND oc.sell_price <= ${Number(maxSellPrice)}` : Prisma.empty}
      GROUP BY oc.seller_code, s.min_order_value
      HAVING COUNT(CASE WHEN oc.profit_ratio > 0 THEN 1 END) > 0 
        AND MAX(oc.cumulative_profit) > 0
      ORDER BY ${sortBy === 'max_cumulative_profit' ? 'max_cumulative_profit' : 'positive_items_count'} DESC
    `;

        const formattedSellers = sellers.map((seller) => ({
            seller_code: seller.seller_code,
            positive_items_count: Number(seller.positive_items_count),
            max_cumulative_profit: seller.max_cumulative_profit,
            min_order_value: seller.min_order_value,
            total_positive_sales: seller.total_positive_sales ? Number(seller.total_positive_sales) : 0,
        }));

        return NextResponse.json({
            sellers: formattedSellers,
            sortBy,
            count: formattedSellers.length,
        });
    } catch (error) {
        console.error('Error fetching profitable sellers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch profitable sellers' },
            { status: 500 }
        );
    }
}
