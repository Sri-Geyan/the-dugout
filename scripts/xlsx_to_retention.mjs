/**
 * xlsx_to_retention.mjs
 * Parses IPL_2026_Retention_Dataset (1).xlsx → data/retentionPool.ts
 * Run: node scripts/xlsx_to_retention.mjs
 */

import xlsx from 'xlsx';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const wb = xlsx.readFile(join(rootDir, 'IPL_2026_Retention_Dataset (1).xlsx'));

// ─── Nat normalization ────────────────────────────────────────────────────────
function normalizeNat(nat) {
    return nat?.trim() === 'Indian' ? 'Indian' : 'Overseas';
}

// ─── Role normalization ───────────────────────────────────────────────────────
function normalizeRole(role) {
    switch (role?.trim()) {
        case 'Batsman': return 'BATSMAN';
        case 'Bowler': return 'BOWLER';
        case 'All-Rounder': return 'ALL_ROUNDER';
        case 'Wicket-Keeper': return 'WICKET_KEEPER';
        default: return 'BATSMAN';
    }
}

// ─── Team-specific sheets ─────────────────────────────────────────────────────
// Col indices in per-team sheets: 0=#, 1=Name, 2=Role, 3=Nat, 4=Age, 5=Caps, 6=Price2025, 7=CapStatus, 8=Status
const TEAM_SHEETS = [
    'Chennai Super Kings',
    'Delhi Capitals',
    'Gujarat Titans',
    'Kolkata Knight Riders',
    'Lucknow Super Giants',
    'Mumbai Indians',
    'Punjab Kings',
    'Rajasthan Royals',
    'Royal Challengers Bengaluru',
    'Sunrisers Hyderabad',
];

// Statuses that make a player eligible for the retention pool
// (All players who were in the squad — user decides who to actually retain)
const ELIGIBLE_STATUSES = ['Retained', 'Released'];

const pool = {};

for (const teamName of TEAM_SHEETS) {
    const ws = wb.Sheets[teamName];
    if (!ws) { console.warn('Sheet not found:', teamName); continue; }

    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    // Row 0 = title, Row 1 = headers, Row 2+ = data
    const rows = data.slice(2).filter(r => r[1] && typeof r[1] === 'string');

    const players = rows
        .filter(r => ELIGIBLE_STATUSES.includes(r[8]))
        .map(r => ({
            name: String(r[1]).trim(),
            role: normalizeRole(r[2]),
            nationality: normalizeNat(r[3]),
            auctionPrice2025: Number(r[6]) || 0,
            capStatus: r[7] === 'Capped' ? 'Capped' : 'Uncapped',
        }));

    pool[teamName] = players;
    console.log(`${teamName}: ${players.length} eligible players`);
}

// ─── Generate TypeScript file ─────────────────────────────────────────────────
const lines = [
    `// Auto-generated from IPL_2026_Retention_Dataset (1).xlsx — do not edit manually`,
    `// Run: node scripts/xlsx_to_retention.mjs`,
    ``,
    `export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';`,
    ``,
    `export interface RetentionEligiblePlayer {`,
    `    name: string;`,
    `    role: PlayerRole;`,
    `    nationality: 'Indian' | 'Overseas';`,
    `    auctionPrice2025: number; // ₹ Cr — display only`,
    `    capStatus: 'Capped' | 'Uncapped';`,
    `}`,
    ``,
    `export const RETENTION_POOL: Record<string, RetentionEligiblePlayer[]> = {`,
];

for (const [team, players] of Object.entries(pool)) {
    lines.push(`    ${JSON.stringify(team)}: [`);
    for (const p of players) {
        lines.push(`        { name: ${JSON.stringify(p.name)}, role: '${p.role}', nationality: '${p.nationality}', auctionPrice2025: ${p.auctionPrice2025}, capStatus: '${p.capStatus}' },`);
    }
    lines.push(`    ],`);
}

lines.push(`};`, ``);

const outPath = join(rootDir, 'data', 'retentionPool.ts');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`\n✅ Generated ${outPath}`);
const total = Object.values(pool).reduce((s, arr) => s + arr.length, 0);
console.log(`Total eligible players across all teams: ${total}`);
