import Database from 'better-sqlite3';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs';

const BATTING_SQL = `
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
      WHERE d.batter = $player_name AND m.event_name = 'Indian Premier League'
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

const BOWLING_SQL = `
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
      WHERE d.bowler = $player_name AND m.event_name = 'Indian Premier League'
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

async function findDuckDbName(conn: any, name: string): Promise<string | null> {
    // 1. Exact match
    let q = await conn.run("SELECT DISTINCT name FROM (SELECT batter as name FROM deliveries WHERE batter = $n UNION SELECT bowler as name FROM deliveries WHERE bowler = $n)", { n: name });
    let rows = await q.getRows();
    if (rows.length > 0) return rows[0][0] as string;

    // 2. Initial + Last Name match (e.g. "Ruturaj Gaikwad" -> "R% Gaikwad")
    const parts = name.split(' ');
    if (parts.length >= 2) {
        const firstInitial = parts[0][0];
        const lastName = parts.slice(1).join(' ');
        
        const likeQuery = `${firstInitial}% ${lastName}`;
        q = await conn.run("SELECT DISTINCT name FROM (SELECT batter as name FROM deliveries WHERE batter LIKE $q UNION SELECT bowler as name FROM deliveries WHERE bowler LIKE $q)", { q: likeQuery });
        rows = await q.getRows();
        if (rows.length === 1) return rows[0][0] as string;

        // 3. Just last name match
        const likeQuery2 = `% ${lastName}`;
        q = await conn.run("SELECT DISTINCT name FROM (SELECT batter as name FROM deliveries WHERE batter LIKE $q UNION SELECT bowler as name FROM deliveries WHERE bowler LIKE $q)", { q: likeQuery2 });
        rows = await q.getRows();
        if (rows.length === 1) return rows[0][0] as string;
    }

    // 4. Special manual aliases
    const aliases: Record<string, string> = {
        "Faf du Plessis": "F du Plessis",
        "Quinton de Kock": "Q de Kock",
        "Rassie van der Dussen": "HE van der Dussen",
        "Mitchell Santner": "MJ Santner",
        "Rachin Ravindra": "R Ravindra"
    };
    if (aliases[name]) return aliases[name];

    return null;
}

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const duckdbPath = path.join(process.cwd(), 'cricket-mcp', 'data', 'cricket.duckdb');

    console.log("Reading existing players from SQLite...");
    const sqliteDb = new Database(sqlitePath);
    const existingPlayers = sqliteDb.prepare("SELECT * FROM players").all() as any[];
    console.log(`Loaded ${existingPlayers.length} players.`);

    console.log("Connecting to DuckDB...");
    const duckDbInstance = await DuckDBInstance.create(duckdbPath);
    const duckDbConn = await duckDbInstance.connect();

    console.log("Fetching stats from DuckDB...");
    const updatedPlayers = [];
    let notFound = 0;

    for (const player of existingPlayers) {
        const dbName = await findDuckDbName(duckDbConn, player.name);
        
        if (!dbName) {
            console.log(`[WARN] Could not resolve DuckDB name for: ${player.name}`);
            notFound++;
            player.battingStats = null;
            player.bowlingStats = null;
            updatedPlayers.push(player);
            continue;
        }

        let batStatsObj = null;
        if (player.role !== 'BOWLER') {
            const batRes = await duckDbConn.run(BATTING_SQL, { player_name: dbName });
            const rows = await batRes.getRows();
            if (rows.length > 0) {
                const r = rows[0];
                batStatsObj = convertBigIntsToNumbers({
                    matches: r[0],
                    innings: r[1],
                    runs: r[3],
                    average: r[5],
                    strikeRate: r[7],
                    highestScore: r[4],
                    fours: r[8],
                    sixes: r[9],
                    centuries: r[10],
                    fifties: r[11],
                    ducks: r[12]
                });
            }
        }

        let bowlStatsObj = null;
        if (player.role !== 'BATSMAN' && player.role !== 'WICKET_KEEPER') {
            const bowlRes = await duckDbConn.run(BOWLING_SQL, { player_name: dbName });
            const rows = await bowlRes.getRows();
            if (rows.length > 0) {
                const r = rows[0];
                bowlStatsObj = convertBigIntsToNumbers({
                    matches: r[0],
                    innings: r[1],
                    wickets: r[5],
                    economy: r[7],
                    average: r[6],
                    bestWickets: `${r[11]}/${r[12]}`,
                    overs: r[2], // we skip partial overs formatting for simplicity
                });
            }
        }

        player.battingStats = batStatsObj ? JSON.stringify(batStatsObj) : null;
        player.bowlingStats = bowlStatsObj ? JSON.stringify(bowlStatsObj) : null;
        updatedPlayers.push(player);
    }

    console.log(`\nStats computed. ${notFound} players not found in DuckDB.`);
    
    console.log("Rebuilding SQLite players table...");
    // Create backup just in case
    if (fs.existsSync(sqlitePath)) {
        fs.copyFileSync(sqlitePath, sqlitePath + '.backup');
    }

    sqliteDb.exec("DROP TABLE players");
    sqliteDb.exec(`
        CREATE TABLE players (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            battingStyle TEXT,
            bowlingStyle TEXT,
            nationality TEXT NOT NULL,
            basePrice INTEGER NOT NULL,
            battingSkill INTEGER,
            bowlingSkill INTEGER,
            battingStats JSON,
            bowlingStats JSON
        )
    `);

    const insertStmt = sqliteDb.prepare(`
        INSERT INTO players (id, name, role, battingStyle, bowlingStyle, nationality, basePrice, battingSkill, bowlingSkill, battingStats, bowlingStats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqliteDb.transaction((players) => {
        for (const p of players) {
            insertStmt.run(
                p.id, p.name, p.role, p.battingStyle, p.bowlingStyle, p.nationality,
                p.basePrice, p.battingSkill, p.bowlingSkill, p.battingStats, p.bowlingStats
            );
        }
    });

    insertMany(updatedPlayers);
    console.log("SQLite players table recreated successfully!");

    sqliteDb.close();
}

main().catch(console.error);
