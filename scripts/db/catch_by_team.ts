import Database from 'better-sqlite3';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

const TEAM_MAP: Record<string, string> = {
    'CSK': 'Chennai Super Kings',
    'DC': 'Delhi Capitals',
    'GT': 'Gujarat Titans',
    'KKR': 'Kolkata Knight Riders',
    'LSG': 'Lucknow Super Giants',
    'MI': 'Mumbai Indians',
    'PBKS': 'Punjab Kings',
    'RR': 'Rajasthan Royals',
    'RCB': 'Royal Challengers Bengaluru', // Note: might be 'Royal Challengers Bangalore' in older seasons
    'SRH': 'Sunrisers Hyderabad'
};

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');

    const sqliteDb = new Database(sqlitePath);
    const missingPlayers = sqliteDb.prepare("SELECT * FROM players WHERE battingStats IS NULL AND bowlingStats IS NULL").all() as any[];

    console.log(`Hunting down ${missingPlayers.length} missing players by team...`);

    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const conn = await duckDbInstance.connect();

    // Cache team rosters from DuckDB
    const teamRosters: Record<string, string[]> = {};

    for (const [acronym, fullName] of Object.entries(TEAM_MAP)) {
        // Query both team1/team2 matches and extract all players who batted or bowled for that team
        // We handle RCB name change by using LIKE
        const teamNameFilter = acronym === 'RCB' ? "LIKE 'Royal Challengers%'" : `= '${fullName}'`;
        
        const q = await conn.run(`
            SELECT DISTINCT batter AS player_name FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE m.event_name = 'Indian Premier League' AND d.batting_team ${teamNameFilter}
            UNION
            SELECT DISTINCT bowler AS player_name FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE m.event_name = 'Indian Premier League' AND d.bowling_team ${teamNameFilter}
        `);
        // Wait, bowling_team is not in deliveries!
        // I must use team1 and team2 and figure out which innings.
        // Actually, d.batting_team DOES exist in deliveries. d.bowling_team DOES NOT.
        // But if d.batting_team is the OTHER team, then the bowler's team is d.batting_team? No.
        // We can just get ALL players who played in matches involving the team, and narrow down later.
    }
}
main().catch(console.error);
