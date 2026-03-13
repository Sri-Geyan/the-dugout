import { NextRequest, NextResponse } from 'next/server';
import {
    initRetention,
    retainPlayer,
    releasePlayer,
    confirmRetentions,
    autoFinalizeIfExpired,
    getRetentionState,
    getRetainedPlayerIds,
    getRetentionEligiblePool,
} from '@/lib/retentionEngine';
import { initAuction } from '@/lib/auctionEngine';
import { runBotRetentions } from '@/lib/botEngine';
import { getRoomState, updateRoomStatus, fillRoomWithBots } from '@/lib/roomManager';
import prisma from '@/lib/prisma';
import { emitToRoom } from '@/lib/socket-server';

function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try { return JSON.parse(sessionCookie.value); } catch { return null; }
}

// ─── GET — return retention state (with auto-finalize check) ─────────────────
export async function GET(request: NextRequest) {
    try {
        const session = getSession(request);
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const roomCode = searchParams.get('roomCode');
        if (!roomCode) return NextResponse.json({ error: 'roomCode required' }, { status: 400 });

        const state = await autoFinalizeIfExpired(roomCode);

        // Also return the eligible pool for the requesting user's team
        const room = await getRoomState(roomCode);
        const player = room?.players.find(p => p.userId === session.userId);
        const teamName = player?.teamName ?? '';
        const eligiblePool = getRetentionEligiblePool(teamName);

        return NextResponse.json({ state, eligiblePool });
    } catch (error: any) {
        console.error('[Retention GET Error]:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// ─── POST — actions ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const session = getSession(request);
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        let body: { action?: string; roomCode?: string; playerName?: string; playerId?: string };
        try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

        const { action, roomCode, playerName, playerId } = body;
        if (!roomCode) return NextResponse.json({ error: 'roomCode required' }, { status: 400 });

        // ── init (host only) ─────────────────────────────────────────────────────
        if (action === 'init') {
            console.log(`[Retention] Initializing room ${roomCode}`);
            let room = await getRoomState(roomCode);
            if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
            if (room.hostId !== session.userId) {
                return NextResponse.json({ error: 'Only host can start retention' }, { status: 403 });
            }

            // Auto-fill bots to 10 players if needed
            if (room.players.length < 10) {
                const missing = 10 - room.players.length;
                console.log(`[Retention] Auto-filling ${missing} bots for room ${roomCode}`);
                await fillRoomWithBots(roomCode, missing);
                // Refresh room state after adding bots
                const updatedRoom = await getRoomState(roomCode);
                if (updatedRoom) room = updatedRoom;
            }

            const state = await initRetention(roomCode, room.players);
            const updatedStatusRoom = await updateRoomStatus(roomCode, 'RETENTION');
            if (updatedStatusRoom) room = updatedStatusRoom;

            // Run bot retentions immediately
            console.log(`[Retention] Running bot retentions for room ${roomCode}`);
            await runBotRetentions(roomCode);

            console.log(`[Retention] Room ${roomCode} moved to retention phase`);
            emitToRoom(roomCode, 'retention_update', { state });
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ state });
        }

        // ── retain ────────────────────────────────────────────────────────────────
        if (action === 'retain') {
            if (!playerName) return NextResponse.json({ error: 'playerName required' }, { status: 400 });
            const result = await retainPlayer(roomCode, session.userId, playerName);
            if (!result.success) return NextResponse.json({ error: result.error, state: result.state }, { status: 400 });
            emitToRoom(roomCode, 'retention_update', { state: result.state });
            const room = await getRoomState(roomCode);
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ state: result.state });
        }

        // ── release ───────────────────────────────────────────────────────────────
        if (action === 'release') {
            if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });
            const result = await releasePlayer(roomCode, session.userId, playerId);
            if (!result.success) return NextResponse.json({ error: result.error, state: result.state }, { status: 400 });
            emitToRoom(roomCode, 'retention_update', { state: result.state });
            const room = await getRoomState(roomCode);
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ state: result.state });
        }

        // ── confirm ───────────────────────────────────────────────────────────────
        if (action === 'confirm') {
            const result = await confirmRetentions(roomCode, session.userId);
            if (!result.success) return NextResponse.json({ error: result.error, state: result.state }, { status: 400 });
            emitToRoom(roomCode, 'retention_update', { state: result.state });
            const room = await getRoomState(roomCode);
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ state: result.state });
        }

        // ── proceed (host only) — persist DB, init auction ────────────────────────
        if (action === 'proceed') {
            let room = await getRoomState(roomCode);
            if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
            if (room.hostId !== session.userId) {
                return NextResponse.json({ error: 'Only host can proceed to auction' }, { status: 403 });
            }

            const retentionState = await getRetentionState(roomCode);
            if (!retentionState) return NextResponse.json({ error: 'Retention state not found' }, { status: 404 });

            // Persist Retention records to DB
            const dbRoom = await prisma.room.findUnique({ where: { code: roomCode } });
            if (dbRoom) {
                for (const team of retentionState.teams) {
                    for (const r of team.retained) {
                        await prisma.retention.upsert({
                            where: {
                                roomId_playerId: { roomId: dbRoom.id, playerId: r.playerId },
                            },
                            update: {},
                            create: {
                                roomId: dbRoom.id,
                                teamId: team.userId,
                                playerId: r.playerId,
                                playerName: r.playerName,
                                slot: r.slot,
                                cost: r.cost,
                            },
                        });
                    }
                }
            }

            // Init auction excluding retained players
            const excludedIds = await getRetainedPlayerIds(roomCode);
            const enrichedTeams = retentionState.teams.map(t => ({
                userId: t.userId,
                username: t.username,
                teamName: t.teamName,
                purse: t.purse,
                retained: t.retained.map(r => ({
                    playerId: r.playerId,
                    playerName: r.playerName,
                    role: r.role,
                    cost: r.cost
                }))
            }));

            const auctionState = await initAuction(roomCode, enrichedTeams, excludedIds);
            const updatedStatusRoom = await updateRoomStatus(roomCode, 'AUCTION');
            if (updatedStatusRoom) room = updatedStatusRoom;

            emitToRoom(roomCode, 'auction_update', { state: auctionState });
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ auctionState });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('[Retention POST Error]:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
