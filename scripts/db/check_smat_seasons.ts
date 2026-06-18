import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const q = await conn.run("SELECT DISTINCT season FROM matches WHERE event_name = 'Syed Mushtaq Ali Trophy' ORDER BY season DESC");
    const rows = await q.getRows();
    console.log("Syed Mushtaq Ali Trophy seasons in DB:", rows);

    // Also check the most recent dates in the DB
    const q2 = await conn.run("SELECT MAX(date) FROM matches");
    console.log("Most recent match date in DB:", await q2.getRows());
}
main().catch(console.error);
