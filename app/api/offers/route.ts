import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gtin = searchParams.get('gtin');

        if (!gtin) {
            return NextResponse.json(
                { error: 'GTIN parameter is required' },
                { status: 400 }
            );
        }

        // Check if product exists
        const product = await prisma.product.findUnique({
            where: { gtin }
        });

        if (!product) {
            return NextResponse.json(
                { error: `Product with GTIN ${gtin} not found` },
                { status: 404 }
            );
        }

        // Get all offers for this product with seller information
        const offers = await prisma.offer.findMany({
            where: { gtin },
            include: {
                seller: true
            },
            orderBy: {
                price: 'asc'
            }
        });

        return NextResponse.json({
            gtin,
            product: {
                name: product.name,
                brand: product.brand,
                category: product.category,
                imageUrl: product.imageUrl
            },
            offersCount: offers.length,
            offers: offers.map(offer => ({
                id: offer.id,
                price: offer.price,
                priceCurrency: offer.priceCurrency,
                inventory: offer.inventory,
                seller: {
                    code: offer.seller.code,
                    minOrderValue: offer.seller.minOrderValue,
                    currency: offer.seller.currency
                },
                updatedAt: offer.updatedAt
            }))
        });
    } catch (error: any) {
        console.error('[Offers] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
