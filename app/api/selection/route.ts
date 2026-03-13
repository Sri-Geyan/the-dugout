import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';
import { getRoomState } from '@/lib/roomManager';
import { isBotUser, botSelectPlaying11 } from '@/lib/botEngine';
import { getAuctionState } from '@/lib/auctionEngine';

// Helper to get session user
function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

// Selection data shape
interface SelectionData {
    selectedIds: string[];
    battingOrder: string[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
}

// GET: Returns the selection status for a specific room/team
export async function GET(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    const teamId = searchParams.get('teamId');

    const fixtureId = searchParams.get('fixtureId');

    if (!roomCode) return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });

    try {
        const keyPrefix = fixtureId ? `selection:${roomCode}:${fixtureId}` : `selection:${roomCode}`;

        if (teamId) {
            // Get single team's selection
            const data = await redis.get(`${keyPrefix}:${teamId}`);
            if (data) {
                const parsed = JSON.parse(data);
                // Support both old format (array) and new format (object)
                if (Array.isArray(parsed)) {
                    return NextResponse.json({ selectedIds: parsed });
                }
                return NextResponse.json(parsed);
            }
            return NextResponse.json({ selectedIds: [] });
        } else {
            // Get all selections for the room/fixture
            const keys = await redis.keys(`${keyPrefix}:*`);
            const selections: Record<string, any> = {};

            for (const key of keys) {
                const parts = key.split(':');
                const tId = parts[parts.length - 1]; // Last part is always the teamId
                if (tId) {
                    const data = await redis.get(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        selections[tId] = Array.isArray(parsed) ? { selectedIds: parsed } : parsed;
                    }
                }
            }
            return NextResponse.json({ selections });
        }
    } catch (error) {
        console.error('Redis selection error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST: Save a team's playing 11 selection with enriched data
export async function POST(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const body = await request.json();
        const { roomCode, teamId, selectedIds, fixtureId, battingOrder, captainId, wkId, openingBowlerId } = body;

        // Support auto-select for bots
        if (body.action === 'autoSelectBots') {
            const room = await getRoomState(roomCode);
            const auctionState = await getAuctionState(roomCode);
            if (!room || !auctionState) return NextResponse.json({ error: 'Room or auction not found' }, { status: 404 });

            const { getPitchProfile } = await import('@/lib/pitchData');
            let pitchType = 'BALANCED';

            if (fixtureId) {
                const { getLeagueState } = await import('@/lib/leagueEngine');
                const leagueState = await getLeagueState(roomCode);
                const fixture = leagueState?.fixtures?.find(f => f.id === fixtureId);
                
                if (fixture) {
                    const homeTeam = auctionState.teams.find(t => t.userId === fixture.homeTeamUserId);
                    const profile = getPitchProfile(homeTeam?.teamName || '');
                    if (profile) pitchType = profile.pitchType;
                }
            }

            const results: Record<string, SelectionData> = {};

            for (const team of auctionState.teams) {
                const roomPlayer = room.players.find(p => p.userId === team.userId);
                if (!roomPlayer || !isBotUser(roomPlayer.username)) continue;

                const squad = team.squad.map(s => ({
                    id: s.player.id,
                    name: s.player.name,
                    role: s.player.role,
                    battingSkill: s.player.battingSkill,
                    bowlingSkill: s.player.bowlingSkill,
                    nationality: s.player.nationality,
                }));

                const selection = botSelectPlaying11(squad, pitchType);

                const key = fixtureId
                    ? `selection:${roomCode}:${fixtureId}:${team.userId}`
                    : `selection:${roomCode}:${team.userId}`;

                const selectionData: SelectionData = {
                    selectedIds: selection.selectedIds,
                    battingOrder: selection.battingOrder,
                    captainId: selection.captainId,
                    wkId: selection.wkId,
                    openingBowlerId: selection.openingBowlerId,
                };

                await redis.set(key, JSON.stringify(selectionData), 'EX', 86400);
                results[team.userId] = selectionData;
            }

            const { emitToRoom } = await import('@/lib/socket-server');
            emitToRoom(roomCode, 'selection_update', {});

            return NextResponse.json({ success: true, botSelections: results });
        }

        if (!roomCode || !teamId || !Array.isArray(selectedIds)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        if (selectedIds.length !== 11) {
            return NextResponse.json({ error: 'Exactly 11 players must be selected' }, { status: 400 });
        }

        const key = fixtureId
            ? `selection:${roomCode}:${fixtureId}:${teamId}`
            : `selection:${roomCode}:${teamId}`;

        const { emitToRoom } = await import('@/lib/socket-server');

        // Save enriched selection data
        const selectionData: SelectionData = {
            selectedIds,
            battingOrder: battingOrder || selectedIds,
            captainId: captainId || selectedIds[0],
            wkId: wkId || selectedIds[0],
            openingBowlerId: openingBowlerId || selectedIds[selectedIds.length - 1],
        };

        await redis.set(key, JSON.stringify(selectionData), 'EX', 86400);

        // If this is the initial selection (no fixtureId), check for global start
        if (!fixtureId) {
            const auctionState = await getAuctionState(roomCode);
            if (auctionState) {
                const totalTeams = auctionState.teams.length;
                const keys = await redis.keys(`selection:${roomCode}:*`);
                // filter out fixture-specific keys
                const globalKeys = keys.filter((k: string) => k.split(':').length === 3);

                if (globalKeys.length >= totalTeams) {
                    try {
                        const { initLeagueState, saveLeagueState } = await import('@/lib/leagueEngine');
                        const { updateRoomStatus } = await import('@/lib/roomManager');
                        
                        // Convert auction teams to league teams
                        const teams = auctionState.teams.map(t => ({
                            userId: t.userId,
                            username: t.username,
                            teamName: t.teamName,
                            teamId: (t as any).teamId,
                            squad: t.squad.map(s => ({
                                player: {
                                    id: s.player.id,
                                    name: s.player.name,
                                    role: s.player.role || 'BATSMAN',
                                    battingSkill: s.player.battingSkill || 50,
                                    bowlingSkill: s.player.bowlingSkill || 30,
                                    nationality: s.player.nationality,
                                },
                                soldPrice: s.soldPrice,
                            })),
                        }));

                        const leagueState = initLeagueState(roomCode, teams);
                        await saveLeagueState(leagueState);
                        const updatedRoom = await updateRoomStatus(roomCode, 'LEAGUE');
                        
                        emitToRoom(roomCode, 'league_update', { state: leagueState });
                        if (updatedRoom) emitToRoom(roomCode, 'room_update', { room: updatedRoom });
                    } catch (err) {
                        console.error('Failed to auto-init league:', err);
                    }
                }
            }
        }

        emitToRoom(roomCode, 'selection_update', {});
        return NextResponse.json({ success: true, ...selectionData });
    } catch (error) {
        console.error('Failed to save selection:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
