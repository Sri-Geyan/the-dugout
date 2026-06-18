import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const q = await conn.run("SELECT DISTINCT d.bowler, m.event_name, m.season FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.bowler = 'M Yadav'");
    const rows = await q.getRows();
    console.log("M Yadav details:", rows);
}
main().catch(console.error);
