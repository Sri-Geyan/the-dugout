import { NextRequest, NextResponse } from 'next/server';
import {
    initAuction,
    getAuctionState,
    nextPlayer,
    placeBid,
    sellCurrentPlayer,
    skipPlayer,
    skipSet,
    endAuction,
    handleRtm,
    handleBargain,
    handleFinalMatch,
    saveAuctionState,
} from '@/lib/auctionEngine';
import { getRoomState, updateRoomStatus, fillRoomWithBots } from '@/lib/roomManager';
import { TEAM_NAMES } from '@/data/players';
import { IPL_PLAYERS } from '@/data/players';
import { getRetentionState } from '@/lib/retentionEngine';
import { runBotBidding, isBotUser, runBotRtmDecisions, runBotBargainDecisions, runBotFinalMatchDecisions } from '@/lib/botEngine';
import { emitToRoom } from '@/lib/socket-server';

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
        const { action, roomCode, amount, execute } = body;

        if (action === 'init') {
            console.log(`[Auction] Initializing room ${roomCode}`);
            let room = await getRoomState(roomCode);
            if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
            if (room.hostId !== session.userId) {
                return NextResponse.json({ error: 'Only host can start auction' }, { status: 403 });
            }

            // Auto-fill bots to 10 players if needed
            if (room.players.length < 10) {
                const missing = 10 - room.players.length;
                console.log(`[Auction] Auto-filling ${missing} bots for room ${roomCode}`);
                await fillRoomWithBots(roomCode, missing);
                // Refresh room state after adding bots
                const updatedRoom = await getRoomState(roomCode);
                if (updatedRoom) room = updatedRoom;
            }

            // Get retained player IDs to exclude from auction
            const retentionState = await getRetentionState(roomCode);
            const excludePlayerIds: string[] = [];
            if (retentionState) {
                retentionState.teams.forEach(t => t.retained.forEach(r => excludePlayerIds.push(r.playerId)));
            }

            const enrichedTeams = room.players.map((p, i) => {
                const teamRetention = retentionState?.teams.find(t => t.userId === p.userId);
                return {
                    userId: p.userId,
                    username: p.username,
                    teamName: p.teamName || TEAM_NAMES[i % TEAM_NAMES.length],
                    purse: teamRetention?.purse ?? 120,
                    retained: teamRetention?.retained.map(r => ({
                        playerId: r.playerId,
                        playerName: r.playerName,
                        role: r.role,
                        cost: r.cost
                    })) ?? []
                };
            });

            const state = await initAuction(roomCode, enrichedTeams, excludePlayerIds);

            const updatedStatusRoom = await updateRoomStatus(roomCode, 'AUCTION');
            if (updatedStatusRoom) room = updatedStatusRoom;

            console.log(`[Auction] Room ${roomCode} initialized with ${state.totalPlayers} players in sets`);
            emitToRoom(roomCode, 'auction_update', { state });
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ state });
        }

        if (action === 'next') {
            const state = await nextPlayer(roomCode);
            if (!state) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

            // Run bot bidding after presenting new player (Background)
            if (state.status === 'bidding') {
                runBotBidding(roomCode).catch(e => console.error('[Bot Bidding Error]:', e));
            }

            emitToRoom(roomCode, 'auction_update', { state });
            return NextResponse.json({ state });
        }

        if (action === 'bid') {
            const room = await getRoomState(roomCode);
            if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

            const playerIndex = room.players.findIndex(p => p.userId === session.userId);
            const teamName = room.players[playerIndex]?.teamName || TEAM_NAMES[playerIndex % TEAM_NAMES.length];

            const result = await placeBid(roomCode, session.userId, session.username, teamName, amount);
            if (!result.success) {
                return NextResponse.json({ error: result.error, state: result.state }, { status: 400 });
            }

            // Run bot bidding after human bid (Background)
            const state = result.state;
            if (state.status === 'bidding') {
                runBotBidding(roomCode).catch(e => console.error('[Bot Bidding Error]:', e));
            }

            emitToRoom(roomCode, 'auction_update', { state });
            return NextResponse.json({ state });
        }

        if (action === 'sell') {
            const state = await sellCurrentPlayer(roomCode);
            if (state?.rtmPending) {
                runBotRtmDecisions(roomCode).catch(e => console.error('[Bot RTM Error]:', e));
            }
            if (state) emitToRoom(roomCode, 'auction_update', { state });
            return NextResponse.json({ state });
        }

        if (action === 'rtm') {
            const updatedState = await handleRtm(roomCode, execute);
            if (updatedState?.rtmState === 'bargain') {
                runBotBargainDecisions(roomCode).catch(e => console.error('[Bot Bargain Error]:', e));
            }
            if (updatedState?.rtmState === 'final_match') {
                runBotFinalMatchDecisions(roomCode).catch(e => console.error('[Bot Final Match Error]:', e));
            }
            if (updatedState) emitToRoom(roomCode, 'auction_update', { state: updatedState });
            return NextResponse.json({ state: updatedState });
        }

        if (action === 'bargain') {
            const state = await getAuctionState(roomCode);
            if (!state || state.rtmState !== 'bargain') {
                return NextResponse.json({ error: 'Bargain not pending' }, { status: 400 });
            }
            if (state.currentBidder?.userId !== session.userId) {
                return NextResponse.json({ error: 'Only the highest bidder can bargain' }, { status: 403 });
            }

            const updatedState = await handleBargain(roomCode, amount);
            if (updatedState?.rtmState === 'final_match') {
                runBotFinalMatchDecisions(roomCode).catch(e => console.error('[Bot Final Match Error]:', e));
            }
            if (updatedState) emitToRoom(roomCode, 'auction_update', { state: updatedState });
            return NextResponse.json({ state: updatedState });
        }

        if (action === 'finalMatch') {
            const state = await getAuctionState(roomCode);
            if (!state || state.rtmState !== 'final_match') {
                return NextResponse.json({ error: 'Final match not pending' }, { status: 400 });
            }
            if (state.rtmOriginalTeamId !== session.userId) {
                return NextResponse.json({ error: 'Only the original team owner can match finally' }, { status: 403 });
            }

            const updatedState = await handleFinalMatch(roomCode, execute);
            if (updatedState) emitToRoom(roomCode, 'auction_update', { state: updatedState });
            return NextResponse.json({ state: updatedState });
        }

        if (action === 'status') {
            const state = await getAuctionState(roomCode);
            return NextResponse.json({ state });
        }

        // Host overrides
        if (action === 'skipPlayer') {
            const room = await getRoomState(roomCode);
            if (!room || room.hostId !== session.userId) return NextResponse.json({ error: 'Host only' }, { status: 403 });
            const state = await skipPlayer(roomCode);
            if (state) emitToRoom(roomCode, 'auction_update', { state });
            return NextResponse.json({ state });
        }
        if (action === 'skipSet') {
            const room = await getRoomState(roomCode);
            if (!room || room.hostId !== session.userId) return NextResponse.json({ error: 'Host only' }, { status: 403 });
            const state = await skipSet(roomCode);
            if (state) emitToRoom(roomCode, 'auction_update', { state });
            return NextResponse.json({ state });
        }
        if (action === 'endAuction') {
            const room = await getRoomState(roomCode);
            if (!room || room.hostId !== session.userId) return NextResponse.json({ error: 'Host only' }, { status: 403 });
            const state = await endAuction(roomCode);
            if (state) emitToRoom(roomCode, 'auction_update', { state });
            return NextResponse.json({ state });
        }

        if (action === 'save') {
            const { state: newState } = body;
            const room = await getRoomState(roomCode);
            if (!room || room.hostId !== session.userId) return NextResponse.json({ error: 'Host only' }, { status: 403 });
            await saveAuctionState(roomCode, newState);
            return NextResponse.json({ success: true, state: newState });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('[Auction POST Error]:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = getSession(request);
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const roomCode = searchParams.get('roomCode');
        if (!roomCode) return NextResponse.json({ error: 'Room code required' }, { status: 400 });

        const state = await getAuctionState(roomCode);
        return NextResponse.json({ state });
    } catch (error: any) {
        console.error('[Auction GET Error]:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

