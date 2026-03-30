import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить все изменения
export async function GET() {
    try {
        const changes = await prisma.productAllegroChanges.findMany({
            include: {
                product: {
                    select: {
                        name: true,
                        brand: true,
                        category: true,
                    }
                },
                allegroProduct: {
                    select: {
                        price: true,
                        salesQuantity: true,
                    }
                }
            },
            orderBy: {
                gtin: 'asc'
            }
        });

        return NextResponse.json(changes);
    } catch (error) {
        console.error('Error fetching allegro changes:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST - создать новое изменение
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gtin, manualPrice, isDisabled } = body;

        if (!gtin) {
            return NextResponse.json(
                { error: 'GTIN is required' },
                { status: 400 }
            );
        }

        const change = await prisma.productAllegroChanges.create({
            data: {
                gtin,
                manualPrice: manualPrice ? parseFloat(manualPrice) : null,
                isDisabled: isDisabled ?? false,
            },
            include: {
                product: true,
                allegroProduct: true,
            }
        });

        return NextResponse.json(change, { status: 201 });
    } catch (error) {
        console.error('Error creating allegro change:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
