
/**
 * Full Season Simulation Script
 * Simulates a full IPL season with 10 teams, league stage, and playoffs.
 */

import { IPL_PLAYERS, CricketPlayer } from '../data/players';
import { IPL_TEAMS } from '../data/teams';
import { botSelectPlaying11, botChooseNextBatter, botChooseNextBowler } from '../lib/botEngine';
import { simulateBall, MatchState, MatchTeam, MatchPlayer, BatterState, BowlerState, isSpinner } from '../lib/matchEngine';

interface TeamSeasonData {
    id: string;
    name: string;
    squad: CricketPlayer[];
    played: number;
    won: number;
    lost: number;
    points: number;
    nrr: number;
    runsScored: number;
    runsConceded: number;
    ballsFaced: number;
    ballsBowled: number;
}

interface PlayerStats {
    id: string;
    name: string;
    teamName: string;
    matches: number;
    runs: number;
    balls: number;
    wickets: number;
    runsConceded: number;
    ballsBowled: number;
    impactScore: number;
}

const teamData: TeamSeasonData[] = IPL_TEAMS.map(t => ({
    id: t.id,
    name: t.name,
    squad: [],
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    nrr: 0,
    runsScored: 0,
    runsConceded: 0,
    ballsFaced: 0,
    ballsBowled: 0
}));

const playerStatsMap = new Map<string, PlayerStats>();

// 1. Assign Squads (25 players each)
console.log("Assigning squads...");
const sortedPlayers = [...IPL_PLAYERS].sort((a, b) => (b.battingSkill + b.bowlingSkill) - (a.battingSkill + a.bowlingSkill));
for (let i = 0; i < 250; i++) {
    const teamIdx = i % 10;
    const player = sortedPlayers[i];
    teamData[teamIdx].squad.push(player);
    playerStatsMap.set(player.id, {
        id: player.id,
        name: player.name,
        teamName: teamData[teamIdx].name,
        matches: 0,
        runs: 0,
        balls: 0,
        wickets: 0,
        runsConceded: 0,
        ballsBowled: 0,
        impactScore: 0
    });
}

function getMatchPlayer(p: CricketPlayer): MatchPlayer {
    return {
        id: p.id,
        name: p.name,
        role: p.role,
        battingSkill: p.battingSkill,
        bowlingSkill: p.bowlingSkill,
        nationality: p.nationality,
        battingRole: p.battingRole,
        bowlingRole: p.bowlingRole,
        primaryArchetype: p.primaryArchetype,
        secondaryArchetype: p.secondaryArchetype,
        battingRating: p.battingRating,
        bowlingRating: p.bowlingRating
    };
}

