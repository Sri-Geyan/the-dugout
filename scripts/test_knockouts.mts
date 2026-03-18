import { LeagueState, FixtureEntry, processMatchResult, MatchResult } from '../lib/leagueEngine';

// Mock teams
const teams = [
    { userId: 'u1', teamName: 'CSK', squad: [] },
    { userId: 'u2', teamName: 'MI', squad: [] },
    { userId: 'u3', teamName: 'RCB', squad: [] },
    { userId: 'u4', teamName: 'KKR', squad: [] },
];

// 1. Initial State (All League Matches Completed)
const state: LeagueState = {
    roomCode: 'TEST',
    status: 'active',
    phase: 'league',
    fixtures: [
        { id: 'f1', homeTeamUserId: 'u1', homeTeamName: 'CSK', awayTeamUserId: 'u2', awayTeamName: 'MI', scheduledOrder: 1, status: 'completed' },
        { id: 'f2', homeTeamUserId: 'u3', homeTeamName: 'RCB', awayTeamUserId: 'u4', awayTeamName: 'KKR', scheduledOrder: 2, status: 'completed' },
        // ... more matches
    ],
    standings: [
        { userId: 'u1', teamName: 'CSK', matches: 1, wins: 1, losses: 0, ties: 0, points: 2, nrr: 1.0, runsScored: 100, runsConceded: 80, oversFaced: 120, oversBowled: 120 },
        { userId: 'u2', teamName: 'MI', matches: 1, wins: 1, losses: 0, ties: 0, points: 2, nrr: 0.5, runsScored: 120, runsConceded: 100, oversFaced: 120, oversBowled: 120 },
        { userId: 'u3', teamName: 'RCB', matches: 1, wins: 1, losses: 0, ties: 0, points: 2, nrr: 0.2, runsScored: 110, runsConceded: 105, oversFaced: 120, oversBowled: 120 },
        { userId: 'u4', teamName: 'KKR', matches: 1, wins: 0, losses: 1, ties: 0, points: 0, nrr: -0.5, runsScored: 80, runsConceded: 100, oversFaced: 120, oversBowled: 120 },
    ],
    playerStats: [],
    currentMatchIndex: 1,
    totalMatches: 2,
    orangeCap: null,
    purpleCap: null,
    mvp: null,
    teams: teams as any,
};

console.log('--- Phase 1: League Completion ---');
// Simulating the last match completion
const lastFixture = state.fixtures[1];
const mockResult: MatchResult = {
    homeUserId: 'u3', awayUserId: 'u4', homeScore: 110, homeWickets: 5, homeOvers: 20, homeBalls: 0,
    awayScore: 105, awayWickets: 8, awayOvers: 20, awayBalls: 0, result: 'RCB won', winnerUserId: 'u3',
    homePlayers: [], awayPlayers: [], battingStats: [], bowlingStats: []
};

processMatchResult(state, lastFixture, mockResult);

console.log('Current Phase:', state.phase);
console.log('Fixture Count:', state.fixtures.length);
console.log('Playoff Fixtures:', state.fixtures.filter(f => f.isKnockout).map(f => `${f.knockoutType}: ${f.homeTeamName} vs ${f.awayTeamName}`));

// 2. Playoff Q1
console.log('\n--- Phase 2: Q1 Completion ---');
const q1 = state.fixtures.find(f => f.knockoutType === 'Q1')!;
q1.status = 'completed';
const q1Result: MatchResult = {
    homeUserId: 'u1', awayUserId: 'u2', homeScore: 180, homeWickets: 5, homeOvers: 20, homeBalls: 0,
    awayScore: 170, awayWickets: 8, awayOvers: 20, awayBalls: 0, result: 'CSK won', winnerUserId: 'u1',
    homePlayers: [], awayPlayers: [], battingStats: [], bowlingStats: []
};
processMatchResult(state, q1, q1Result);

const final = state.fixtures.find(f => f.knockoutType === 'FINAL')!;
const q2 = state.fixtures.find(f => f.knockoutType === 'Q2')!;
console.log('Final Home Team (Winner Q1):', final.homeTeamName);
console.log('Q2 Home Team (Loser Q1):', q2.homeTeamName);

// 3. Playoff Elim
console.log('\n--- Phase 3: Eliminator Completion ---');
const elim = state.fixtures.find(f => f.knockoutType === 'ELIM')!;
elim.status = 'completed';
const elimResult: MatchResult = {
    homeUserId: 'u3', awayUserId: 'u4', homeScore: 160, homeWickets: 3, homeOvers: 19.1, homeBalls: 1,
    awayScore: 159, awayWickets: 10, awayOvers: 20, awayBalls: 0, result: 'RCB won', winnerUserId: 'u3',
    homePlayers: [], awayPlayers: [], battingStats: [], bowlingStats: []
};
processMatchResult(state, elim, elimResult);
console.log('Q2 Away Team (Winner Elim):', q2.awayTeamName);

// 4. Playoff Q2
console.log('\n--- Phase 4: Q2 Completion ---');
q2.status = 'completed';
const q2Result: MatchResult = {
    homeUserId: 'u2', awayUserId: 'u3', homeScore: 190, homeWickets: 6, homeOvers: 20, homeBalls: 0,
    awayScore: 180, awayWickets: 9, awayOvers: 20, awayBalls: 0, result: 'MI won', winnerUserId: 'u2',
    homePlayers: [], awayPlayers: [], battingStats: [], bowlingStats: []
};
processMatchResult(state, q2, q2Result);
console.log('Final Away Team (Winner Q2):', final.awayTeamName);

// 5. Final
console.log('\n--- Phase 5: Final Completion ---');
final.status = 'completed';
const finalResult: MatchResult = {
    homeUserId: 'u1', awayUserId: 'u2', homeScore: 200, homeWickets: 4, homeOvers: 20, homeBalls: 0,
    awayScore: 190, awayWickets: 7, awayOvers: 20, awayBalls: 0, result: 'CSK won', winnerUserId: 'u1',
    homePlayers: [], awayPlayers: [], battingStats: [], bowlingStats: []
};
processMatchResult(state, final, finalResult);
console.log('League Status:', state.status);
console.log('--- TEST COMPLETED ---');
