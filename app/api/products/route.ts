import { NextRequest, NextResponse } from 'next/server';
import { handleProductSearch, DEFAULT_PAGE_SIZE, type ProductSearchParams } from './lib';

// GET метод - параметры из query string
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const whitelistParam = searchParams.get('whitelist');
        const blacklistParam = searchParams.get('blacklist');

        const params: ProductSearchParams = {
            page: searchParams.get('page') || '1',
            pageSize: searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE),
            sortField: searchParams.get('sortField') || 'id',
            sortOrder: searchParams.get('sortOrder') || 'asc',
            whitelist: whitelistParam ? whitelistParam.split(',').filter(Boolean) : [],
            blacklist: blacklistParam ? blacklistParam.split(',').filter(Boolean) : [],
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
