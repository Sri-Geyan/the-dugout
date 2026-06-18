import Database from 'better-sqlite3';
import path from 'path';

// Define the interface for the parsed player object
export interface CricketPlayer {
    id: string;
    name: string;
    role: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
    battingStyle?: string;
    bowlingStyle?: string;
    nationality: string;
    basePrice: number;
    battingSkill: number | null;
    bowlingSkill: number | null;
    battingStats?: {
        matches: number;
        innings: number;
        runs: number;
        average: number;
        strikeRate: number;
        highestScore: number;
        fours: number;
        sixes: number;
        centuries: number;
        fifties: number;
        ducks: number;
        notOuts: number;
        ballsFaced: number;
    } | null;
    bowlingStats?: {
        matches: number;
        innings: number;
        overs: number;
        balls: number;
        runs: number;
        wickets: number;
        average: number;
        economy: number;
        strikeRate: number;
        fourWickets: number;
        fiveWickets: number;
        bestWickets: number;
    } | null;
    // UI specific logic compatibility
    image?: string;
    team?: string; // Some frontend pieces might expect this to exist optionally
    age?: number;
    battingRole?: string;
    bowlingRole?: string;
    primaryArchetype?: string;
    secondaryArchetype?: string;
    battingRating?: number;
    bowlingRating?: number;
}

// In Next.js App Router (especially Server Components or API routes),
// process.cwd() points to the root of the application
const dbPath = path.resolve(process.cwd(), 'players.db');
const db = new Database(dbPath, { readonly: true });

const BASE_QUERY = `
SELECT 
    p.*,
    b.matches as bat_matches, b.innings as bat_innings, b.runs as bat_runs, b.average as bat_average, 
    b.strikeRate as bat_strikeRate, b.highestScore as bat_highestScore, b.fours as bat_fours, 
    b.sixes as bat_sixes, b.centuries as bat_centuries, b.fifties as bat_fifties, b.ducks as bat_ducks,
    bw.matches as bowl_matches, bw.innings as bowl_innings, bw.wickets as bowl_wickets, 
    bw.economy as bowl_economy, bw.average as bowl_average, bw.bestWickets as bowl_bestWickets, bw.overs as bowl_overs
FROM players p
LEFT JOIN batting_stats b ON p.id = b.player_id
LEFT JOIN bowling_stats bw ON p.id = bw.player_id
`;

function mapRowToPlayer(row: any): CricketPlayer {
    return {
        ...row,
        battingSkill: row.dynamicBattingRating ?? null,
        bowlingSkill: row.dynamicBowlingRating ?? null,
        battingStats: row.bat_matches != null ? {
            matches: row.bat_matches,
            innings: row.bat_innings,
            runs: row.bat_runs,
            average: row.bat_average,
            strikeRate: row.bat_strikeRate,
            highestScore: row.bat_highestScore,
            fours: row.bat_fours,
            sixes: row.bat_sixes,
            centuries: row.bat_centuries,
            fifties: row.bat_fifties,
            ducks: row.bat_ducks,
            notOuts: 0,
            ballsFaced: 0,
        } : null,
        bowlingStats: row.bowl_matches != null ? {
            matches: row.bowl_matches,
            innings: row.bowl_innings,
            overs: row.bowl_overs,
            balls: 0,
            runs: 0,
            wickets: row.bowl_wickets,
            average: row.bowl_average,
            economy: row.bowl_economy,
            strikeRate: 0,
            fourWickets: 0,
            fiveWickets: 0,
            bestWickets: row.bowl_bestWickets || '-',
        } : null,
    };
}

export function getAllPlayers(): CricketPlayer[] {
    const rows = db.prepare(BASE_QUERY).all() as any[];
    return rows.map(mapRowToPlayer);
}

export function getPlayerById(id: string): CricketPlayer | null {
    const row = db.prepare(BASE_QUERY + ' WHERE p.id = ?').get(id) as any;
    if (!row) return null;
    return mapRowToPlayer(row);
}

export const TEAM_NAMES = [
    'Chennai Super Kings',
    'Mumbai Indians',
    'Royal Challengers Bengaluru',
    'Kolkata Knight Riders',
    'Delhi Capitals',
    'Sunrisers Hyderabad',
    'Punjab Kings',
    'Rajasthan Royals',
    'Lucknow Super Giants',
    'Gujarat Titans',
];

export const getTeamByName = (name: string) => {
    return name;
};
