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
    categoryWhitelist?: string[];
    categoryBlacklist?: string[];
    onlyAllegro?: boolean;
}

export interface ProductFilterParams {
    whitelist: string[];
    blacklist: string[];
    categoryWhitelist?: string[];
    categoryBlacklist?: string[];
}

export { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE };

// Общая функция для создания условий фильтрации
export function buildWhereCondition(params: ProductFilterParams): Prisma.ProductWhereInput {
    const whereCondition: Prisma.ProductWhereInput = {};

    const whiteListBrands = params.whitelist || [];
    const blackListBrands = params.blacklist || [];
    const whiteListCategories = params.categoryWhitelist || [];
    const blackListCategories = params.categoryBlacklist || [];

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

    // Применяем фильтры по категориям
    if (whiteListCategories.length > 0 && blackListCategories.length > 0) {
        whereCondition.category = {
            in: whiteListCategories,
            notIn: blackListCategories,
        };
    } else if (whiteListCategories.length > 0) {
        whereCondition.category = {
            in: whiteListCategories,
        };
    } else if (blackListCategories.length > 0) {
        whereCondition.category = {
            notIn: blackListCategories,
        };
    }

    return whereCondition;
}

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

    // Получаем фильтры по категориям
    const whiteListCategories = params.categoryWhitelist || [];
    const blackListCategories = params.categoryBlacklist || [];

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

    // Создаем условие фильтрации используя общую функцию
    const whereCondition = buildWhereCondition({
        whitelist: params.whitelist,
        blacklist: params.blacklist,
        categoryWhitelist: params.categoryWhitelist,
        categoryBlacklist: params.categoryBlacklist,
    });

    // Если нужны только продукты из Allegro, получаем список GTIN
    if (params.onlyAllegro) {
        const allegroProducts = await prisma.productAllegro.findMany({
            select: { gtin: true },
        });
        const allegroGtins = allegroProducts.map(p => p.gtin);

        if (allegroGtins.length > 0) {
            whereCondition.gtin = {
                in: allegroGtins,
            };
        } else {
            // Если нет продуктов в Allegro, возвращаем пустой результат
            return NextResponse.json({
                data: [],
                pagination: {
                    page,
                    pageSize,
                    totalCount: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
                sort: {
                    field: sortField,
                    order: sortOrder,
                },
                filters: {
                    brands: {
                        whitelist: whiteListBrands,
                        blacklist: blackListBrands,
                    },
                    categories: {
                        whitelist: whiteListCategories,
                        blacklist: blackListCategories,
                    },
                    onlyAllegro: params.onlyAllegro,
                },
            });
        }
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
        filters: {
            brands: {
                whitelist: whiteListBrands,
                blacklist: blackListBrands,
            },
            categories: {
                whitelist: whiteListCategories,
                blacklist: blackListCategories,
            },
            onlyAllegro: params.onlyAllegro || false,
        },
    });
}
