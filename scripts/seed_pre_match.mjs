import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const BASE = 'http://localhost:3000';

function getPlayersFromExcel() {
    const wb = xlsx.readFile(join(rootDir, 'IPL_2026_Auction_Dataset_Complete.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const rows = raw.slice(2);

    const COL = { id: 0, name: 1, role: 3, nationality: 4, basePrice: 8, battingSkill: 10, bowlingSkill: 11 };

    const mapRole = (r) => {
        switch (r?.trim()) {
            case 'Batsman': return 'BATSMAN';
            case 'Bowler': return 'BOWLER';
            case 'All-Rounder': return 'ALL_ROUNDER';
            case 'Wicket-Keeper': return 'WICKET_KEEPER';
            default: return 'BATSMAN';
        }
    };

    return rows.filter(r => r[COL.name]).map((r, idx) => ({
        id: `p${idx + 1}`,
        name: String(r[COL.name]).trim(),
        role: mapRole(r[COL.role]),
        battingSkill: Number(r[COL.battingSkill]) || 50,
        bowlingSkill: Number(r[COL.bowlingSkill]) || 50,
        basePrice: Number(r[COL.basePrice]) || 0,
        nationality: r[COL.nationality]?.trim() === 'Indian' ? 'Indian' : 'Overseas',
    }));
}

async function getCookie(username = 'TestHost') {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('No cookie returned from login');
    return setCookie.split(';')[0];
}

async function seedPreMatch() {
    const cookie = await getCookie();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };

    // 1. Create Room
    console.log('🏠 Creating new room...');
    let res = await fetch(`${BASE}/api/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'create' }),
    });
    let data = await res.json();
    if (!data.room) throw new Error('Failed to create room: ' + JSON.stringify(data));
    const roomCode = data.room.code;
    const roomId = data.room.id;
    console.log(`✅ Room created: ${roomCode} (ID: ${roomId})`);

    console.log(`🏠 Updating host team...`);
    await fetch(`${BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ action: 'updateTeam', code: roomCode, teamId: 'csk', teamName: 'Chennai Super Kings' })
    });

    // 2. Init Auction (this will also add bots to make it 10 teams)
    console.log('📦 Initializing auction and adding bots...');
    res = await fetch(`${BASE}/api/auction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'init', roomCode }),
    });
    data = await res.json();
    if (!data.state) throw new Error('Failed to init auction');

    const state = data.state;
    const teams = state.teams;
    console.log(`✅ Found ${teams.length} teams. Assigning 15 players each...`);

    const playersPool = getPlayersFromExcel();
    const usedIds = new Set();

    // Ensure all players are in the DB first for relations
    /*
    console.log('👤 Syncing players to database...');
    for (const p of playersPool) {
        await prisma.player.upsert({
            where: { id: p.id },
            update: { ...p },
            create: { ...p }
        });
    }
    */

    const pick = (role, nationality, count) => {
        const matches = [];
        for (let i = 0; i < playersPool.length && matches.length < count; i++) {
            const p = playersPool[i];
            if ((!role || p.role === role) && (!nationality || p.nationality === nationality) && !usedIds.has(p.id)) {
                matches.push(p);
                usedIds.add(p.id);
            }
        }
        return matches;
    };

    for (let t = 0; t < teams.length; t++) {
        const team = teams[t];
        const squad = [];

        // Ensure at least 7 Indians and max 8 Overseas for 15 players
        // Pick 7 Indians first with balanced roles
        const indWk = pick('WICKET_KEEPER', 'Indian', 1);
        const indBat = pick('BATSMAN', 'Indian', 2);
        const indAr = pick('ALL_ROUNDER', 'Indian', 2);
        const indBowl = pick('BOWLER', 'Indian', 2);

        [...indWk, ...indBat, ...indAr, ...indBowl].forEach(p => {
            squad.push({
                player: p,
                soldTo: { userId: team.userId, username: team.username, teamName: team.teamName },
                soldPrice: p.basePrice + 5,
            });
        });

        // Pick 8 more players (can be overseas or indian)
        const others = pick(null, null, 15 - squad.length);
        others.forEach(p => {
            squad.push({
                player: p,
                soldTo: { userId: team.userId, username: team.username, teamName: team.teamName },
                soldPrice: p.basePrice + 5,
            });
        });

        team.squad = squad;
        team.purse = 120 - squad.reduce((sum, p) => sum + p.soldPrice, 0);
        console.log(`   - ${team.teamName}: ${squad.length} players (${squad.filter(s => s.player.nationality === 'Indian').length} Ind, ${squad.filter(s => s.player.nationality === 'Overseas').length} Ovs)`);

        // Sync to Postgres AuctionResult
        /*
        const dbTeam = await prisma.team.findUnique({
            where: { userId_roomId: { userId: team.userId, roomId } }
        });
        if (dbTeam) {
            for (const sp of squad) {
                await prisma.auctionResult.upsert({
                    where: { roomId_playerId: { roomId, playerId: sp.player.id } },
                    update: { teamId: dbTeam.id, soldPrice: sp.soldPrice },
                    create: {
                        roomId,
                        playerId: sp.player.id,
                        teamId: dbTeam.id,
                        soldPrice: sp.soldPrice
                    }
                });
            }
            await prisma.team.update({
                where: { id: dbTeam.id },
                data: { purse: team.purse }
            });
        }
        */
    }

    // 3. Save to Redis
    console.log('💾 Saving completed auction state to Redis...');
    state.status = 'completed';
    res = await fetch(`${BASE}/api/auction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'save', roomCode, state }),
    });

    // 4. Init League
    console.log('🏆 Initializing league fixtures...');
    res = await fetch(`${BASE}/api/league`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'init', roomCode }),
    });
    const leagueData = await res.json();
    if (!leagueData.state) {
        console.error('League Init Error:', leagueData);
        throw new Error('Failed to init league');
    }

    const firstFixture = leagueData.state.fixtures[0];
    const preMatchUrl = `http://localhost:3000/pre-match/${roomCode}?fixtureId=${firstFixture.id}`;

    console.log('\n✨ Seeding Complete!');
    console.log(`🔗 Pre-Match URL: ${preMatchUrl}`);
    console.log(`Fixture: ${firstFixture.homeTeamName} vs ${firstFixture.awayTeamName}\n`);
}

seedPreMatch()
    .catch(err => {
        console.error('\n❌ Seed Failed:', err.message);
        process.exit(1);
    })
/*
.finally(async () => {
    await prisma.$disconnect();
});
*/
