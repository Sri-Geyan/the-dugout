import redis from './redis';
import { MatchState } from './matchEngine';

// ======================================================
// League State Interfaces
// ======================================================

export interface LeagueTeam {
    userId: string;
    username: string;
    teamName: string;
    teamId?: string;
    squad: { player: { id: string; name: string; role: string; battingSkill: number; bowlingSkill: number; nationality?: string }; soldPrice: number }[];
}

export interface FixtureEntry {
    id: string;
    homeTeamUserId: string;
    homeTeamName: string;
    awayTeamUserId: string;
    awayTeamName: string;
    scheduledOrder: number;
    status: 'pending' | 'pre_match' | 'live' | 'completed';
    isKnockout?: boolean;
    knockoutType?: 'Q1' | 'ELIM' | 'Q2' | 'FINAL';
    matchId?: string;
    homeScore?: number;
    homeWickets?: number;
    homeOvers?: number;
    awayScore?: number;
    awayWickets?: number;
    awayOvers?: number;
    result?: string;
}

export interface TeamStanding {
    userId: string;
    teamName: string;
    teamId?: string;
    matches: number;
    wins: number;
    losses: number;
    ties: number;
    points: number;
    nrr: number;
    runsScored: number;
    runsConceded: number;
    oversFaced: number;   // in balls
    oversBowled: number;  // in balls
}

export interface PlayerStats {
    playerId: string;
    playerName: string;
    teamName: string;
    teamId?: string;
    matches: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    wickets: number;
    oversBowled: number; // in balls
    runsConceded: number;
    catches: number;
    highestScore: number;
    centuries: number;
    halfCenturies: number;
    bestBowlingWickets: number;
    bestBowlingRuns: number;
    impactScore: number;
}

export interface LeagueState {
    roomCode: string;
    status: 'active' | 'completed';
    phase: 'league' | 'playoffs';
    fixtures: FixtureEntry[];
    standings: TeamStanding[];
    playerStats: PlayerStats[];
    currentMatchIndex: number;
    totalMatches: number;
    orangeCap: { playerId: string; playerName: string; teamName: string; runs: number } | null;
    purpleCap: { playerId: string; playerName: string; teamName: string; wickets: number } | null;
    mvp: { playerId: string; playerName: string; teamName: string; impactScore: number } | null;
    teams: LeagueTeam[];
}

// ======================================================
// Fixture Generation — Round-Robin
// ======================================================

export function generateFixtures(teams: LeagueTeam[]): FixtureEntry[] {
    const n = teams.length;
    const fixtures: FixtureEntry[] = [];
    let order = 1;

    // Single round-robin: each team plays every other team once
    // To achieve 5 home / 4 away (or 4 home / 5 away) for 10 teams:
    // We use a simple parity-based assignment for home/away
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            pairs.push([i, j]);
        }
    }

    // Shuffle pairs first
    for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    // Track home game counts to try and stay close to 5/4 or 4/5
    const homeCounts = new Array(n).fill(0);

    pairs.forEach(([i, j]) => {
        let homeIdx = i;
        let awayIdx = j;

        // Balance logic: if team i has more home games than j, swap them
        if (homeCounts[i] > homeCounts[j]) {
            homeIdx = j;
            awayIdx = i;
        } else if (homeCounts[i] === homeCounts[j]) {
            // Randomize if equal
            if (Math.random() > 0.5) {
                homeIdx = j;
                awayIdx = i;
            }
        }

        fixtures.push({
            id: `fixture-${order}`,
            homeTeamUserId: teams[homeIdx].userId,
            homeTeamName: teams[homeIdx].teamName,
            awayTeamUserId: teams[awayIdx].userId,
            awayTeamName: teams[awayIdx].teamName,
            scheduledOrder: order,
            status: 'pending',
        });
        homeCounts[homeIdx]++;
        order++;
    });

    // Shuffle fixtures for variety (Fisher-Yates)
    for (let i = fixtures.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
    }

    // Re-assign order after shuffle
    fixtures.forEach((f, idx) => {
        f.scheduledOrder = idx + 1;
        f.id = `fixture-${idx + 1}`;
    });

    return fixtures;
}

