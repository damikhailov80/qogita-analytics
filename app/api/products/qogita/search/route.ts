import { NextRequest, NextResponse } from 'next/server';
import { handleProductSearch, DEFAULT_PAGE_SIZE, type ProductSearchParams } from '../lib';

// POST метод - параметры из body
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const params: ProductSearchParams = {
            page: body.page || '1',
            pageSize: body.pageSize || String(DEFAULT_PAGE_SIZE),
            sortField: body.sortField || 'id',
            sortOrder: body.sortOrder || 'asc',
            whitelist: Array.isArray(body.whitelist) ? body.whitelist : [],
            blacklist: Array.isArray(body.blacklist) ? body.blacklist : [],
            categoryWhitelist: Array.isArray(body.categoryWhitelist) ? body.categoryWhitelist : [],
            categoryBlacklist: Array.isArray(body.categoryBlacklist) ? body.categoryBlacklist : [],
        };

        return await handleProductSearch(params);
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
