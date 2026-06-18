import Database from 'better-sqlite3';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';

const getBattingSql = (filterStr: string) => `
    WITH innings_scores AS (
      SELECT
        d.batter,
        d.match_id,
        d.innings_number,
        SUM(d.runs_batter) AS innings_runs,
        COUNT(*) FILTER (WHERE d.extras_wides = 0) AS innings_balls,
        COUNT(*) FILTER (WHERE d.runs_batter = 4 AND NOT d.runs_non_boundary) AS innings_fours,
        COUNT(*) FILTER (WHERE d.runs_batter = 6 AND NOT d.runs_non_boundary) AS innings_sixes,
        MAX(CASE WHEN d.is_wicket AND d.wicket_player_out = d.batter THEN 1 ELSE 0 END) AS was_dismissed
      FROM deliveries d
      JOIN matches m ON d.match_id = m.match_id
      WHERE d.batter = $player_name AND ${filterStr}
      GROUP BY d.batter, d.match_id, d.innings_number
    )
    SELECT
      COUNT(DISTINCT match_id) AS matches,
      COUNT(*) AS innings,
      SUM(CASE WHEN was_dismissed = 0 THEN 1 ELSE 0 END) AS not_outs,
      SUM(innings_runs) AS runs,
      MAX(innings_runs) AS highest_score,
      ROUND(
        CASE
          WHEN COUNT(*) - SUM(CASE WHEN was_dismissed = 0 THEN 1 ELSE 0 END) > 0
          THEN SUM(innings_runs)::DOUBLE / (COUNT(*) - SUM(CASE WHEN was_dismissed = 0 THEN 1 ELSE 0 END))
          ELSE NULL
        END, 2
      ) AS average,
      SUM(innings_balls) AS balls_faced,
      ROUND(
        CASE
          WHEN SUM(innings_balls) > 0
          THEN SUM(innings_runs)::DOUBLE / SUM(innings_balls) * 100
          ELSE NULL
        END, 2
      ) AS strike_rate,
      SUM(innings_fours) AS fours,
      SUM(innings_sixes) AS sixes,
      COUNT(*) FILTER (WHERE innings_runs >= 100) AS centuries,
      COUNT(*) FILTER (WHERE innings_runs >= 50 AND innings_runs < 100) AS fifties,
      COUNT(*) FILTER (WHERE innings_runs = 0 AND was_dismissed = 1) AS ducks
    FROM innings_scores
    GROUP BY batter
`;

const getBowlingSql = (filterStr: string) => `
    WITH match_bowling AS (
      SELECT
        d.bowler,
        d.match_id,
        d.innings_number,
        COUNT(*) FILTER (WHERE d.extras_wides = 0 AND d.extras_noballs = 0) AS legal_balls,
        SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
        COUNT(*) FILTER (WHERE d.is_wicket AND d.wicket_kind IN ('bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket')) AS match_wickets
      FROM deliveries d
      JOIN matches m ON d.match_id = m.match_id
      WHERE d.bowler = $player_name AND ${filterStr}
      GROUP BY d.bowler, d.match_id, d.innings_number
    )
    SELECT
      COUNT(DISTINCT match_id) AS matches,
      COUNT(*) AS innings,
      SUM(legal_balls) / 6 AS overs,
      SUM(legal_balls) % 6 AS partial_overs,
      SUM(runs_conceded) AS runs,
      SUM(match_wickets) AS wickets,
      ROUND(
        CASE
          WHEN SUM(match_wickets) > 0
          THEN SUM(runs_conceded)::DOUBLE / SUM(match_wickets)
          ELSE NULL
        END, 2
      ) AS average,
      ROUND(
        CASE
          WHEN SUM(legal_balls) > 0
          THEN SUM(runs_conceded)::DOUBLE / (SUM(legal_balls)::DOUBLE / 6)
          ELSE NULL
        END, 2
      ) AS economy,
      ROUND(
        CASE
          WHEN SUM(match_wickets) > 0
          THEN SUM(legal_balls)::DOUBLE / SUM(match_wickets)
          ELSE NULL
        END, 2
      ) AS strike_rate,
      COUNT(*) FILTER (WHERE match_wickets >= 4) AS four_wickets,
      COUNT(*) FILTER (WHERE match_wickets >= 5) AS five_wickets,
      MAX(match_wickets) AS best_wickets_count,
      MIN(CASE WHEN match_wickets = (SELECT MAX(match_wickets) FROM match_bowling b2 WHERE b2.bowler = match_bowling.bowler) THEN runs_conceded ELSE 999 END) AS best_runs_conceded
    FROM match_bowling
    GROUP BY bowler
`;