// ======================================================
// League Initialization
// ======================================================

export function initLeagueState(roomCode: string, teams: LeagueTeam[]): LeagueState {
    const fixtures = generateFixtures(teams);

    const standings: TeamStanding[] = teams.map(t => ({
        userId: t.userId,
        teamName: t.teamName,
        teamId: t.teamId,
        matches: 0, wins: 0, losses: 0, ties: 0,
        points: 0, nrr: 0,
        runsScored: 0, runsConceded: 0,
        oversFaced: 0, oversBowled: 0,
    }));

    return {
        roomCode,
        status: 'active',
        phase: 'league',
        fixtures,
        standings,
        teams,
        playerStats: [],
        currentMatchIndex: 0,
        totalMatches: fixtures.length,
        orangeCap: null,
        purpleCap: null,
        mvp: null,
    };
}

// ======================================================
// Standings Update after a match
// ======================================================

export interface MatchResult {
    homeUserId: string;
    awayUserId: string;
    homeScore: number;
    homeWickets: number;
    homeOvers: number;  // decimal e.g. 18.3
    homeBalls: number;
    awayScore: number;
    awayWickets: number;
    awayOvers: number;
    awayBalls: number;
    result: string;
    winnerUserId: string | null; // null = tie
    homePlayers: string[]; // List of all 11 player IDs
    awayPlayers: string[]; // List of all 11 player IDs
    battingStats: { playerId: string; playerName: string; teamName: string; teamId?: string; runs: number; balls: number; fours: number; sixes: number; isOut: boolean }[];
    bowlingStats: { playerId: string; playerName: string; teamName: string; teamId?: string; overs: number; balls: number; runs: number; wickets: number }[];
}

export function updateStandings(state: LeagueState, matchResult: MatchResult): void {
    const home = state.standings.find(s => s.userId === matchResult.homeUserId);
    const away = state.standings.find(s => s.userId === matchResult.awayUserId);

    if (!home || !away) return;

    // Update matches count
    home.matches++;
    away.matches++;

    // Calculate balls for NRR
    // Cricket Rule: If a team is all out, their overs faced is considered to be the full quota (20.0)
    const homeBallsFaced = matchResult.homeWickets >= 10 
        ? 120 
        : oversToBalls(matchResult.homeOvers, matchResult.homeBalls);
    
    const awayBallsFaced = matchResult.awayWickets >= 10 
        ? 120 
        : oversToBalls(matchResult.awayOvers, matchResult.awayBalls);

    // Home team batting first, away team chasing
    home.runsScored += matchResult.homeScore;
    home.oversFaced += homeBallsFaced;
    home.runsConceded += matchResult.awayScore;
    home.oversBowled += awayBallsFaced;

    away.runsScored += matchResult.awayScore;
    away.oversFaced += awayBallsFaced;
    away.runsConceded += matchResult.homeScore;
    away.oversBowled += homeBallsFaced;

    // Win/loss/tie
    if (matchResult.winnerUserId === matchResult.homeUserId) {
        home.wins++;
        home.points += 2;
        away.losses++;
    } else if (matchResult.winnerUserId === matchResult.awayUserId) {
        away.wins++;
        away.points += 2;
        home.losses++;
    } else {
        // Tie
        home.ties++;
        away.ties++;
        home.points += 1;
        away.points += 1;
    }

    // Recalculate NRR for all teams
    for (const team of state.standings) {
        if (team.oversFaced > 0 && team.oversBowled > 0) {
            const scoringRate = (team.runsScored / team.oversFaced) * 6;
            const concedingRate = (team.runsConceded / team.oversBowled) * 6;
            team.nrr = Math.round((scoringRate - concedingRate) * 1000) / 1000;
        }
    }

    // Sort standings: points DESC, then NRR DESC
    state.standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.nrr - a.nrr;
    });

    // Check if league phase is complete
    if (state.phase === 'league') {
        const allLeagueDone = state.fixtures.every(f => !f.isKnockout && f.status === 'completed');
        if (allLeagueDone) {
            generatePlayoffFixtures(state);
        }
    }
}

