import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

async function main() {
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    const q = await conn.run("SELECT DISTINCT bowler FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE m.event_name = 'Indian Premier League'");
    const rows = await q.getRows();
    const bowlers = rows.map((r: any) => r[0]);
    console.log("Found", bowlers.length, "IPL bowlers.");
    
    // Find anyone with 'Yadav' in IPL
    const yadavs = bowlers.filter((b: string) => b && b.includes('Yadav'));
    console.log("Yadavs in IPL:", yadavs);
    
    // Find anyone with 'Mayank' in IPL
    const mayanks = bowlers.filter((b: string) => b && b.includes('Mayank'));
    console.log("Mayanks in IPL:", mayanks);

    // Let's also check if Mayank Yadav played any other format
    const q2 = await conn.run("SELECT DISTINCT m.event_name, m.match_type FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE d.bowler ILIKE '%Mayank%Yadav%' OR d.bowler ILIKE '%M%Yadav%'");
    const rows2 = await q2.getRows();
    console.log("Events for Mayank Yadav:", rows2);
}
main().catch(console.error);
