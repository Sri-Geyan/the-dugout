import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const q = await conn.run("SELECT DISTINCT m.event_name, m.match_type FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.bowler = 'Mayan Yadav' OR d.bowler = 'M Yadav'");
    const rows = await q.getRows();
    console.log("Events for Mayan Yadav or M Yadav:", rows);
}
main().catch(console.error);