export function generatePlayoffFixtures(state: LeagueState): void {
    if (state.standings.length < 4) {
        state.status = 'completed';
        return;
    }

    const top4 = state.standings.slice(0, 4);
    const q1: FixtureEntry = {
        id: `playoff-q1`,
        homeTeamUserId: top4[0].userId,
        homeTeamName: top4[0].teamName,
        awayTeamUserId: top4[1].userId,
        awayTeamName: top4[1].teamName,
        scheduledOrder: state.fixtures.length + 1,
        status: 'pending',
        isKnockout: true,
        knockoutType: 'Q1',
    };

    const elim: FixtureEntry = {
        id: `playoff-elim`,
        homeTeamUserId: top4[2].userId,
        homeTeamName: top4[2].teamName,
        awayTeamUserId: top4[3].userId,
        awayTeamName: top4[3].teamName,
        scheduledOrder: state.fixtures.length + 2,
        status: 'pending',
        isKnockout: true,
        knockoutType: 'ELIM',
    };

    const q2: FixtureEntry = {
        id: `playoff-q2`,
        homeTeamUserId: '', // Loser Q1 Placeholder
        homeTeamName: 'Loser Qualifier 1',
        awayTeamUserId: '', // Winner Eliminator Placeholder
        awayTeamName: 'Winner Eliminator',
        scheduledOrder: state.fixtures.length + 3,
        status: 'pending',
        isKnockout: true,
        knockoutType: 'Q2',
    };

    const final: FixtureEntry = {
        id: `playoff-final`,
        homeTeamUserId: '', // Winner Q1 Placeholder
        homeTeamName: 'Winner Qualifier 1',
        awayTeamUserId: '', // Winner Q2 Placeholder
        awayTeamName: 'Winner Qualifier 2',
        scheduledOrder: state.fixtures.length + 4,
        status: 'pending',
        isKnockout: true,
        knockoutType: 'FINAL',
    };

    state.fixtures.push(q1, elim, q2, final);
    state.totalMatches = state.fixtures.length;
    state.phase = 'playoffs';
}

function handlePlayoffAdvancement(state: LeagueState, fixture: FixtureEntry, matchResult: MatchResult) {
    const winnerId = matchResult.winnerUserId;
    if (!winnerId) return; // In knockouts, we should eventually handle ties (Super Over)

    const homeTeam = state.teams.find(t => t.userId === fixture.homeTeamUserId);
    const awayTeam = state.teams.find(t => t.userId === fixture.awayTeamUserId);
    const winnerTeam = winnerId === fixture.homeTeamUserId ? homeTeam : awayTeam;
    const loserTeam = winnerId === fixture.homeTeamUserId ? awayTeam : homeTeam;

    if (fixture.knockoutType === 'Q1') {
        const final = state.fixtures.find(f => f.knockoutType === 'FINAL');
        const q2 = state.fixtures.find(f => f.knockoutType === 'Q2');
        if (final && winnerTeam) {
            final.homeTeamUserId = winnerTeam.userId;
            final.homeTeamName = winnerTeam.teamName;
        }
        if (q2 && loserTeam) {
            q2.homeTeamUserId = loserTeam.userId;
            q2.homeTeamName = loserTeam.teamName;
        }
    } else if (fixture.knockoutType === 'ELIM') {
        const q2 = state.fixtures.find(f => f.knockoutType === 'Q2');
        if (q2 && winnerTeam) {
            q2.awayTeamUserId = winnerTeam.userId;
            q2.awayTeamName = winnerTeam.teamName;
        }
    } else if (fixture.knockoutType === 'Q2') {
        const final = state.fixtures.find(f => f.knockoutType === 'FINAL');
        if (final && winnerTeam) {
            final.awayTeamUserId = winnerTeam.userId;
            final.awayTeamName = winnerTeam.teamName;
        }
    } else if (fixture.knockoutType === 'FINAL') {
        state.status = 'completed';
    }
}

