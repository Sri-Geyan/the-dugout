import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, updateRoomStatus } from '@/lib/roomManager';
import redis from '@/lib/redis';

function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try { return JSON.parse(sessionCookie.value); } catch { return null; }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { code } = await params;
    const room = await getRoomState(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    return NextResponse.json({ room });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { code } = await params;
    const room = await getRoomState(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const body = await request.json();

    // Handle team selection (any player can select)
    if (body.action === 'selectTeam') {
        const player = room.players.find(p => p.userId === session.userId);
        if (!player) return NextResponse.json({ error: 'Player not in room' }, { status: 403 });

        // Check if team is already taken by another player
        const teamTaken = room.players.some(p => p.teamId === body.teamId && p.userId !== session.userId);
        if (teamTaken) return NextResponse.json({ error: 'Team already taken' }, { status: 400 });

        player.teamId = body.teamId;
        player.teamName = body.teamName;
        await redis.set(`room:${code}`, JSON.stringify(room), 'EX', 86400);
        return NextResponse.json({ room });
    }

    // Handle status update (host only)
    if (body.status) {
        if (room.hostId !== session.userId) {
            return NextResponse.json({ error: 'Only host can update room' }, { status: 403 });
        }
        const updated = await updateRoomStatus(code, body.status);
        return NextResponse.json({ room: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
