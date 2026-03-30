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

        // Для сортировки по полям из changes нужен другой подход
        let products;

        if (sortField === 'manualPrice' || sortField === 'isDisabled') {
            // Получаем все продукты без пагинации для сортировки
            const allProducts = await prisma.productAllegro.findMany({
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
            });

            // Сортируем в памяти
            allProducts.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortField === 'manualPrice') {
                    aValue = a.changes?.manualPrice ?? null;
                    bValue = b.changes?.manualPrice ?? null;
                } else if (sortField === 'isDisabled') {
                    aValue = a.changes?.isDisabled ?? false;
                    bValue = b.changes?.isDisabled ?? false;
                }

                // Обработка null значений - они всегда в конце
                if (aValue === null && bValue === null) return 0;
                if (aValue === null) return 1;
                if (bValue === null) return -1;

                // Сравнение значений
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });

            // Применяем пагинацию после сортировки
            products = allProducts.slice(skip, skip + pageSize);
        } else {
            // Обычная сортировка по полям ProductAllegro
            products = await prisma.productAllegro.findMany({
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
                orderBy: {
                    [sortField]: sortOrder,
                },
                skip,
                take: pageSize,
            });
        }

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
