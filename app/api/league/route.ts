import { NextRequest, NextResponse } from 'next/server';
import {
    initLeagueState,
    getLeagueState,
    saveLeagueState,
    updateStandings,
    updatePlayerStats,
    validateSquads,
    processMatchResult,
    LeagueTeam,
    MatchResult,
} from '@/lib/leagueEngine';
import { getAuctionState } from '@/lib/auctionEngine';
import { updateRoomStatus } from '@/lib/roomManager';
import { emitToRoom } from '@/lib/socket-server';

function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try { return JSON.parse(sessionCookie.value); } catch { return null; }
}

// GET: Retrieve league state
export async function GET(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    if (!roomCode) return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });

    const state = await getLeagueState(roomCode);
    return NextResponse.json({ state });
}

// POST: League actions
export async function POST(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const body = await request.json();
        const { action, roomCode } = body;

        if (!roomCode) return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });

        // ─── INIT: Transition from selection to league ───
        if (action === 'init') {
            // Check if league already exists
            const existing = await getLeagueState(roomCode);
            if (existing) {
                return NextResponse.json({ state: existing });
            }

            // Get auction state for squads
            const auctionState = await getAuctionState(roomCode);
            if (!auctionState || !auctionState.teams || auctionState.teams.length < 2) {
                return NextResponse.json({ error: 'Not enough teams from auction' }, { status: 400 });
            }

            // Convert auction teams to league teams
            const teams: LeagueTeam[] = auctionState.teams.map(t => {
                const retainedIds = new Set(t.retained?.map(r => r.playerId) || []);
                return {
                    userId: t.userId,
                    username: t.username,
                    teamName: t.teamName,
                    teamId: (t as any).teamId,
                    squad: t.squad.map(s => ({
                        player: {
                            ...s.player,
                            retained: retainedIds.has(s.player.id),
                        },
                        soldPrice: s.soldPrice,
                    })),
                };
            });

            // Validate squads
            const validation = validateSquads(teams);
            if (!validation.valid) {
                return NextResponse.json({
                    error: 'Squad validation failed',
                    details: validation.errors
                }, { status: 400 });
            }

            // Initialize league
            const state = initLeagueState(roomCode, teams);
            await saveLeagueState(state);

            // Update room status to 'LEAGUE'
            const room = await updateRoomStatus(roomCode, 'LEAGUE');

            emitToRoom(roomCode, 'league_update', { state });
            if (room) emitToRoom(roomCode, 'room_update', { room });
            return NextResponse.json({ state });
        }

        // ─── START MATCH: Begin the next fixture ───
        if (action === 'startMatch') {
            const state = await getLeagueState(roomCode);
            if (!state) return NextResponse.json({ error: 'League not found' }, { status: 404 });

            const fixtureIndex = body.fixtureIndex ?? state.currentMatchIndex;
            const fixture = state.fixtures[fixtureIndex];
            if (!fixture) return NextResponse.json({ error: 'No more fixtures' }, { status: 400 });

            if (fixture.status !== 'pending') {
                return NextResponse.json({ error: 'Fixture already played or in progress' }, { status: 400 });
            }

            // Mark fixture as pre_match
            fixture.status = 'pre_match';
            state.currentMatchIndex = fixtureIndex;
            await saveLeagueState(state);

            // Auto-select playing 11 for bot teams
            try {
                const { getAuctionState } = await import('@/lib/auctionEngine');
                const { isBotUser, botSelectPlaying11 } = await import('@/lib/botEngine');
                const { getRoomState } = await import('@/lib/roomManager');
                const redisObj = (await import('@/lib/redis')).default;

                const auction = await getAuctionState(roomCode);
                const room = await getRoomState(roomCode);

                if (auction && room) {
                    const teamsToCheck = [fixture.homeTeamUserId, fixture.awayTeamUserId];

                    for (const uId of teamsToCheck) {
                        const roomPlayer = room.players.find(p => p.userId === uId);
                        if (roomPlayer && isBotUser(roomPlayer.username)) {
                            const teamData = auction.teams.find(t => t.userId === uId);
                            if (teamData) {
                                const squad = teamData.squad.map(s => ({
                                    id: s.player.id,
                                    name: s.player.name,
                                    role: s.player.role,
                                    battingSkill: s.player.battingSkill,
                                    bowlingSkill: s.player.bowlingSkill,
                                    nationality: s.player.nationality,
                                }));
                                const selection = botSelectPlaying11(squad);
                                const key = `selection:${roomCode}:${fixture.id}:${uId}`;
                                await redisObj.set(key, JSON.stringify(selection), 'EX', 86400);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed auto-selecting bots:", err);
            }

            emitToRoom(roomCode, 'league_update', { state });
            emitToRoom(roomCode, 'match_started', { 
                fixture, 
                homeTeamUserId: fixture.homeTeamUserId, 
                awayTeamUserId: fixture.awayTeamUserId 
            });

            return NextResponse.json({
                state,
                fixture,
                homeTeamUserId: fixture.homeTeamUserId,
                awayTeamUserId: fixture.awayTeamUserId,
            });
        }

        // ─── LOCK PRE-MATCH: Move from selection to live match ───
        if (action === 'lockPreMatch') {
            const state = await getLeagueState(roomCode);
            if (!state) return NextResponse.json({ error: 'League not found' }, { status: 404 });

            const { fixtureId, matchId } = body;
            const fixture = state.fixtures.find(f => f.id === fixtureId);
            if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });

            if (fixture.status !== 'pre_match') {
                return NextResponse.json({ error: 'Fixture not in pre-match state' }, { status: 400 });
            }

            fixture.status = 'live';
            fixture.matchId = matchId || fixtureId; // Assign the matchId used to init MatchState
            await saveLeagueState(state);

            emitToRoom(roomCode, 'league_update', { state });
            return NextResponse.json({ state, fixture });
        }

        // ─── COMPLETE MATCH: Record results ───
        if (action === 'completeMatch') {
            const state = await getLeagueState(roomCode);
            if (!state) return NextResponse.json({ error: 'League not found' }, { status: 404 });

            const matchResult: MatchResult = body.matchResult;
            if (!matchResult) return NextResponse.json({ error: 'matchResult required' }, { status: 400 });

            // Find and update the fixture
            const fixtureIndex = body.fixtureIndex ?? state.currentMatchIndex;
            const fixture = state.fixtures[fixtureIndex];
            if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });

            if (fixture.status === 'completed') {
                return NextResponse.json({ error: 'Match result already processed', state }, { status: 400 });
            }

            fixture.status = 'completed';
            fixture.matchId = body.matchId;
            fixture.homeScore = matchResult.homeScore;
            fixture.homeWickets = matchResult.homeWickets;
            fixture.homeOvers = matchResult.homeOvers;
            fixture.awayScore = matchResult.awayScore;
            fixture.awayWickets = matchResult.awayWickets;
            fixture.awayOvers = matchResult.awayOvers;
            fixture.result = matchResult.result;

            // Process match result (updates standings, player stats, and handles playoffs)
            processMatchResult(state, fixture, matchResult);

            await saveLeagueState(state);

            emitToRoom(roomCode, 'league_update', { state });
            return NextResponse.json({ state });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('League API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
