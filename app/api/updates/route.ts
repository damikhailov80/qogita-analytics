import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const updates = await prisma.update.findMany({
            orderBy: {
                updatedAt: 'desc'
            }
        })

        return NextResponse.json(updates)
    } catch (error) {
        console.error('Error fetching updates:', error)
        return NextResponse.json(
            { error: 'Failed to fetch updates' },
            { status: 500 }
        )
    }
}
