import Database from 'better-sqlite3';
import path from 'path';

const statsData: Record<string, any> = {
    "Auqib Nabi Dar": {
        batting: { matches: 39, innings: 19, runs: 155, highestScore: 32, average: 11.07, strikeRate: 113.97, fours: 6, sixes: 11, centuries: 0, fifties: 0 },
        bowling: { matches: 39, innings: 39, overs: 134.1, runsConceded: 1087, wickets: 43, bestWickets: "4/16", average: 25.27, economy: 8.10 }
    },
    "Gurnoor Singh Brar": {
        batting: { matches: 9, innings: 3, runs: 18, highestScore: 8, average: 6.00, strikeRate: 85.71, fours: 1, sixes: 1, centuries: 0, fifties: 0 },
        bowling: { matches: 9, innings: 9, overs: 31.1, runsConceded: 337, wickets: 10, bestWickets: "3/23", average: 33.70, economy: 10.81 }
    },
    "Prithvi Raj": {
        batting: { matches: 14, innings: 6, runs: 10, highestScore: 6, average: 5.00, strikeRate: 90.90, fours: 1, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 14, innings: 14, overs: 50.5, runsConceded: 452, wickets: 20, bestWickets: "3/4", average: 22.60, economy: 8.89 }
    },
    "Mukul Choudhary": {
        batting: { matches: 17, innings: 17, runs: 380, highestScore: 62, average: 34.54, strikeRate: 153.84, fours: 23, sixes: 26, centuries: 0, fifties: 3 }
    },
    "Wanindu Hasaranga": {
        batting: { matches: 37, innings: 19, runs: 81, highestScore: 18, average: 5.40, strikeRate: 92.04, fours: 7, sixes: 1, centuries: 0, fifties: 0 },
        bowling: { matches: 37, innings: 37, overs: 133, runsConceded: 1119, wickets: 46, bestWickets: "5/18", average: 24.32, economy: 8.41 }
    },
    "Jordan Cox": {
        batting: { matches: 179, innings: 166, runs: 4085, highestScore: 139, average: 30.71, strikeRate: 140.04, fours: 346, sixes: 162, centuries: 1, fifties: 21 }
    },
    "Sushant Mishra": {
        batting: { matches: 17, innings: 6, runs: 1, highestScore: 1, average: 0.50, strikeRate: 10.00, fours: 0, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 17, innings: 17, overs: 64.4, runsConceded: 595, wickets: 31, bestWickets: "4/28", average: 19.19, economy: 9.20 }
    },
    "Aman Rao Perala": {
        batting: { matches: 11, innings: 11, runs: 301, highestScore: 67, average: 33.44, strikeRate: 162.70, fours: 32, sixes: 16, centuries: 0, fifties: 2 }
    },
    "Shubham Dubey": {
        batting: { matches: 46, innings: 40, runs: 839, highestScore: 58, average: 33.56, strikeRate: 152.26, fours: 52, sixes: 51, centuries: 0, fifties: 2 }
    },
    "Harnoor Pannu": {
        batting: { matches: 9, innings: 8, runs: 169, highestScore: 64, average: 21.12, strikeRate: 130.00, fours: 17, sixes: 6, centuries: 0, fifties: 1 }
    },
    "Mohammad Izhar": {
        batting: { matches: 5, innings: 2, runs: 9, highestScore: 6, average: 9.00, strikeRate: 64.28, fours: 1, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 5, innings: 5, overs: 19.4, runsConceded: 140, wickets: 9, bestWickets: "4/39", average: 15.55, economy: 7.11 }
    },
    "Pyla Avinash": {
        batting: { matches: 13, innings: 12, runs: 198, highestScore: 55, average: 18.00, strikeRate: 116.47, fours: 13, sixes: 12, centuries: 0, fifties: 1 }
    },
    "Mangesh Yadav": {
        batting: { matches: 2, innings: 1, runs: 28, highestScore: 28, average: 28.00, strikeRate: 233.33, fours: 4, sixes: 1, centuries: 0, fifties: 0 },
        bowling: { matches: 2, innings: 2, overs: 7.0, runsConceded: 85, wickets: 3, bestWickets: "2/38", average: 28.33, economy: 12.14 }
    },
    "Smaran Ravichandaran": {
        batting: { matches: 19, innings: 17, runs: 508, highestScore: 72, average: 39.07, strikeRate: 155.82, fours: 35, sixes: 30, centuries: 0, fifties: 3 }
    },
    "Onkar Tarmale": {
        batting: { matches: 4, innings: 1, runs: 0, highestScore: 0, average: 0.00, strikeRate: 0.00, fours: 0, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 4, innings: 4, overs: 26.0, runsConceded: 146, wickets: 4, bestWickets: "2/38", average: 36.50, economy: 5.61 }
    },
    "Krains Fuletra": {
        batting: { matches: 2, innings: 0, runs: 0, highestScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 2, innings: 2, overs: 6.1, runsConceded: 62, wickets: 1, bestWickets: "1/30", average: 62.00, economy: 10.05 }
    },
    "Jamie Smith": {
        batting: { matches: 97, innings: 82, runs: 1687, highestScore: 87, average: 24.44, strikeRate: 144.31, fours: 133, sixes: 79, centuries: 0, fifties: 9 }
    },
    "Ruchit Ahir": {
        batting: { matches: 12, innings: 12, runs: 333, highestScore: 57, average: 41.62, strikeRate: 169.03, fours: 15, sixes: 25, centuries: 0, fifties: 2 }
    },
    "Raj Limbani": {
        batting: { matches: 11, innings: 4, runs: 14, highestScore: 7, average: 0.00, strike: 140.00, fours: 1, sixes: 1, centuries: 0, fifties: 0 },
        bowling: { matches: 11, innings: 10, overs: 31.1, runsConceded: 276, wickets: 16, bestWickets: "3/5", average: 17.25, economy: 8.85 }
    },
    "Kartikeya Singh": {
        batting: { matches: 54, innings: 14, runs: 34, highestScore: 6, average: 4.25, strikeRate: 85.00, fours: 4, sixes: 0, centuries: 0, fifties: 0 },
        bowling: { matches: 54, innings: 54, overs: 185.0, runsConceded: 1322, wickets: 56, bestWickets: "3/10", average: 23.60, economy: 7.14 }
    },
    "Ramakrishna Ghosh": {
        batting: { matches: 10, innings: 8, runs: 45, highestScore: 13, average: 9.00, strikeRate: 150.00, fours: 4, sixes: 2, centuries: 0, fifties: 0 },
        bowling: { matches: 10, innings: 10, overs: 26.0, runsConceded: 276, wickets: 3, bestWickets: "1/24", average: 92.00, economy: 10.61 }
    }
};

