import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';
import prisma from '@/lib/prisma';
import { getRoomState, updateRoomStatus, updatePlayerTeam } from '@/lib/roomManager';
import { emitToRoom } from '@/lib/socket-server';

function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try { return JSON.parse(sessionCookie.value); } catch { return null; }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    const { code } = await params;
    try {
        const room = await getRoomState(code);
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        return NextResponse.json({ room });
    } catch (error) {
        console.error('Fetch room error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { code } = await params;
    try {
        const body = await request.json();
        const { action, status, teamId, teamName } = body;

        if (action === 'selectTeam') {
            const updated = await updatePlayerTeam(code, session.userId, teamId, teamName);
            if (updated) emitToRoom(code, 'room_update', { room: updated });
            return NextResponse.json({ room: updated });
        }

        if (status) {
            // Verify host
            const room = await getRoomState(code);
            if (room?.hostId !== session.userId) {
                return NextResponse.json({ error: 'Only host can change status' }, { status: 0x193 });
            }
            const updated = await updateRoomStatus(code, status);
            if (updated) emitToRoom(code, 'room_update', { room: updated });
            return NextResponse.json({ room: updated });
        }

        return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    } catch (error) {
        console.error('Update room error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { code } = await params;

    try {
        const dbRoom = await prisma.room.findUnique({
            where: { code },
        });

        if (!dbRoom) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        if (dbRoom.hostId !== session.userId) {
            return NextResponse.json({ error: 'Only host can delete room' }, { status: 403 });
        }

        // Delete from Redis
        await redis.del(`room:${code}`);
        await redis.del(`retention:${code}`);
        await redis.del(`auction:${code}`);
        await redis.del(`selection:${code}`);
        await redis.del(`league:${code}`);
        // match state is usually temporary but good to purge prefix if exists
        const matchKeys = await redis.keys(`match:${code}*`);
        if (matchKeys.length > 0) await redis.del(...matchKeys);

        // Delete from DB (cascades should handle RoomPlayer, Retention, etc.)
        await prisma.room.delete({
            where: { code },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete room error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
