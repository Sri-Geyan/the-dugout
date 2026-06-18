import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const q = await conn.run("SELECT DISTINCT d.batter FROM deliveries d WHERE d.batter ILIKE '%Mandal%'");
    console.log("Mandal deliveries batters:", await q.getRows());
    
    const q2 = await conn.run("SELECT DISTINCT d.batter FROM deliveries d WHERE d.batter ILIKE '%Sarthak%'");
    console.log("Sarthak deliveries batters:", await q2.getRows());

    const q3 = await conn.run("SELECT DISTINCT d.bowler FROM deliveries d WHERE d.bowler ILIKE '%Mandal%'");
    console.log("Mandal deliveries bowlers:", await q3.getRows());
}
main().catch(console.error);
