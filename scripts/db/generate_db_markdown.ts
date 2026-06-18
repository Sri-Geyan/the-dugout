import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
const db = new Database(sqlitePath);
const players = db.prepare('SELECT id, name, role, nationality, basePrice, battingStats, bowlingStats FROM players ORDER BY role, name').all() as any[];

let md = '# Players Database\n\nTotal Players: ' + players.length + '\n\n| ID | Name | Role | Nationality | Base Price | Batting Stats? | Bowling Stats? |\n|---|---|---|---|---|---|---|\n';
for (const p of players) {
    const batStats = p.battingStats !== null ? 'Yes' : 'No';
    const bowlStats = p.bowlingStats !== null ? 'Yes' : 'No';
    const basePrice = (p.basePrice / 100000) + 'L';
    md += `| ${p.id} | ${p.name} | ${p.role} | ${p.nationality} | ${basePrice} | ${batStats} | ${bowlStats} |\n`;
}

fs.writeFileSync('players_db.md', md);
console.log('Saved to players_db.md');
