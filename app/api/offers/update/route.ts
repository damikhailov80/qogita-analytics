import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QogitaAPIClient } from '@/lib/qogita-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gtin } = body as { gtin: string };

        if (!gtin) {
            return NextResponse.json(
                { error: 'GTIN is required' },
                { status: 400 }
            );
        }

        // Check if product exists and get productUrl
        const product = await prisma.product.findUnique({
            where: { gtin }
        });

        if (!product) {
            return NextResponse.json(
                { error: `Product with GTIN ${gtin} not found` },
                { status: 404 }
            );
        }

        if (!product.productUrl) {
            return NextResponse.json(
                { error: `Product ${gtin} has no productUrl` },
                { status: 400 }
            );
        }

        // Extract fid and slug from productUrl
        // Example: https://www.qogita.com/products/GmujjRjhcZ/4711-original-eau-de-cologne-bottle-100ml/
        const urlParts = product.productUrl.split('/').filter(p => p);
        if (urlParts.length < 2) {
            return NextResponse.json(
                { error: `Invalid productUrl format: ${product.productUrl}` },
                { status: 400 }
            );
        }

        const fid = urlParts[urlParts.length - 2];
        const slug = urlParts[urlParts.length - 1];

        // Fetch offers from Qogita API
        const qogitaClient = new QogitaAPIClient();
        const offers = await qogitaClient.getVariantOffers(fid, slug);

        if (offers.length === 0) {
            return NextResponse.json({
                success: true,
                gtin,
                message: 'No offers found for this product',
                sellersCreated: 0,
                sellersUpdated: 0,
                offersCreated: 0,
                offersUpdated: 0,
                errors: []
            });
        }

        const results = {
            sellersCreated: 0,
            sellersUpdated: 0,
            offersCreated: 0,
            offersUpdated: 0,
            errors: [] as string[]
        };

        // Process each offer
        for (const offerData of offers) {
            try {
                // Upsert seller
                const seller = await prisma.seller.upsert({
                    where: { code: offerData.seller },
                    create: {
                        code: offerData.seller,
                        minOrderValue: parseFloat(offerData.mov),
                        currency: offerData.movCurrency
                    },
                    update: {
                        minOrderValue: parseFloat(offerData.mov),
                        currency: offerData.movCurrency
                    }
                });

                const isNewSeller = seller.createdAt.getTime() === seller.updatedAt.getTime();
                if (isNewSeller) {
                    results.sellersCreated++;
                } else {
                    results.sellersUpdated++;
                }

                // Upsert offer
                const offer = await prisma.offer.upsert({
                    where: {
                        gtin_sellerCode: {
                            gtin: gtin,
                            sellerCode: offerData.seller
                        }
                    },
                    create: {
                        gtin: gtin,
                        sellerCode: offerData.seller,
                        price: parseFloat(offerData.price),
                        priceCurrency: offerData.priceCurrency,
                        inventory: offerData.inventory
                    },
                    update: {
                        price: parseFloat(offerData.price),
                        priceCurrency: offerData.priceCurrency,
                        inventory: offerData.inventory
                    }
                });

                const isNewOffer = offer.createdAt.getTime() === offer.updatedAt.getTime();
                if (isNewOffer) {
                    results.offersCreated++;
                } else {
                    results.offersUpdated++;
                }
            } catch (error: any) {
                results.errors.push(`Seller ${offerData.seller}: ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            gtin,
            offersFromQogita: offers.length,
            ...results
        });
    } catch (error: any) {
        console.error('[Offers Update] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
