import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const names = ['Vicky', 'Kanhaiya', 'VK Ostwal', 'V Ostwal'];

    for (const name of names) {
        const query1 = "SELECT DISTINCT d.batter, m.event_name FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.batter ILIKE '%" + name + "%'";
        const q = await conn.run(query1);
        console.log("Batters with " + name + ":", await q.getRows());

        const query2 = "SELECT DISTINCT d.bowler, m.event_name FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.bowler ILIKE '%" + name + "%'";
        const q2 = await conn.run(query2);
        console.log("Bowlers with " + name + ":", await q2.getRows());
    }
}
main().catch(console.error);
