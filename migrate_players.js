const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(process.cwd(), 'IPL_2026_Auction_Dataset_Fixed.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { range: 1 }); // Start from header row

const players = data.map((row, index) => {
    // Basic mapping
    const id = row['Player ID'] || `p${index + 1}`;
    const name = row['Player Name'];
    const roleMap = {
        'Batsman': 'BATSMAN',
        'Bowler': 'BOWLER',
        'All-Rounder': 'ALL_ROUNDER',
        'Wicket-Keeper': 'WICKET_KEEPER'
    };
    const role = roleMap[row['Role']] || 'ALL_ROUNDER';
    
    return {
        id,
        name,
        role,
        battingSkill: row['Batting Rating (0–100)'] === 'N/A' ? 0 : Number(row['Batting Rating (0–100)']),
        bowlingSkill: row['Bowling Rating (0–100)'] === 'N/A' ? 0 : Number(row['Bowling Rating (0–100)']),
        basePrice: Number(row['Base Price (₹ Cr)']),
        nationality: row['Nationality'],
        age: row['Age'],
        battingRole: row['Batting Role'],
        bowlingRole: row['Bowling Role'],
        primaryArchetype: row['Primary Archetype'],
        secondaryArchetype: row['Secondary Archetype']
    };
});

const content = `export interface CricketPlayer {
    id: string;
    name: string;
    role: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
    battingSkill: number;
    bowlingSkill: number;
    basePrice: number;
    nationality: string;
    image?: string;
    // New fields
    age?: number;
    battingRole?: string;
    bowlingRole?: string;
    primaryArchetype?: string;
    secondaryArchetype?: string;
}

// Auto-generated from IPL_2026_Auction_Dataset_Fixed.xlsx — do not edit manually
export const IPL_PLAYERS: CricketPlayer[] = ${JSON.stringify(players, null, 4)};

// Legacy export for backward compatibility
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
    // Helper to find team if needed
    return name;
};
`;

fs.writeFileSync(path.join(process.cwd(), 'data/players.ts'), content);
console.log('Successfully updated data/players.ts with', players.length, 'players.');

// Generate retentionPool.ts
const retentionPool = {};
players.forEach(player => {
    const rawTeam = data.find(r => (r['Player ID'] || `p${data.indexOf(r) + 1}`) === player.id)?.['Team'];
    if (rawTeam && rawTeam !== 'N/A' && rawTeam !== '') {
        if (!retentionPool[rawTeam]) {
            retentionPool[rawTeam] = [];
        }
        retentionPool[rawTeam].push({
            name: player.name,
            role: player.role,
            nationality: player.nationality,
            auctionPrice2025: 0,
            capStatus: data.find(r => (r['Player ID'] || `p${data.indexOf(r) + 1}`) === player.id)?.['Cap Status'] || 'Capped'
        });
    }
});

const retentionContent = `// Auto-generated from IPL_2026_Auction_Dataset_Fixed.xlsx — do not edit manually
export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';

export interface RetentionEligiblePlayer {
    name: string;
    role: PlayerRole;
    nationality: 'Indian' | 'Overseas';
    auctionPrice2025: number; // ₹ Cr — display only
    capStatus: 'Capped' | 'Uncapped';
}

export const RETENTION_POOL: Record<string, RetentionEligiblePlayer[]> = ${JSON.stringify(retentionPool, null, 4)};
`;

fs.writeFileSync(path.join(process.cwd(), 'data/retentionPool.ts'), retentionContent);
console.log('Successfully updated data/retentionPool.ts with', Object.keys(retentionPool).length, 'teams.');