function oversToBalls(overs: number, extraBalls: number): number {
    return Math.floor(overs) * 6 + extraBalls;
}

// ======================================================
// Player Stats Accumulation
// ======================================================

export function updatePlayerStats(state: LeagueState, matchResult: MatchResult): void {
    // Use a Map for O(1) lookups during the update
    const statsMap = new Map(state.playerStats.map(p => [p.playerId, p]));

    const getOrCreateStat = (playerId: string, playerName: string, teamName: string, teamId?: string) => {
        let ps = statsMap.get(playerId);
        if (!ps) {
            ps = {
                playerId,
                playerName,
                teamName,
                teamId,
                matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
                wickets: 0, oversBowled: 0, runsConceded: 0, catches: 0,
                highestScore: 0, centuries: 0, halfCenturies: 0,
                bestBowlingWickets: 0, bestBowlingRuns: 0,
                impactScore: 0,
            };
            state.playerStats.push(ps);
            statsMap.set(playerId, ps);
        }
        return ps;
    };

    // Update batting stats
    for (const bat of matchResult.battingStats) {
        const ps = getOrCreateStat(bat.playerId, bat.playerName, bat.teamName, bat.teamId);
        ps.runs += bat.runs;
        ps.balls += bat.balls;
        ps.fours += bat.fours;
        ps.sixes += bat.sixes;

        // Update high score & milestones
        if (bat.runs > ps.highestScore) ps.highestScore = bat.runs;
        if (bat.runs >= 100) ps.centuries++;
        else if (bat.runs >= 50) ps.halfCenturies++;
    }

    // Update bowling stats
    for (const bowl of matchResult.bowlingStats) {
        const ps = getOrCreateStat(bowl.playerId, bowl.playerName, bowl.teamName, bowl.teamId);
        ps.wickets += bowl.wickets;
        ps.oversBowled += Math.floor(bowl.overs) * 6 + bowl.balls;
        ps.runsConceded += bowl.runs;

        // Update best bowling spell
        if (bowl.wickets > ps.bestBowlingWickets) {
            ps.bestBowlingWickets = bowl.wickets;
            ps.bestBowlingRuns = bowl.runs;
        } else if (bowl.wickets === ps.bestBowlingWickets && bowl.runs < ps.bestBowlingRuns) {
            // Tie-break: fewer runs
            ps.bestBowlingRuns = bowl.runs;
        } else if (ps.bestBowlingWickets === 0 && ps.bestBowlingRuns === 0) {
            // Initial assignment
            ps.bestBowlingWickets = bowl.wickets;
            ps.bestBowlingRuns = bowl.runs;
        }
    }

    // Mark matches played for all participants in the Playing XI
    const participantIds = [...matchResult.homePlayers, ...matchResult.awayPlayers];
    for (const pid of participantIds) {
        // We might not have names for players who didn't bat/bowl yet, so try to find them in the stats if they exist
        let ps = statsMap.get(pid);
        if (!ps) {
            // This case shouldn't happen often if the squads are correctly initialized, 
            // but we fallback to unknown if they are truly missing from both batting/bowling stats
            ps = getOrCreateStat(pid, 'Unknown Player', 'Unknown Team');
        }
        ps.matches++;
    }

    // Recalculate impact scores
    for (const ps of state.playerStats) {
        ps.impactScore = calculateImpact(ps);
    }

    // Update caps & MVP
    updateCaps(state);
}

export function processMatchResult(state: LeagueState, fixture: FixtureEntry, matchResult: MatchResult): void {
    if (fixture.isKnockout) {
        handlePlayoffAdvancement(state, fixture, matchResult);
    } else {
        updateStandings(state, matchResult);
    }
    updatePlayerStats(state, matchResult);

    // Advance to next match
    const nextPending = state.fixtures.findIndex(f => f.status === 'pending');
    if (nextPending === -1) {
        if (state.phase === 'league') {
            generatePlayoffFixtures(state);
            const nextMatch = state.fixtures.findIndex(f => f.status === 'pending');
            if (nextMatch !== -1) {
                state.currentMatchIndex = nextMatch;
            } else {
                state.status = 'completed';
            }
        } else {
            state.status = 'completed';
        }
    } else {
        state.currentMatchIndex = nextPending;
    }
}

