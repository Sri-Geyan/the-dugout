import Database from 'better-sqlite3';
import path from 'path';

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const sqliteDb = new Database(sqlitePath);

    const updateStmt = sqliteDb.prepare("UPDATE players SET battingStats = ?, bowlingStats = ? WHERE name = 'Vicky Ostwal'");

    const batStats = {
        matches: 15,
        innings: 8,
        runs: 67,
        highestScore: 28,
        average: 13.40,
        ballsFaced: 63,
        strikeRate: 106.34,
        fours: 6,
        sixes: 2,
        centuries: 0,
        fifties: 0,
        ducks: 0 // unknown, setting to 0
    };

    const bowlStats = {
        matches: 15,
        innings: 15,
        overs: 55.66,
        runs: 380,
        wickets: 14,
        average: 25.71,
        economy: 6.46,
        strikeRate: 23.8,
        bestWickets: "3/27",
        fourWickets: 0,
        fiveWickets: 0
    };

    const res = updateStmt.run(
        JSON.stringify(batStats),
        JSON.stringify(bowlStats)
    );

    console.log("Updated Vicky Ostwal: ", res.changes);
    sqliteDb.close();
}

main().catch(console.error);
