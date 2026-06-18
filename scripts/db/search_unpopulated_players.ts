import Database from 'better-sqlite3';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');

    const sqliteDb = new Database(sqlitePath);
    // Find players who have NO stats (the 48 remaining)
    const missingPlayers = sqliteDb.prepare("SELECT name FROM players WHERE battingStats IS NULL AND bowlingStats IS NULL").all() as {name: string}[];

    console.log(`Searching DuckDB 'players' table for ${missingPlayers.length} unpopulated players...\n`);

    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const duckDbConn = await duckDbInstance.connect();

    for (const p of missingPlayers) {
        // Just like search_players does:
        const sql = `
            SELECT player_name, country 
            FROM players 
            WHERE player_name ILIKE $query
            ORDER BY player_name
            LIMIT 5
        `;
        const q = await duckDbConn.run(sql, { query: `%${p.name}%` });
        const rows = await q.getRows();
        
        if (rows.length > 0) {
            console.log(`[FOUND EXACT] ${p.name} ->`, rows.map(r => `${r[0]} (${r[1]})`).join(', '));
            continue;
        }

        // If not found, try last name search
        const parts = p.name.split(' ');
        const lastName = parts.length >= 2 ? parts.slice(1).join(' ') : p.name;
        const fallbackQ = await duckDbConn.run(sql, { query: `%${lastName}%` });
        const fallbackRows = await fallbackQ.getRows();
        
        if (fallbackRows.length > 0) {
            console.log(`[FOUND SURNAME] ${p.name} ->`, fallbackRows.map(r => `${r[0]} (${r[1]})`).join(', '));
        } else {
            console.log(`[MISSING] ${p.name} completely missing from Cricsheet players table.`);
        }
    }
}

main().catch(console.error);
