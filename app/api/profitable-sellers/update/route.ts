import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        await prisma.$executeRaw`REFRESH MATERIALIZED VIEW order_candidates`;

        return NextResponse.json({
            success: true,
            message: 'Order candidates view refreshed successfully',
        });
    } catch (error) {
        console.error('Error refreshing order_candidates view:', error);
        return NextResponse.json(
            { error: 'Failed to refresh order_candidates view' },
            { status: 500 }
        );
    }
}
