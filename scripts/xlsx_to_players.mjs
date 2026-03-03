/**
 * xlsx_to_players.mjs
 * Converts IPL_2026_300_Players.xlsx into data/players.ts
 * Run: node scripts/xlsx_to_players.mjs
 */

import xlsx from 'xlsx';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ─── Read the xlsx ──────────────────────────────────────────────────────────
const wb = xlsx.readFile(join(rootDir, 'IPL_2026_300_Players.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });

// Rows 0 = title, 1 = headers, 2..301 = data
const headers = raw[1];
const rows = raw.slice(2);

// ─── Column indices ──────────────────────────────────────────────────────────
const COL = {
    id: 0,          // IPL26-001 etc.
    name: 1,
    team: 2,
    role: 3,
    nationality: 4,
    age: 5,
    caps: 6,
    capStatus: 7,
    basePrice: 8,   // in Cr
    status: 9,
};

// ─── Role mapping ────────────────────────────────────────────────────────────
function mapRole(xlsxRole) {
    switch (xlsxRole?.trim()) {
        case 'Batsman': return 'BATSMAN';
        case 'Bowler': return 'BOWLER';
        case 'All-Rounder': return 'ALL_ROUNDER';
        case 'Wicket-Keeper': return 'WICKET_KEEPER';
        default:
            console.warn('Unknown role:', xlsxRole);
            return 'BATSMAN';
    }
}

// ─── Nationality mapping ─────────────────────────────────────────────────────
function mapNationality(nat) {
    return nat?.trim() === 'Indian' ? 'Indian' : 'Overseas';
}

// ─── Skill generation ────────────────────────────────────────────────────────
/**
 * Derive batting & bowling skills from available metadata.
 *
 * Logic:
 *  - basePrice (0.25, 0.5, 1, 1.5, 2) → prestige tier (1–5)
 *  - IPL caps → experience bonus (capped at +10)
 *  - Cap status: Capped ≈ +5 overall quality boost, Uncapped = 0
 *  - Role determines which skill to emphasise
 *
 * Skill ranges match existing players.ts convention:
 *   Top talent: 88–96
 *   Solid capped: 75–87
 *   Mid-tier: 65–74
 *   Emerging: 50–64
 *   Tail-enders: 5–20
 */
function generateSkills(role, basePrice, caps, capStatus) {
    const isCapped = capStatus === 'Capped';
    const experienceBonus = Math.min(Math.floor(caps / 20), 10); // 0–10

    // Map base price to a base quality score
    // 2 Cr → 85, 1.5 Cr → 78, 1 Cr → 70, 0.5 Cr → 60, 0.25 Cr → 50
    const priceMap = { 2: 85, 1.5: 78, 1: 70, 0.5: 60, 0.25: 50 };
    const priceKey = Object.keys(priceMap).find(k => Math.abs(Number(k) - basePrice) < 0.01);
    let baseQuality = priceMap[priceKey] ?? 50;

    // Cap status bonus
    const capBonus = isCapped ? 5 : 0;

    const quality = Math.min(baseQuality + experienceBonus + capBonus, 95);

    let battingSkill, bowlingSkill;

    switch (role) {
        case 'BATSMAN':
            battingSkill = quality;
            bowlingSkill = 5;
            break;
        case 'WICKET_KEEPER':
            battingSkill = quality;
            bowlingSkill = 5;
            break;
        case 'BOWLER':
            battingSkill = Math.max(5, Math.floor(quality * 0.15));
            bowlingSkill = quality;
            break;
        case 'ALL_ROUNDER':
            // Both skills are meaningful but batting slightly prioritised
            battingSkill = Math.floor(quality * 0.88);
            bowlingSkill = Math.floor(quality * 0.82);
            break;
        default:
            battingSkill = quality;
            bowlingSkill = 5;
    }

    return { battingSkill, bowlingSkill };
}

// ─── Build CricketPlayer array ───────────────────────────────────────────────
const players = rows
    .filter(r => r[COL.name]) // skip empty rows
    .map((r, idx) => {
        const role = mapRole(r[COL.role]);
        const basePrice = Number(r[COL.basePrice]);
        const caps = Number(r[COL.caps]) || 0;
        const capStatus = r[COL.capStatus];
        const { battingSkill, bowlingSkill } = generateSkills(role, basePrice, caps, capStatus);

        return {
            id: `p${idx + 1}`,
            name: String(r[COL.name]).trim(),
            role,
            battingSkill,
            bowlingSkill,
            basePrice,
            nationality: mapNationality(r[COL.nationality]),
        };
    });

// ─── Build the TypeScript file ────────────────────────────────────────────────
const lines = [
    `export interface CricketPlayer {`,
    `    id: string;`,
    `    name: string;`,
    `    role: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';`,
    `    battingSkill: number;`,
    `    bowlingSkill: number;`,
    `    basePrice: number;`,
    `    nationality: string;`,
    `    image?: string;`,
    `}`,
    ``,
    `// Auto-generated from IPL_2026_300_Players.xlsx — do not edit manually`,
    `export const IPL_PLAYERS: CricketPlayer[] = [`,
    ...players.map(p =>
        `    { id: '${p.id}', name: '${p.name}', role: '${p.role}', battingSkill: ${p.battingSkill}, bowlingSkill: ${p.bowlingSkill}, basePrice: ${p.basePrice}, nationality: '${p.nationality}' },`
    ),
    `];`,
    ``,
    `// Legacy export for backward compatibility`,
    `export const TEAM_NAMES = [`,
    `    'Chennai Super Kings',`,
    `    'Mumbai Indians',`,
    `    'Royal Challengers Bengaluru',`,
    `    'Kolkata Knight Riders',`,
    `    'Delhi Capitals',`,
    `    'Sunrisers Hyderabad',`,
    `    'Punjab Kings',`,
    `    'Rajasthan Royals',`,
    `    'Lucknow Super Giants',`,
    `    'Gujarat Titans',`,
    `];`,
    ``,
];

const output = lines.join('\n');
const outPath = join(rootDir, 'data', 'players.ts');
writeFileSync(outPath, output, 'utf8');

console.log(`✅ Generated ${players.length} players → ${outPath}`);
// Summary stats
const roles = {};
const nats = {};
players.forEach(p => {
    roles[p.role] = (roles[p.role] || 0) + 1;
    nats[p.nationality] = (nats[p.nationality] || 0) + 1;
});
console.log('Roles:', roles);
console.log('Nationalities:', nats);
console.log('Base prices:', [...new Set(players.map(p => p.basePrice))].sort((a, b) => a - b));
