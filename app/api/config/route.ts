import { NextResponse } from 'next/server';
import { getPlnToEurRate } from '@/lib/currency';

export async function GET() {
    try {
        const plnToEurRate = getPlnToEurRate();

        return NextResponse.json({
            plnToEurRate,
        });
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
