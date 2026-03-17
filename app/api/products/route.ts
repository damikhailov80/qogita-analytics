import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

// Все поля модели Product доступны для сортировки
type SortField = keyof Prisma.ProductOrderByWithRelationInput;
type SortOrder = 'asc' | 'desc';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        // Получаем параметры из query string
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)))
        );
        const sortField = (searchParams.get('sortField') || 'id') as SortField;
        const sortOrder = (searchParams.get('sortOrder') || 'asc') as SortOrder;

        // Валидация поля сортировки - проверяем что это валидное поле Product
        const validSortFields = Object.keys(prisma.product.fields);

        if (sortField && !validSortFields.includes(sortField as string)) {
            return NextResponse.json(
                { error: `Invalid sort field. Available fields: ${validSortFields.join(', ')}` },
                { status: 400 }
            );
        }

        // Валидация порядка сортировки
        if (sortOrder !== 'asc' && sortOrder !== 'desc') {
            return NextResponse.json(
                { error: 'Invalid sort order. Use "asc" or "desc"' },
                { status: 400 }
            );
        }

        // Подсчет общего количества продуктов
        const totalCount = await prisma.product.count();
        const totalPages = Math.ceil(totalCount / pageSize);

        // Получение продуктов с пагинацией и сортировкой
        const products = await prisma.product.findMany({
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: {
                [sortField]: sortOrder,
            },
        });

        return NextResponse.json({
            data: products,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
            sort: {
                field: sortField,
                order: sortOrder,
            },
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
