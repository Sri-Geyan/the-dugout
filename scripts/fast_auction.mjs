// Set auction state to completed with squads for testing
const ROOM_CODE = '8DELJ2';
const BASE = 'http://localhost:3000';

async function getCookie() {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'TestHost' }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('No cookie');
    return setCookie.split(';')[0];
}

async function setupCompletedAuction() {
    const cookie = await getCookie();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };

    // First get current auction state to get team info
    let res = await fetch(`${BASE}/api/auction?roomCode=${ROOM_CODE}`, { headers: { Cookie: cookie } });
    const auctionData = await res.json();

    if (!auctionData.state) {
        console.error('No auction state found');
        return;
    }

    const teams = auctionData.state.teams;
    console.log(`Found ${teams.length} teams`);

    // Players data — 25 per team to fill squads
    const players = [];
    for (let i = 1; i <= 250; i++) {
        players.push({
            id: `p${i}`,
            name: `Player_${i}`,
            role: i % 4 === 0 ? 'BOWLER' : i % 4 === 1 ? 'BATSMAN' : i % 4 === 2 ? 'ALL_ROUNDER' : 'WICKET_KEEPER',
            battingSkill: 50 + Math.floor(Math.random() * 45),
            bowlingSkill: 30 + Math.floor(Math.random() * 45),
            basePrice: 0.5,
            nationality: i % 5 === 0 ? 'Overseas' : 'Indian',
        });
    }

    // Assign 25 players to each team
    for (let t = 0; t < teams.length; t++) {
        teams[t].squad = [];
        for (let p = 0; p < 25; p++) {
            const playerIdx = t * 25 + p;
            if (playerIdx < players.length) {
                teams[t].squad.push({
                    player: players[playerIdx],
                    soldTo: { userId: teams[t].userId, username: teams[t].username, teamName: teams[t].teamName },
                    soldPrice: 1 + Math.random() * 5,
                });
            }
        }
        teams[t].purse = 100 - teams[t].squad.reduce((s, p) => s + p.soldPrice, 0);
    }

    // Update auction state to completed
    const newState = {
        ...auctionData.state,
        status: 'completed',
        teams,
        currentPlayer: null,
        currentBid: 0,
        currentBidder: null,
        timerEnd: null,
    };

    // Save directly via Redis-backed API
    res = await fetch(`${BASE}/api/auction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'save', roomCode: ROOM_CODE, state: newState }),
    });

    // If save action doesn't exist, try to set via internal approach
    const saveRes = await res.json();
    console.log('Save result:', saveRes);

    // Check state
    res = await fetch(`${BASE}/api/auction?roomCode=${ROOM_CODE}`, { headers: { Cookie: cookie } });
    const finalState = await res.json();
    console.log('Final auction status:', finalState.state?.status);
    console.log('Team squad sizes:', finalState.state?.teams?.map(t => `${t.teamName}: ${t.squad?.length}`).join(', '));
}

setupCompletedAuction().catch(console.error);
