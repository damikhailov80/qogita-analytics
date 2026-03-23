import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ gtin: string }> }
) {
    try {
        const { gtin } = await params;

        const product = await prisma.productAllegro.findUnique({
            where: { gtin },
            include: {
                product: true
            }
        });

        if (!product) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(product);
    } catch (error) {
        console.error('Error fetching Allegro product by GTIN:', gtin, error);
        return NextResponse.json(
            { error: 'Failed to fetch product', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
