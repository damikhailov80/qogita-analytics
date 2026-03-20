import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Получаем все бренды с количеством элементов
        const brands = await prisma.product.groupBy({
            by: ['brand'],
            _count: {
                id: true,
            },
            where: {
                brand: {
                    not: null,
                },
            },
            orderBy: {
                brand: 'asc',
            },
        });

        // Преобразуем результат в нужный формат
        const result = brands.map(brand => ({
            name: brand.brand,
            product_count: brand._count.id,
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching brands:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}