import { NextRequest, NextResponse } from 'next/server';
import { initLeagueState, saveLeagueState, LeagueTeam } from '@/lib/leagueEngine';
import { getRoomState, updateRoomStatus } from '@/lib/roomManager';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const roomCode = searchParams.get('roomCode');
        if (!roomCode) return NextResponse.json({ success: false, error: "roomCode required" });
        const room = await getRoomState(roomCode);

        if (!room) {
            return NextResponse.json({ success: false, error: "Room not found. Make sure to run the UI browser flow first." });
        }

        // Generate a fake team for each player in the room
        const dummyTeams: LeagueTeam[] = room.players.map(p => ({
            userId: p.userId,
            username: p.username,
            teamName: p.teamName || 'Unknown Team',
            squad: generateSquad()
        }));

        // Let's directly construct the expected state and save it
        const state = initLeagueState(roomCode, dummyTeams);
        
        // Add some dummy player stats
        state.playerStats = dummyTeams.flatMap(t => t.squad.map(s => ({
            playerId: s.player.id,
            playerName: s.player.name,
            teamName: t.teamName,
            matches: 1,
            runs: Math.floor(Math.random() * 50),
            balls: Math.floor(Math.random() * 30) + 10,
            fours: 2,
            sixes: 1,
            wickets: s.player.role === 'BOWLER' || s.player.role === 'ALL_ROUNDER' ? Math.floor(Math.random() * 3) : 0,
            oversBowled: s.player.role === 'BOWLER' || s.player.role === 'ALL_ROUNDER' ? 12 : 0,
            runsConceded: s.player.role === 'BOWLER' || s.player.role === 'ALL_ROUNDER' ? Math.floor(Math.random() * 20) + 10 : 0,
            catches: 0,
            highestScore: 40,
            centuries: 0,
            halfCenturies: 0,
            bestBowlingWickets: 2,
            bestBowlingRuns: 15,
            impactScore: 50
        })));

        await saveLeagueState(state);

        // Mock auction state so pre-match can find squads
        const auctionState = {
            status: 'completed',
            teams: dummyTeams.map(t => ({
                userId: t.userId,
                username: t.username,
                teamName: t.teamName,
                purse: 50,
                squad: t.squad
            }))
        };
        const redis = require('@/lib/redis').default;
        await redis.set(`auction:${roomCode}`, JSON.stringify(auctionState), 'EX', 86400);

        await updateRoomStatus(roomCode, 'league');

        return NextResponse.json({ success: true, roomCode });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) });
    }
}

function generateSquad() {
    const squad = [];
    // 8 overseas, 8 indians, all legit
    for (let i = 0; i < 8; i++) {
        squad.push({
            player: { id: `ind${i}`, name: `IndianStar_${i}`, role: i < 3 ? 'BATSMAN' : i < 6 ? 'BOWLER' : 'ALL_ROUNDER', battingSkill: 80, bowlingSkill: 80, nationality: 'Indian' },
            soldPrice: 1,
        });
    }
    for (let i = 0; i < 7; i++) {
        squad.push({
            player: { id: `ovs${i}`, name: `OverseasStar_${i}`, role: i < 3 ? 'BATSMAN' : i < 6 ? 'BOWLER' : 'ALL_ROUNDER', battingSkill: 80, bowlingSkill: 80, nationality: 'Overseas' },
            soldPrice: 1,
        });
    }
    return squad;
}
