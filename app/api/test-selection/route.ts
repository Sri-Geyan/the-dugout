import { NextResponse } from 'next/server';
import { getRoomState, updateRoomStatus, createRoom } from '@/lib/roomManager';
import redis from '@/lib/redis';

export async function GET() {
    try {
        const roomCode = '8DELJ2';
        let room = await getRoomState(roomCode);

        if (!room) {
            // Create a dummy room if it doesn't exist
            await createRoom('TestHost', 'TestHost');
            room = await getRoomState(roomCode);
            if (!room) return NextResponse.json({ success: false, error: 'Failed to create mock room' });
        }

        // Mock 4 teams
        const dummyPlayers = [
            { userId: 'TestHost', username: 'TestHost', teamName: 'Chennai Super Kings' },
            { userId: 'bot1', username: 'Captain_Dhoni', teamName: 'Mumbai Indians' },
            { userId: 'bot2', username: 'Hitman', teamName: 'Royal Challengers Bangalore' },
            { userId: 'bot3', username: 'King', teamName: 'Kolkata Knight Riders' },
        ];

        // Ensure room has these players
        room.players = dummyPlayers;
        await updateRoomStatus(roomCode, 'selection');

        // Create a fake auction state so the selection page has players to choose from!
        const auctionState = {
            status: 'completed',
            teams: dummyPlayers.map(p => ({
                userId: p.userId,
                username: p.username,
                teamName: p.teamName,
                purse: 50,
                squad: generateAuctionSquad()
            }))
        };
        await redis.set(`auction:${roomCode}`, JSON.stringify(auctionState), 'EX', 86400);

        return NextResponse.json({ success: true, roomCode });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) });
    }
}

function generateAuctionSquad() {
    const squad = [];
    // 8 overseas, 7 indians = 15 players total in squad (min 7 indian, max 8 overseas rule met)
    for (let i = 0; i < 7; i++) {
        squad.push({
            player: { id: `ind${i}`, name: `IndianStar_${i}`, role: i < 3 ? 'BATSMAN' : i < 6 ? 'BOWLER' : 'ALL_ROUNDER', battingSkill: 80, bowlingSkill: 80, nationality: 'Indian' },
            soldPrice: 1,
            soldTo: { userId: 'mock' }
        });
    }
    for (let i = 0; i < 8; i++) {
        squad.push({
            player: { id: `ovs${i}`, name: `OverseasStar_${i}`, role: i < 3 ? 'BATSMAN' : i < 6 ? 'BOWLER' : 'WICKET_KEEPER', battingSkill: 80, bowlingSkill: 80, nationality: 'Overseas' },
            soldPrice: 1,
            soldTo: { userId: 'mock' }
        });
    }
    return squad;
}
