import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '20');
        const gtin = searchParams.get('gtin') || '';
        const sortField = searchParams.get('sortField') || 'gtin';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        const skip = (page - 1) * pageSize;

        // Фильтр по GTIN
        const where = gtin ? {
            gtin: {
                contains: gtin,
            }
        } : {};

        // Получаем общее количество
        const totalCount = await prisma.productAllegro.count({ where });

        // Определяем сортировку
        let orderBy: any = {};

        if (sortField === 'manualPrice') {
            // Сортировка по manual_price из таблицы changes
            orderBy = {
                changes: {
                    manualPrice: sortOrder,
                }
            };
        } else if (sortField === 'isDisabled') {
            // Сортировка по is_disabled из таблицы changes
            orderBy = {
                changes: {
                    isDisabled: sortOrder,
                }
            };
        } else {
            // Обычная сортировка по полям ProductAllegro
            orderBy = {
                [sortField]: sortOrder,
            };
        }

        // Получаем данные с пагинацией
        const products = await prisma.productAllegro.findMany({
            where,
            include: {
                product: {
                    select: {
                        name: true,
                        brand: true,
                        category: true,
                        imageUrl: true,
                    }
                },
                changes: true,
            },
            orderBy,
            skip,
            take: pageSize,
        });

        const totalPages = Math.ceil(totalCount / pageSize);

        return NextResponse.json({
            data: products,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            }
        });
    } catch (error) {
        console.error('Error fetching Allegro products:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
