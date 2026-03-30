import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const plnToEurRate = parseFloat(process.env.PLN_TO_EUR_RATE || '4.5');

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
