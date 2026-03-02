import { NextRequest, NextResponse } from 'next/server';
import { createRoom, joinRoom, getUserRooms } from '@/lib/roomManager';

function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try { return JSON.parse(sessionCookie.value); } catch { return null; }
}

export async function POST(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const body = await request.json();
        const { action, code } = body;

        if (action === 'create') {
            const room = await createRoom(session.userId, session.username);
            return NextResponse.json({ room });
        }

        if (action === 'join') {
            if (!code) return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
            const room = await joinRoom(code.toUpperCase(), session.userId, session.username);
            if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
            return NextResponse.json({ room });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function GET(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const rooms = await getUserRooms(session.userId);
        return NextResponse.json({ rooms });
    } catch (error) {
        console.error('Get rooms error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
