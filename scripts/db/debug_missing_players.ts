import Database from 'better-sqlite3';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');

    const sqliteDb = new Database(sqlitePath);
    // Find players who have NO stats (missing)
    const missingPlayers = sqliteDb.prepare("SELECT name FROM players WHERE battingStats IS NULL AND bowlingStats IS NULL").all() as {name: string}[];

    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const duckDbConn = await duckDbInstance.connect();

    console.log(`Analyzing ${missingPlayers.length} missing players...\n`);

    let neverPlayed = 0;
    let ambiguous = 0;
    let differentName = 0;

    for (const p of missingPlayers) {
        const parts = p.name.split(' ');
        const lastName = parts.length >= 2 ? parts.slice(1).join(' ') : p.name;
        
        // Search DuckDB for anyone with this last name
        const q = await duckDbConn.run(
            "SELECT DISTINCT name FROM (SELECT batter as name FROM deliveries WHERE batter ILIKE $q UNION SELECT bowler as name FROM deliveries WHERE bowler ILIKE $q)",
            { q: `%${lastName}%` }
        );
        const rows = await q.getRows();
        const matches = rows.map(r => r[0] as string);

        if (matches.length === 0) {
            console.log(`[Never Played / Missing] ${p.name}: No one with last name "${lastName}" found in DB.`);
            neverPlayed++;
        } else if (matches.length === 1) {
            // If there's exactly 1 match, our fuzzy logic from the previous script should have caught it UNLESS 
            // the last name we split was weird. Let's show it.
            console.log(`[Different Name Format] ${p.name}: Found exact 1 match for last name: "${matches[0]}"`);
            differentName++;
        } else {
            // Multiple matches
            console.log(`[Ambiguous] ${p.name}: Found multiple potential matches: ${matches.join(', ')}`);
            ambiguous++;
        }
    }
    
    console.log(`\nSummary:`);
    console.log(`- Probably never played in recorded IPL: ${neverPlayed}`);
    console.log(`- Ambiguous (multiple players with same last name): ${ambiguous}`);
    console.log(`- Different naming format (found 1 match but script missed it): ${differentName}`);
}

main().catch(console.error);