const otherPlayers = [
    "Tejasvi Singh",
    "Daksh Kamra",
    "Naman Tiwari",
    "Vishal Nishad",
    "Kanishk Chouhan",
    "Vihaan Malhotra",
    "Satvik Deswal",
    "Vansh Bedi"
];

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const sqliteDb = new Database(sqlitePath);
    
    const missingPlayers = sqliteDb.prepare("SELECT * FROM players WHERE battingStats IS NULL AND bowlingStats IS NULL").all() as any[];

    const updateStmt = sqliteDb.prepare("UPDATE players SET battingStats = ?, bowlingStats = ? WHERE id = ?");
    
    let resolvedCount = 0;
    
    sqliteDb.transaction(() => {
        for (const player of missingPlayers) {
            let pData = statsData[player.name];
            
            if (!pData && otherPlayers.includes(player.name)) {
                // Give them generic zero stats so they don't break the UI
                pData = {
                    batting: { matches: 0, innings: 0, runs: 0, highestScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, centuries: 0, fifties: 0 },
                    bowling: player.role !== 'BATSMAN' && player.role !== 'WICKET_KEEPER' 
                        ? { matches: 0, innings: 0, overs: 0, runsConceded: 0, wickets: 0, bestWickets: "0/0", average: 0, economy: 0 } 
                        : null
                };
            }

            if (pData) {
                resolvedCount++;
                const batStr = pData.batting ? JSON.stringify(pData.batting) : null;
                const bowlStr = pData.bowling ? JSON.stringify(pData.bowling) : null;
                updateStmt.run(batStr, bowlStr, player.id);
                console.log(`[RESOLVED] ${player.name}`);
            } else {
                console.log(`[FAILED] ${player.name}`);
            }
        }
    })();

    console.log(`\nComplete! Fixed ${resolvedCount} out of ${missingPlayers.length} missing players.`);
    sqliteDb.close();
}

main().catch(console.error);
