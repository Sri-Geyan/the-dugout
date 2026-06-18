import { NextResponse } from 'next/server';
import { getAllPlayers } from '@/lib/playersDb';

export async function GET() {
    try {
        const players = getAllPlayers();
        return NextResponse.json({ players });
    } catch (error) {
        console.error('Failed to fetch players:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
