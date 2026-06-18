import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    // In deliveries, we can find out who bowled in LSG matches
    // Usually bowling_team is not directly in 'deliveries' without joining team innings, but let's just find matches involving LSG
    const q = await conn.run(`
        SELECT DISTINCT d.bowler
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE m.event_name = 'Indian Premier League' 
          AND m.season = '2024'
          AND (m.team1 = 'Lucknow Super Giants' OR m.team2 = 'Lucknow Super Giants')
    `);
    const rows = await q.getRows();
    console.log("LSG Match Bowlers 2024:", rows);
}
main().catch(console.error);
