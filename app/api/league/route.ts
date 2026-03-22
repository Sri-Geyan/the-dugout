import { NextRequest, NextResponse } from 'next/server';
import {
    initLeagueState,
    getLeagueState,
    saveLeagueState,
    updateStandings,
    updatePlayerStats,
    validateSquads,
    processMatchResult,
    syncMatchToLeague,
    LeagueTeam,
    MatchResult,
} from '@/lib/leagueEngine';
import { getAuctionState } from '@/lib/auctionEngine';
import { updateRoomStatus, getRoomState } from '@/lib/roomManager';
import { emitToRoom } from '@/lib/socket-server';
import { 
    initMatchState, 
    performToss, 
    processNextBall, 
    MatchState 
} from '@/lib/matchEngine';
import { 
    botTossDecision, 
    botChooseNextBatter, 
    botChooseNextBowler, 
    isBotUser,
    botSelectPlaying11
} from '@/lib/botEngine';
import redis from '@/lib/redis';
import { getPitchProfile } from '@/lib/pitchData';

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
    const room = await getRoomState(roomCode);
    return NextResponse.json({ state, hostId: room?.hostId });
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

        // ─── SIMULATE MATCH: Auto-play to completion ───
        if (action === 'simulateMatch') {
            const league = await getLeagueState(roomCode);
            if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

            const { fixtureId } = body;
            const fixture = league.fixtures.find(f => f.id === fixtureId);
            if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });

            if (fixture.status === 'completed') {
                return NextResponse.json({ error: 'Match already completed' }, { status: 400 });
            }

            let matchState: MatchState | null = null;

            // 1. Prepare Match State
            if (fixture.status === 'pending') {
                // Similar to startMatch logic
                fixture.status = 'pre_match';
                league.currentMatchIndex = league.fixtures.indexOf(fixture);
                
                // Auto-select bots if needed
                const auction = await getAuctionState(roomCode);
                const room = await getRoomState(roomCode);
                if (auction && room) {
                    const teamsToSelect = [fixture.homeTeamUserId, fixture.awayTeamUserId];
                    for (const uId of teamsToSelect) {
                        const selKey = `selection:${roomCode}:${fixtureId}:${uId}`;
                        const existingSel = await redis.get(selKey);
                        if (!existingSel) {
                            const teamData = auction.teams.find(t => t.userId === uId);
                            if (teamData) {
                                const squad = teamData.squad.map(s => ({
                                    id: s.player.id, name: s.player.name, role: s.player.role,
                                    battingSkill: s.player.battingSkill, bowlingSkill: s.player.bowlingSkill,
                                    nationality: s.player.nationality
                                }));
                                const selection = botSelectPlaying11(squad);
                                await redis.set(selKey, JSON.stringify(selection), 'EX', 86400);
                            }
                        }
                    }
                }
            }

            if (fixture.status === 'pre_match' || !fixture.matchId) {
                // Initialize MatchState
                const matchId = fixture.matchId || fixtureId;
                const auction = await getAuctionState(roomCode);
                if (!auction) return NextResponse.json({ error: 'Auction data missing' }, { status: 404 });

                const hUser = auction.teams.find(t => t.userId === fixture.homeTeamUserId);
                const aUser = auction.teams.find(t => t.userId === fixture.awayTeamUserId);
                if (!hUser || !aUser) return NextResponse.json({ error: 'Teams missing' }, { status: 404 });

                const hSelKey = `selection:${roomCode}:${fixtureId}:${fixture.homeTeamUserId}`;
                const aSelKey = `selection:${roomCode}:${fixtureId}:${fixture.awayTeamUserId}`;
                const hSel = JSON.parse((await redis.get(hSelKey)) || '{}');
                const aSel = JSON.parse((await redis.get(aSelKey)) || '{}');

                const homeTeamMatch = {
                    teamId: hUser.userId, name: hUser.teamName, userId: hUser.userId,
                    score: 0, wickets: 0, overs: 0, balls: 0, extras: 0, 
                    extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
                    fow: [], runRate: 0, players: hUser.squad.map(s => ({ ...s.player }))
                };
                const awayTeamMatch = {
                    teamId: aUser.userId, name: aUser.teamName, userId: aUser.userId,
                    score: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
                    extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
                    fow: [], runRate: 0, players: aUser.squad.map(s => ({ ...s.player }))
                };

                const pitchProf = getPitchProfile(hUser.teamName);
                const pitchType = (pitchProf?.pitchType || 'BALANCED') as any;

                const toss = performToss(homeTeamMatch, awayTeamMatch);
                toss.decision = botTossDecision(pitchType);

                matchState = initMatchState(matchId, roomCode, homeTeamMatch, awayTeamMatch, pitchType, {
                    tossResult: toss,
                    homeBattingOrder: hSel.battingOrder || hSel.selectedIds,
                    awayBattingOrder: aSel.battingOrder || aSel.selectedIds,
                    homeCaptainId: hSel.captainId,
                    awayCaptainId: aSel.captainId,
                    homeWkId: hSel.wkId,
                    awayWkId: aSel.wkId,
                    homeOpeningBowlerId: hSel.openingBowlerId,
                    awayOpeningBowlerId: aSel.openingBowlerId,
                });
            } else {
                // Load existing live match
                const raw = await redis.get(`match:${fixture.matchId}`);
                if (raw) matchState = JSON.parse(raw);
            }

            if (!matchState) return NextResponse.json({ error: 'Failed to create match state' }, { status: 500 });
            
            // 2. Simulation Loop
            matchState.status = 'live'; // Ensure it's live for processing
            let iterations = 0;
            const maxIterations = 1000; // Safety break

            while (matchState.status !== 'completed' && iterations < maxIterations) {
                iterations++;
                
                if (matchState.status === 'awaiting_batter') {
                    const nextBat = botChooseNextBatter(matchState);
                    if (nextBat) {
                        const available = matchState.battingOrder.find(b => b.player.id === nextBat);
                        if (available) {
                            matchState.striker = available;
                            matchState.status = 'live';
                        }
                    } else { matchState.status = 'completed'; }
                } else if (matchState.status === 'awaiting_bowler') {
                    const nextBowl = botChooseNextBowler(matchState);
                    if (nextBowl) {
                        const available = matchState.bowlingOrder.find(b => b.player.id === nextBowl);
                        if (available) {
                            matchState.currentBowler = available;
                            matchState.status = 'live';
                        }
                    } else { matchState.status = 'completed'; }
                } else if (matchState.status === 'toss_decision') {
                    matchState.toss!.decision = botTossDecision(matchState.pitchType);
                    matchState.status = 'awaiting_selection';
                } else if (matchState.status === 'awaiting_selection') {
                    matchState.status = 'live';
                } else if (matchState.status === 'innings_break') {
                    matchState.status = 'live';
                }

                if (matchState.status === 'live') {
                    processNextBall(matchState);
                }
            }

            // 3. Sync and Save
            const updatedLeague = await syncMatchToLeague(roomCode, fixtureId, matchState);
            emitToRoom(roomCode, 'league_update', { state: updatedLeague });
            
            return NextResponse.json({ success: true, state: updatedLeague });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('League API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
