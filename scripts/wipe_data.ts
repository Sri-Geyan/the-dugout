import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data wipe... (Keeping schema intact)');

    // 1. Delete standalone cache data
    const kv = await prisma.keyValue.deleteMany();
    console.log(`Deleted ${kv.count} KeyValue cache entries`);

    // 2. Delete child records
    const bids = await prisma.auctionBid.deleteMany();
    console.log(`Deleted ${bids.count} AuctionBids`);

    const batting = await prisma.battingStats.deleteMany();
    console.log(`Deleted ${batting.count} BattingStats`);

    const bowling = await prisma.bowlingStats.deleteMany();
    console.log(`Deleted ${bowling.count} BowlingStats`);

    const auctionResults = await prisma.auctionResult.deleteMany();
    console.log(`Deleted ${auctionResults.count} AuctionResults`);

    const retentions = await prisma.retention.deleteMany();
    console.log(`Deleted ${retentions.count} Retentions`);

    // 3. Delete Match and Fixture state
    const matches = await prisma.match.deleteMany();
    console.log(`Deleted ${matches.count} Matches`);

    const fixtures = await prisma.fixture.deleteMany();
    console.log(`Deleted ${fixtures.count} Fixtures`);

    // 4. Delete League Stats
    const pls = await prisma.playerLeagueStats.deleteMany();
    console.log(`Deleted ${pls.count} PlayerLeagueStats`);

    // 5. Delete Teams and Room associations
    const teams = await prisma.team.deleteMany();
    console.log(`Deleted ${teams.count} Teams`);

    const rp = await prisma.roomPlayer.deleteMany();
    console.log(`Deleted ${rp.count} RoomPlayers`);

    // 6. Delete core User and Room entities
    const rooms = await prisma.room.deleteMany();
    console.log(`Deleted ${rooms.count} Rooms`);

    const users = await prisma.user.deleteMany();
    console.log(`Deleted ${users.count} Users`);

    // 7. Verification check
    const userCount = await prisma.user.count();
    const roomCount = await prisma.room.count();
    const playerCount = await prisma.player.count();
    
    console.log('\n--- VERIFICATION ---');
    console.log(`Users remaining: ${userCount}`);
    console.log(`Rooms remaining: ${roomCount}`);
    console.log(`Players (Reference Data) kept safe: ${playerCount}`);

    console.log('\nWipe completed successfully! The database schema has not been dropped or altered.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