function convertBigIntsToNumbers(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return Number(obj);
    if (Array.isArray(obj)) return obj.map(convertBigIntsToNumbers);
    if (typeof obj === 'object') {
        const res: any = {};
        for (const key of Object.keys(obj)) {
            res[key] = convertBigIntsToNumbers(obj[key]);
        }
        return res;
    }
    return obj;
}

// Extensive Alias Map for Missing Stars
const ALIAS_MAP: Record<string, string> = {
    "Krunal Pandya": "KH Pandya",
    "Bhuvneshwar Kumar": "B Kumar",
    "Varun Chakravarthy": "CV Varun",
    "Suryakumar Yadav": "SA Yadav",
    "Axar Patel": "AR Patel",
    "Prithvi Shaw": "PP Shaw",
    "Rinku Singh": "RK Singh",
    "Shardul Thakur": "SN Thakur",
    "Taskin Ahmed": "Taskin Ahmed",
    "Khaleel Ahmed": "KK Ahmed",
    "Matt Henry": "MJ Henry",
    "Matthew Short": "MW Short",
    "Sarfaraz Khan": "SN Khan",
    "Aman Khan": "AS Khan",
    "Nitish Rana": "N Rana",
    "Prasidh Krishna": "M Prasidh Krishna",
    "Shahrukh Khan": "M Shahrukh Khan",
    "Jayant Yadav": "J Yadav",
    "Rovman Powell": "R Powell",
    "Cameron Green": "C Green",
    "Finn Allen": "FH Allen",
    "Prabhsimran Singh": "P Simran Singh",
    "Anukul Roy": "AS Roy",
    "Harshal Patel": "HV Patel",
    "Kamindu Mendis": "PHKD Mendis",
    "Daryl Mitchell": "DJ Mitchell",
    "Jhye Richardson": "JA Richardson",
    "Venkatesh Iyer": "VR Iyer",
    "Wiaan Mulder": "PWA Mulder",
    "Spencer Johnson": "SH Johnson",
    "Karn Sharma": "KV Sharma"
};

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');

    const sqliteDb = new Database(sqlitePath);
    // Find players who have NO stats
    const missingPlayers = sqliteDb.prepare("SELECT * FROM players WHERE battingStats IS NULL AND bowlingStats IS NULL").all() as any[];

    console.log(`Found ${missingPlayers.length} missing players.`);
    if (missingPlayers.length === 0) return;

    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const duckDbConn = await duckDbInstance.connect();

    const updateStmt = sqliteDb.prepare("UPDATE players SET battingStats = ?, bowlingStats = ? WHERE id = ?");
    
    let resolvedCount = 0;
    
    const tryFetch = async (dbName: string, filterStr: string, player: any) => {
        let batStatsObj = null;
        let hasStats = false;
        
        if (player.role !== 'BOWLER') {
            const batRes = await duckDbConn.run(getBattingSql(filterStr), { player_name: dbName });
            const rows = await batRes.getRows();
            if (rows.length > 0) {
                hasStats = true;
                const r = rows[0];
                batStatsObj = convertBigIntsToNumbers({
                    matches: r[0], innings: r[1], runs: r[3], average: r[5],
                    strikeRate: r[7], highestScore: r[4], fours: r[8], sixes: r[9],
                    centuries: r[10], fifties: r[11], ducks: r[12]
                });
            }
        }

        let bowlStatsObj = null;
        if (player.role !== 'BATSMAN' && player.role !== 'WICKET_KEEPER') {
            const bowlRes = await duckDbConn.run(getBowlingSql(filterStr), { player_name: dbName });
            const rows = await bowlRes.getRows();
            if (rows.length > 0) {
                hasStats = true;
                const r = rows[0];
                bowlStatsObj = convertBigIntsToNumbers({
                    matches: r[0], innings: r[1], wickets: r[5], economy: r[7],
                    average: r[6], bestWickets: `${r[11]}/${r[12]}`, overs: r[2]
                });
            }
        }
        
        return { hasStats, batStatsObj, bowlStatsObj };
    };

    const runUpdates = sqliteDb.transaction(() => {
        for (const player of missingPlayers) {
            // Priority 1: Alias Map
            // Priority 2: Fuzzy LastName + Initial match from previous script logic (will use just last name for safety in case script missed it but it was 1 match)
            
            let dbName = ALIAS_MAP[player.name];
            
            // If no alias, attempt fallback resolution
            if (!dbName) {
                const parts = player.name.split(' ');
                if (parts.length >= 2) {
                    dbName = `${parts[0][0]} ${parts.slice(1).join(' ')}`;
                } else {
                    dbName = player.name;
                }
            }

            // Attempt IPL Fetch first
            tryFetch(dbName, "m.event_name = 'Indian Premier League'", player).then(async (res) => {
                let finalRes = res;
                let usedFallback = false;
                
                // If IPL fetch returned nothing, attempt T20 Fallback
                if (!res.hasStats) {
                    finalRes = await tryFetch(dbName, "m.match_type = 'T20'", player);
                    if (finalRes.hasStats) {
                        usedFallback = true;
                    }
                }

                if (finalRes.hasStats) {
                    resolvedCount++;
                    console.log(`[RESOLVED] ${player.name} -> ${dbName} (${usedFallback ? 'T20 Fallback' : 'IPL'})`);
                    updateStmt.run(
                        finalRes.batStatsObj ? JSON.stringify(finalRes.batStatsObj) : null,
                        finalRes.bowlStatsObj ? JSON.stringify(finalRes.bowlStatsObj) : null,
                        player.id
                    );
                } else {
                    console.log(`[FAILED] ${player.name} -> ${dbName} (No stats found in IPL or T20)`);
                }
            });
        }
    });

    // Wait slightly for promises to queue, but we should actually AWAIT them correctly
    // Since sqliteDb.transaction doesn't support async, we will resolve stats first, then update
    
    const toUpdate: any[] = [];
    
    for (const player of missingPlayers) {
        let dbName = ALIAS_MAP[player.name];
        if (!dbName) {
            const parts = player.name.split(' ');
            if (parts.length >= 2) {
                dbName = `${parts[0][0]} ${parts.slice(1).join(' ')}`;
            } else {
                dbName = player.name;
            }
        }

        let res = await tryFetch(dbName, "m.event_name = 'Indian Premier League'", player);
        let usedFallback = false;
        if (!res.hasStats) {
            res = await tryFetch(dbName, "m.match_type = 'T20'", player);
            if (res.hasStats) usedFallback = true;
        }

        if (res.hasStats) {
            resolvedCount++;
            console.log(`[RESOLVED] ${player.name} -> ${dbName} (${usedFallback ? 'T20 Fallback' : 'IPL'})`);
            toUpdate.push({
                id: player.id,
                battingStats: res.batStatsObj ? JSON.stringify(res.batStatsObj) : null,
                bowlingStats: res.bowlStatsObj ? JSON.stringify(res.bowlStatsObj) : null,
            });
        } else {
             console.log(`[FAILED] ${player.name} -> ${dbName} (No stats found in IPL or T20)`);
        }
    }

    const runSyncUpdates = sqliteDb.transaction((updates) => {
        for (const u of updates) {
            updateStmt.run(u.battingStats, u.bowlingStats, u.id);
        }
    });

    runSyncUpdates(toUpdate);
    console.log(`\nComplete! Fixed ${resolvedCount} out of ${missingPlayers.length} missing players.`);
    sqliteDb.close();
}

main().catch(console.error);