// ======================================================
// Caps & MVP
// ======================================================

function calculateImpact(ps: PlayerStats): number {
    const strikeRate = ps.balls > 0 ? (ps.runs / ps.balls) * 100 : 0;
    const srModifier = strikeRate > 150 ? 1.3 : strikeRate > 130 ? 1.15 : strikeRate > 100 ? 1.0 : 0.85;
    const battingImpact = ps.runs * srModifier;

    const economy = ps.oversBowled > 0 ? (ps.runsConceded / ps.oversBowled) * 6 : 99;
    const econModifier = economy < 6 ? 1.4 : economy < 7.5 ? 1.2 : economy < 9 ? 1.0 : 0.8;
    const bowlingImpact = ps.wickets * 25 * econModifier;

    return Math.round((battingImpact + bowlingImpact) * 100) / 100;
}

function updateCaps(state: LeagueState): void {
    // Orange Cap: most runs
    const topRunScorer = [...state.playerStats].sort((a, b) => b.runs - a.runs)[0];
    if (topRunScorer && topRunScorer.runs > 0) {
        state.orangeCap = {
            playerId: topRunScorer.playerId,
            playerName: topRunScorer.playerName,
            teamName: topRunScorer.teamName,
            runs: topRunScorer.runs,
        };
    }

    // Purple Cap: most wickets
    const topWicketTaker = [...state.playerStats].sort((a, b) => {
        if (b.wickets !== a.wickets) return b.wickets - a.wickets;
        // Tiebreak: better economy
        const ecoA = a.oversBowled > 0 ? (a.runsConceded / a.oversBowled) * 6 : 99;
        const ecoB = b.oversBowled > 0 ? (b.runsConceded / b.oversBowled) * 6 : 99;
        return ecoA - ecoB;
    })[0];
    if (topWicketTaker && topWicketTaker.wickets > 0) {
        state.purpleCap = {
            playerId: topWicketTaker.playerId,
            playerName: topWicketTaker.playerName,
            teamName: topWicketTaker.teamName,
            wickets: topWicketTaker.wickets,
        };
    }

    // MVP: highest impact
    const topMvp = [...state.playerStats].sort((a, b) => b.impactScore - a.impactScore)[0];
    if (topMvp && topMvp.impactScore > 0) {
        state.mvp = {
            playerId: topMvp.playerId,
            playerName: topMvp.playerName,
            teamName: topMvp.teamName,
            impactScore: topMvp.impactScore,
        };
    }
}

// ======================================================
// Squad Validation
// ======================================================

export interface SquadValidationResult {
    valid: boolean;
    errors: { teamName: string; message: string }[];
}

export function validateSquads(teams: LeagueTeam[]): SquadValidationResult {
    const errors: { teamName: string; message: string }[] = [];

    for (const team of teams) {
        if (team.squad.length > 25) {
            errors.push({ teamName: team.teamName, message: `Squad exceeds 25 players (${team.squad.length})` });
        }

        const overseas = team.squad.filter(s => s.player.nationality === 'Overseas').length;
        if (overseas > 8) {
            errors.push({ teamName: team.teamName, message: `Too many overseas players (${overseas}/8 max)` });
        }

        const indian = team.squad.filter(s => s.player.nationality === 'Indian').length;
        if (indian < 7) {
            errors.push({ teamName: team.teamName, message: `Not enough Indian players (${indian}/7 min)` });
        }
    }

    return { valid: errors.length === 0, errors };
}

// ======================================================
// Persistence (Redis)
// ======================================================

export async function saveLeagueState(state: LeagueState): Promise<void> {
    await redis.set(`league:${state.roomCode}`, JSON.stringify(state), 'EX', 86400 * 7);
}

export async function getLeagueState(roomCode: string): Promise<LeagueState | null> {
    const raw = await redis.get(`league:${roomCode}`);
    if (!raw) return null;
    return JSON.parse(raw);
}

