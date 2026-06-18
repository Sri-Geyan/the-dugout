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
const dbPath = path.resolve(process.cwd(), 'data/players.db');
const db = new Database(dbPath, { readonly: true });

export function getAllPlayers(): CricketPlayer[] {
    const rows = db.prepare('SELECT * FROM players').all() as any[];
    return rows.map(row => ({
        ...row,
        battingStats: row.battingStats ? JSON.parse(row.battingStats) : null,
        bowlingStats: row.bowlingStats ? JSON.parse(row.bowlingStats) : null,
    }));
}

export function getPlayerById(id: string): CricketPlayer | null {
    const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
        ...row,
        battingStats: row.battingStats ? JSON.parse(row.battingStats) : null,
        bowlingStats: row.bowlingStats ? JSON.parse(row.bowlingStats) : null,
    };
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
