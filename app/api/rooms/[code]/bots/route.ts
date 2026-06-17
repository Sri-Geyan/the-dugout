import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRoomState, fillRoomWithBots } from '@/lib/roomManager';


export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const cookieStore = await cookies();
        const session = cookieStore.get('session');
        if (!session?.value) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { userId } = JSON.parse(session.value);

        // Verify user is host
        const room = await getRoomState(code);
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }
        if (room.hostId !== userId) {
            return NextResponse.json({ error: 'Only the host can add bots' }, { status: 403 });
        }

        const body = await request.json();
        const count = Math.min(body.count || 2, room.maxPlayers - room.players.length);

        if (count <= 0) {
            return NextResponse.json({ error: 'Room is full' }, { status: 400 });
        }

        const addedBots = await fillRoomWithBots(code, count);
        const finalState = await getRoomState(code);
        
        const { emitToRoom } = await import('@/lib/socket-server');
        emitToRoom(code, 'room_update', { room: finalState });
        
        return NextResponse.json({ room: finalState, addedBots });
    } catch (error) {
        console.error('Add bots error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to add bots' },
            { status: 500 }
        );
    }
}
