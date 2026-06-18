import Database from 'better-sqlite3';
import path from 'path';

const csvData: Record<string, any> = {
    "Tejasvi Singh": {
        batting: { matches: 10, innings: 10, runs: 339, highestScore: 72, average: 48.43, strikeRate: 190.45, fours: 20, sixes: 29, centuries: 0, fifties: 4 }
    },
    "Naman Tiwari": {
        bowling: { matches: 10, innings: 10, overs: 37.4, runsConceded: 309, wickets: 19, bestWickets: "4/22", average: 16.26, economy: 8.20 }
    },
    "Vishal Nishad": {
        bowling: { matches: 8, innings: 8, overs: 0, runsConceded: 0, wickets: 8, bestWickets: "0/0", average: 0, economy: 0 }
    },
    "Satvik Deswal": {
        bowling: { matches: 10, innings: 10, overs: 40.0, runsConceded: 236, wickets: 14, bestWickets: "3/11", average: 16.86, economy: 5.90 }
    },
    "Onkar Tarmale": {
        batting: { matches: 46, innings: 46, runs: 389, highestScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 46, innings: 46, overs: 0, runsConceded: 0, wickets: 48, bestWickets: "3/28", average: 0, economy: 0 }
    }
};

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const sqliteDb = new Database(sqlitePath);
    
    const updateStmt = sqliteDb.prepare("UPDATE players SET battingStats = ?, bowlingStats = ? WHERE name = ?");
    
    let resolvedCount = 0;
    
    sqliteDb.transaction(() => {
        for (const [playerName, stats] of Object.entries(csvData)) {
            // First fetch existing to not wipe out things unnecessarily if they have some info, 
            // but for these guys we will just overwrite with what we have in CSV.
            const existing = sqliteDb.prepare("SELECT * FROM players WHERE name = ?").get(playerName) as any;
            if (existing) {
                // If they had existing zero stats, we overwrite them.
                // We must preserve existing batting if we only provide bowling, and vice versa.
                let batStr = existing.battingStats;
                let bowlStr = existing.bowlingStats;
                
                if (stats.batting) {
                    batStr = JSON.stringify(stats.batting);
                }
                if (stats.bowling) {
                    bowlStr = JSON.stringify(stats.bowling);
                }
                
                updateStmt.run(batStr, bowlStr, playerName);
                console.log(`[UPDATED FROM CSV] ${playerName}`);
                resolvedCount++;
            }
        }
    })();

    console.log(`\nComplete! Updated ${resolvedCount} players from local CSV data.`);
    sqliteDb.close();
}

main().catch(console.error);
