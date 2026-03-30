import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить изменение по GTIN
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ gtin: string }> }
) {
    try {
        const { gtin } = await params;

        const change = await prisma.productAllegroChanges.findUnique({
            where: { gtin },
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
            }
        });

        if (!change) {
            return NextResponse.json(
                { error: 'Change not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(change);
    } catch (error) {
        console.error('Error fetching allegro change:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH - обновить изменение
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ gtin: string }> }
) {
    try {
        const { gtin } = await params;
        const body = await request.json();
        const { manualPrice, isDisabled } = body;

        const updateData: {
            manualPrice?: number | null;
            isDisabled?: boolean;
        } = {};

        if (manualPrice !== undefined) {
            updateData.manualPrice = manualPrice ? parseFloat(manualPrice) : null;
        }
        if (isDisabled !== undefined) {
            updateData.isDisabled = isDisabled;
        }

        const change = await prisma.productAllegroChanges.update({
            where: { gtin },
            data: updateData,
            include: {
                product: true,
                allegroProduct: true,
            }
        });

        return NextResponse.json(change);
    } catch (error) {
        console.error('Error updating allegro change:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT - создать или полностью заменить изменение
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ gtin: string }> }
) {
    try {
        const { gtin } = await params;
        const body = await request.json();
        const { manualPrice, isDisabled } = body;

        const change = await prisma.productAllegroChanges.upsert({
            where: { gtin },
            create: {
                gtin,
                manualPrice: manualPrice ? parseFloat(manualPrice) : null,
                isDisabled: isDisabled ?? false,
            },
            update: {
                manualPrice: manualPrice ? parseFloat(manualPrice) : null,
                isDisabled: isDisabled ?? false,
            },
            include: {
                product: true,
                allegroProduct: true,
            }
        });

        return NextResponse.json(change);
    } catch (error) {
        console.error('Error upserting allegro change:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE - удалить изменение
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ gtin: string }> }
) {
    try {
        const { gtin } = await params;

        await prisma.productAllegroChanges.delete({
            where: { gtin }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting allegro change:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
