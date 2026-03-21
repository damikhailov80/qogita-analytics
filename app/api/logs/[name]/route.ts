import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ name: string }> }
) {
    try {
        const { name } = await params;

        // Валидация имени воркера
        const validWorkerTypes = ['allegro', 'qogita', 'offers-updateall'];
        if (!validWorkerTypes.includes(name)) {
            return NextResponse.json(
                { error: 'Invalid worker type' },
                { status: 400 }
            );
        }

        const workerTypeMap: Record<string, string> = {
            'allegro': 'allegro-upload',
            'qogita': 'qogita-update',
            'offers-updateall': 'offers-updateall'
        };

        const workerType = workerTypeMap[name];

        const logs = await prisma.workerLog.findMany({
            where: {
                workerType
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10
        });

        return NextResponse.json(logs);
    } catch (error) {
        console.error('[Logs API] Error fetching logs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logs' },
            { status: 500 }
        );
    }
}
