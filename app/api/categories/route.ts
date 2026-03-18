import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Получаем все категории с количеством элементов
        const categories = await prisma.catalog.groupBy({
            by: ['category'],
            _count: {
                id: true,
            },
            where: {
                category: {
                    not: null,
                },
            },
            orderBy: {
                category: 'asc',
            },
        });

        // Преобразуем результат в нужный формат
        const result = categories.map(category => ({
            name: category.category,
            product_count: category._count.id,
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}