function simulateFullMatch(homeTeam: TeamSeasonData, awayTeam: TeamSeasonData): MatchState {
    const pitchType = ['BATTING', 'BOWLING', 'BALANCED', 'SPINNING'][Math.floor(Math.random() * 4)] as any;
    
    // Select Playing 11
    const homeXIData = botSelectPlaying11(homeTeam.squad as any, pitchType);
    const awayXIData = botSelectPlaying11(awayTeam.squad as any, pitchType);

    const homeXI = homeXIData.actualOrder.map(p => getMatchPlayer(p as any));
    const awayXI = awayXIData.actualOrder.map(p => getMatchPlayer(p as any));

    // Update matches played
    homeXIData.selectedIds.forEach(id => {
        const s = playerStatsMap.get(id);
        if (s) s.matches++;
    });
    awayXIData.selectedIds.forEach(id => {
        const s = playerStatsMap.get(id);
        if (s) s.matches++;
    });

    // Initial State
    const state: MatchState = {
        matchId: `match-${Date.now()}`,
        roomCode: 'SIM',
        homeTeam: { teamId: homeTeam.id, name: homeTeam.name, userId: homeTeam.id, score: 0, wickets: 0, overs: 0, balls: 0, extras: 0, extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 }, fow: [], runRate: 0, players: homeXI },
        awayTeam: { teamId: awayTeam.id, name: awayTeam.name, userId: awayTeam.id, score: 0, wickets: 0, overs: 0, balls: 0, extras: 0, extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 }, fow: [], runRate: 0, players: awayXI },
        innings: 1,
        status: 'live',
        currentBatting: 'home',
        pitchType: pitchType,
        target: null,
        currentOver: 0,
        currentBall: 0,
        battingOrder: homeXI.map(p => ({ player: p, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', strikeRate: 0 })),
        bowlingOrder: awayXI.filter(p => p.role !== 'BATSMAN').map(p => ({ player: p, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, dots: 0, overBalls: 0, runsInOver: 0 })),
        striker: null,
        nonStriker: null,
        currentBowler: null,
        commentary: [],
        result: null,
        matchPhase: 'powerplay',
        freeHit: false,
        homeBattingOrder: homeXIData.battingOrder,
        awayBattingOrder: awayXIData.battingOrder,
        homeOpeningBowlerId: homeXIData.openingBowlerId,
        awayOpeningBowlerId: awayXIData.openingBowlerId
    };

    // Initial Batter/Bowler setup
    state.striker = state.battingOrder[0];
    state.nonStriker = state.battingOrder[1];
    state.currentBowler = state.bowlingOrder.find(b => b.player.id === state.awayOpeningBowlerId) || state.bowlingOrder[0];

    // Loop until completed
    while (state.status !== 'completed') {
        if (state.status === 'innings_break') {
            // Setup 2nd innings manually (simplified version of setupSecondInnings)
            state.innings = 2;
            state.currentBatting = 'away';
            state.pitchType = pitchType;
            state.currentOver = 0;
            state.currentBall = 0;
            state.target = state.homeTeam.score + 1;
            state.battingOrder = awayXI.map(p => ({ player: p, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: '', strikeRate: 0 }));
            state.bowlingOrder = homeXI.filter(p => p.role !== 'BATSMAN').map(p => ({ player: p, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, dots: 0, overBalls: 0, runsInOver: 0 }));
            state.striker = state.battingOrder[0];
            state.nonStriker = state.battingOrder[1];
            state.currentBowler = state.bowlingOrder.find(b => b.player.id === state.homeOpeningBowlerId) || state.bowlingOrder[0];
            state.status = 'live';
        }

        if (state.status === 'awaiting_batter') {
            const nextId = botChooseNextBatter(state as any);
            if (nextId) {
                const next = state.battingOrder.find(b => b.player.id === nextId);
                if (!state.striker) state.striker = next || null;
                else state.nonStriker = next || null;
                state.status = 'live';
            } else {
                 state.status = 'completed'; // Should not happen
            }
        }

        if (state.status === 'awaiting_bowler') {
            const nextId = botChooseNextBowler(state as any);
            if (nextId) {
                state.currentBowler = state.bowlingOrder.find(b => b.player.id === nextId) || null;
                state.status = 'live';
            }
        }

        if (state.status === 'live' && state.striker && state.currentBowler) {
            const phase = state.currentOver < 6 ? 'powerplay' : (state.currentOver < 15 ? 'middle' : 'death');
            const res = simulateBall(
                state.striker,
                state.currentBowler,
                state.pitchType,
                phase,
                state.freeHit,
                state.target,
                state.currentBatting === 'home' ? state.homeTeam.score : state.awayTeam.score,
                60, // Simplified balls remaining
                'stadium-1'
            );

            // Update stats
            const stats = playerStatsMap.get(state.striker.player.id);
            if (stats) {
                stats.runs += res.runs;
                stats.balls++;
            }
            const bStats = playerStatsMap.get(state.currentBowler.player.id);
            if (bStats) {
                bStats.runsConceded += (res.runs + res.extraRuns);
                if (res.isWicket) bStats.wickets++;
                if (!res.isExtra || res.extraType === 'NB') bStats.ballsBowled++;
            }

            // Update State (Manual update for simulation)
            const batTeam = state.currentBatting === 'home' ? state.homeTeam : state.awayTeam;
            batTeam.score += (res.runs + res.extraRuns);
            if (res.isWicket) {
                batTeam.wickets++;
                state.striker.isOut = true;
                state.striker = null;
                state.status = 'awaiting_batter';
            }
            
            if (state.striker) {
                state.striker.balls++;
                state.striker.runs += res.runs;
            }

            if (!res.isExtra || res.extraType === 'NB') {
                state.currentBall++;
                state.currentBowler.balls++;
                if (state.currentBall >= 6) {
                    state.currentBall = 0;
                    state.currentOver++;
                    state.status = 'awaiting_bowler';
                    // Rotate strike
                    const temp = state.striker;
                    state.striker = state.nonStriker;
                    state.nonStriker = temp;
                }
            }
            
            // End conditions
            if (batTeam.wickets >= 10 || state.currentOver >= 20) {
                if (state.innings === 1) state.status = 'innings_break';
                else state.status = 'completed';
            }
            if (state.innings === 2 && state.target && batTeam.score >= state.target) {
                state.status = 'completed';
            }
        } else if (state.status === 'live') {
             // Fallback
             state.status = 'completed';
        }
    }

    return state;
}

// 2. Simulate League Stage
console.log("Simulating League Stage...");
for (let i = 0; i < 10; i++) {
    for (let j = i + 1; j < 10; j++) {
        const home = teamData[i];
        const away = teamData[j];
        const state = simulateFullMatch(home, away);

        home.played++;
        away.played++;
        
        const hScore = state.homeTeam.score;
        const aScore = state.awayTeam.score;

        home.runsScored += hScore;
        home.runsConceded += aScore;
        away.runsScored += aScore;
        away.runsConceded += hScore;

        if (hScore > aScore || (state.innings === 2 && state.target && state.homeTeam.score >= state.target)) {
            home.won++;
            home.points += 2;
            away.lost++;
        } else {
            away.won++;
            away.points += 2;
            home.lost++;
        }
    }
}

// 3. Reports
console.log("\n=== SEASON REPORT ===\n");

// Team Squads
console.log("TEAM SQUADS (Top 25 per team):");
teamData.forEach(t => {
    console.log(`\n${t.name} (${t.id.toUpperCase()}):`);
    console.log(t.squad.map(p => ` - ${p.name} (${p.role})`).join('\n'));
});

// Team Playing 11s
console.log("\nTYPICAL PLAYING 11s (Based on BALANCED pitch):");
teamData.forEach(t => {
    console.log(`\n${t.name} (XI):`);
    const xiResult = botSelectPlaying11(t.squad as any, 'BALANCED');
    xiResult.actualOrder.forEach((p, i) => {
        console.log(` ${i + 1}. ${p.name.padEnd(25)} | ${p.primaryArchetype || p.role}`);
    });
});

// Final Standings
console.log("\nFINAL STANDINGS:");
const standings = [...teamData].sort((a, b) => b.points - a.points);
standings.forEach((t, i) => {
    console.log(`${i+1}. ${t.name.padEnd(25)} | P: ${t.played} | W: ${t.won} | L: ${t.lost} | Pts: ${t.points}`);
});

// Awards
const allStats = Array.from(playerStatsMap.values());
const orangeCap = allStats.sort((a, b) => b.runs - a.runs)[0];
const purpleCap = allStats.sort((a, b) => b.wickets - a.wickets)[0];
const mvp = allStats.sort((a, b) => (b.runs + b.wickets * 20) - (a.runs + a.wickets * 20))[0];

console.log("\nINDIVIDUAL AWARDS:");
console.log(`Orange Cap: ${orangeCap.name} (${orangeCap.teamName}) - ${orangeCap.runs} runs`);
console.log(`Purple Cap: ${purpleCap.name} (${purpleCap.teamName}) - ${purpleCap.wickets} wickets`);
console.log(`MVP:        ${mvp.name} (${mvp.teamName}) - ${mvp.runs} runs, ${mvp.wickets} wickets`);

console.log(`\nCHAMPION: ${standings[0].name} 🏆`);

console.log("\n=== END OF REPORT ===");
