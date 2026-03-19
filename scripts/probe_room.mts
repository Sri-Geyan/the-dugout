import { redis } from '../lib/redis';

async function probe() {
    const roomCode = 'EZH4SM';
    const room = await redis.get(`room:${roomCode}`);
    const league = await redis.get(`league:${roomCode}`);
    
    const auction = await redis.get(`auction:${roomCode}`);
    
    console.log('--- ROOM DATA ---');
    console.log(room);
    
    console.log('\n--- AUCTION DATA ---');
    if (auction) {
        const a = JSON.parse(auction);
        console.log('Status:', a.status);
        if (a.teams && a.teams[0]) {
            console.log('Retained example:', JSON.stringify(a.teams[0].retained, null, 2));
        }
    } else {
        console.log('No auction found.');
    }
    
    console.log('\n--- LEAGUE DATA ---');
    if (league) {
        const state = JSON.parse(league);
        console.log('Phase:', state.phase);
        console.log('Status:', state.status);
        console.log('Teams:', state.teams.length);
        console.log('Example Squad (Top 1):', JSON.stringify(state.teams[0].squad[0], null, 2));
    } else {
        console.log('No league found for this room.');
    }
}

probe().catch(console.error).finally(() => process.exit(0));