// ======================================================
// Match Result Sync
// ======================================================

export async function syncMatchToLeague(roomCode: string, fixtureId: string, matchState: MatchState) {
    const state = await getLeagueState(roomCode);
    if (!state) return null;

    const fixture = state.fixtures.find(f => f.id === fixtureId);
    if (!fixture || fixture.status === 'completed') return state;

    const batting2nd = matchState.currentBatting;
    const batting1st = batting2nd === 'home' ? 'away' : 'home';

    const matchResult: MatchResult = {
        homeUserId: matchState.homeTeam.userId,
        awayUserId: matchState.awayTeam.userId,
        homeScore: matchState.homeTeam.score,
        homeWickets: matchState.homeTeam.wickets,
        homeOvers: matchState.homeTeam.overs,
        homeBalls: matchState.homeTeam.balls,
        awayScore: matchState.awayTeam.score,
        awayWickets: matchState.awayTeam.wickets,
        awayOvers: matchState.awayTeam.overs,
        awayBalls: matchState.awayTeam.balls,
        result: matchState.result || 'Match Completed',
        winnerUserId: matchState.result?.includes(matchState.homeTeam.name) 
            ? matchState.homeTeam.userId 
            : matchState.result?.includes(matchState.awayTeam.name)
                ? matchState.awayTeam.userId
                : null,
        battingStats: [
            ...(matchState.firstInningsBattingOrder || []).map((b: { player: { id: string, name: string, teamName?: string }, runs: number, balls: number, fours: number, sixes: number, isOut: boolean }) => ({
                playerId: b.player.id,
                playerName: b.player.name,
                teamName: b.player.teamName || (batting1st === 'home' ? matchState.homeTeam.name : matchState.awayTeam.name),
                runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, isOut: b.isOut
            })),
            ...(matchState.battingOrder || []).map((b: { player: { id: string, name: string, teamName?: string }, runs: number, balls: number, fours: number, sixes: number, isOut: boolean }) => ({
                playerId: b.player.id,
                playerName: b.player.name,
                teamName: b.player.teamName || (batting2nd === 'home' ? matchState.homeTeam.name : matchState.awayTeam.name),
                runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, isOut: b.isOut
            }))
        ],
        bowlingStats: [
            ...(matchState.firstInningsBowlingOrder || []).map((b: { player: { id: string, name: string, teamName?: string }, overs: number, overBalls: number, runs: number, wickets: number }) => ({
                playerId: b.player.id,
                playerName: b.player.name,
                teamName: b.player.teamName || (batting2nd === 'home' ? matchState.homeTeam.name : matchState.awayTeam.name), // bowl 1st = team 2
                overs: b.overs, balls: b.overBalls, runs: b.runs, wickets: b.wickets
            })),
            ...(matchState.bowlingOrder || []).map((b: { player: { id: string, name: string, teamName?: string }, overs: number, overBalls: number, runs: number, wickets: number }) => ({
                playerId: b.player.id,
                playerName: b.player.name,
                teamName: b.player.teamName || (batting1st === 'home' ? matchState.homeTeam.name : matchState.awayTeam.name), // bowl 2nd = team 1
                overs: b.overs, balls: b.overBalls, runs: b.runs, wickets: b.wickets
            }))
        ],
        homePlayers: matchState.homeTeam.players.map((p: { id: string }) => p.id),
        awayPlayers: matchState.awayTeam.players.map((p: { id: string }) => p.id)
    };

    fixture.status = 'completed';
    fixture.matchId = matchState.matchId;
    fixture.homeScore = matchState.homeTeam.score;
    fixture.homeWickets = matchState.homeTeam.wickets;
    fixture.homeOvers = matchState.homeTeam.overs;
    fixture.awayScore = matchState.awayTeam.score;
    fixture.awayWickets = matchState.awayTeam.wickets;
    fixture.awayOvers = matchState.awayTeam.overs;
    fixture.result = matchState.result || undefined;

    processMatchResult(state, fixture, matchResult);

    await saveLeagueState(state);
    return state;
}
