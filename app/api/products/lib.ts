import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

type SortField = keyof Prisma.ProductOrderByWithRelationInput;
type SortOrder = 'asc' | 'desc';

export interface ProductSearchParams {
    page: string;
    pageSize: string;
    sortField: string;
    sortOrder: string;
    whitelist: string[];
    blacklist: string[];
}

export { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE };

// Общая функция для обработки запросов продуктов
export async function handleProductSearch(params: ProductSearchParams) {
    // Получаем параметры
    const page = Math.max(1, parseInt(params.page || '1'));
    const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, parseInt(params.pageSize || String(DEFAULT_PAGE_SIZE)))
    );
    const sortField = (params.sortField || 'id') as SortField;
    const sortOrder = (params.sortOrder || 'asc') as SortOrder;

    // Получаем фильтры по брендам
    const whiteListBrands = params.whitelist || [];
    const blackListBrands = params.blacklist || [];

    // Валидация поля сортировки
    const validSortFields = [
        'id', 'gtin', 'name', 'category', 'brand', 'lowestPrice',
        'unit', 'lowestPricedOfferInventory', 'isPreOrder',
        'estimatedDeliveryTimeWeeks', 'numberOfOffers',
        'totalInventoryAllOffers', 'productUrl', 'imageUrl'
    ];

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

    // Создаем условие фильтрации
    const whereCondition: Prisma.ProductWhereInput = {};

    // Применяем фильтры по брендам
    if (whiteListBrands.length > 0 && blackListBrands.length > 0) {
        whereCondition.brand = {
            in: whiteListBrands,
            notIn: blackListBrands,
        };
    } else if (whiteListBrands.length > 0) {
        whereCondition.brand = {
            in: whiteListBrands,
        };
    } else if (blackListBrands.length > 0) {
        whereCondition.brand = {
            notIn: blackListBrands,
        };
    }

    // Подсчет общего количества продуктов с учетом фильтров
    const totalCount = await prisma.product.count({
        where: whereCondition,
    });
    const totalPages = Math.ceil(totalCount / pageSize);

    // Получение продуктов с пагинацией, сортировкой и фильтрацией
    const products = await prisma.product.findMany({
        where: whereCondition,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
            [sortField]: sortOrder,
        },
    });

    // Преобразуем lowestPrice в lowestPriceIncShipping для совместимости с фронтендом
    const productsWithPrice = products.map(product => ({
        ...product,
        lowestPriceIncShipping: product.lowestPrice,
    }));

    return NextResponse.json({
        data: productsWithPrice,
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
        filters: {
            whitelist: whiteListBrands,
            blacklist: blackListBrands,
        },
    });
}
