import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const q = await conn.run("SELECT DISTINCT m.event_name, m.match_type FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.batter = 'Ajay Mandal' OR d.bowler = 'Ajay Mandal'");
    const rows = await q.getRows();
    console.log("Events for Ajay Mandal:", rows);

    // Also check players who had exact matches but failed fallback
    const q2 = await conn.run("SELECT DISTINCT m.event_name, m.match_type FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.batter = 'Sarthak Ranjan' OR d.bowler = 'Sarthak Ranjan'");
    console.log("Events for Sarthak Ranjan:", await q2.getRows());
}
main().catch(console.error);
