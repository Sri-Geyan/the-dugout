import { NextRequest, NextResponse } from 'next/server';
import { initMatchState, processNextBall, saveMatchState, getMatchState } from '@/lib/matchEngine';
import { v4 as uuidv4 } from 'uuid';
import { getLeagueState } from '@/lib/leagueEngine';
import { getAuctionState } from '@/lib/auctionEngine';
import redis from '@/lib/redis';

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
        const { action, matchId, roomCode, homeTeam, awayTeam, pitchType } = body;

        if (action === 'init') {
            const { fixtureId, roomCode: bodyRoomCode, pitchType: bodyPitchType } = body;
            const rCode = roomCode || bodyRoomCode;
            const id = matchId || uuidv4();

            let hTeam = homeTeam;
            let aTeam = awayTeam;

            if (fixtureId && rCode) {
                const leagueState = await getLeagueState(rCode);
                const fixture = leagueState?.fixtures.find(f => f.id === fixtureId);

                if (fixture) {
                    const auctionState = await getAuctionState(rCode);
                    const teams = auctionState?.teams || [];

                    const homeLeagueTeam = teams.find(t => t.userId === fixture.homeTeamUserId);
                    const awayLeagueTeam = teams.find(t => t.userId === fixture.awayTeamUserId);

                    if (homeLeagueTeam && awayLeagueTeam) {
                        const getPreMatchSelection = async (uId: string) => {
                            const data = await redis.get(`selection:${rCode}:${fixtureId}:${uId}`);
                            return data ? JSON.parse(data) : null;
                        };

                        const homeSelectedIds = await getPreMatchSelection(fixture.homeTeamUserId);
                        const awaySelectedIds = await getPreMatchSelection(fixture.awayTeamUserId);

                        const mapToMatchTeam = (leagueTeam: any, selectedIds: string[] | null) => {
                            let playingSquad = leagueTeam.squad;

                            if (selectedIds && selectedIds.length === 11) {
                                playingSquad = leagueTeam.squad.filter((s: any) => selectedIds.includes(s.player.id));
                            } else {
                                playingSquad = [...leagueTeam.squad].sort((a: any, b: any) => b.soldPrice - a.soldPrice).slice(0, 11);
                            }

                            return {
                                teamId: leagueTeam.userId,
                                name: leagueTeam.teamName,
                                userId: leagueTeam.userId,
                                score: 0, wickets: 0, overs: 0, balls: 0, extras: 0, runRate: 0,
                                players: playingSquad.map((s: any) => ({
                                    id: s.player.id,
                                    name: s.player.name,
                                    role: s.player.role,
                                    battingSkill: s.player.battingSkill,
                                    bowlingSkill: s.player.bowlingSkill,
                                }))
                            };
                        };

                        hTeam = mapToMatchTeam(homeLeagueTeam, homeSelectedIds);
                        aTeam = mapToMatchTeam(awayLeagueTeam, awaySelectedIds);
                    }
                }
            }

            if (!hTeam || !aTeam) {
                return NextResponse.json({ error: 'Missing team data for initialization' }, { status: 400 });
            }

            const state = initMatchState(id, rCode, hTeam, aTeam, bodyPitchType || 'BALANCED');
            await saveMatchState(state);
            return NextResponse.json({ state });
        }

        if (action === 'ball') {
            const state = await getMatchState(matchId);
            if (!state) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

            if (state.status === 'innings_break') {
                state.status = 'live';
            }

            const result = processNextBall(state);
            await saveMatchState(result.state);
            return NextResponse.json({ state: result.state, ballResult: result.ballResult });
        }

        if (action === 'status') {
            const state = await getMatchState(matchId);
            return NextResponse.json({ state });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Match error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    if (!matchId) return NextResponse.json({ error: 'Match ID required' }, { status: 400 });

    const state = await getMatchState(matchId);
    return NextResponse.json({ state });
}
