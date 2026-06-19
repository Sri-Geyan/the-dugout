import { AuctionState, AuctionTeam, placeBid, getAuctionState, sellCurrentPlayer, BID_INCREMENT, handleRtm, handleBargain, handleFinalMatch } from './auctionEngine';
import { CricketPlayer } from '@/lib/playersDb';
import { getRoomState } from './roomManager';
import { emitToRoom } from './socket-server';
import type { MatchState, BatterState, BowlerState, MatchPlayer } from './matchEngine';
import { getRetentionState, retainPlayer, confirmRetentions, getRetentionEligiblePool } from './retentionEngine';
import { canAddOverseas, playerFillScore, getSquadComposition, IPL_MAX_SQUAD, IPL_MIN_SQUAD } from './squadUtils';

// ======================================================
// Bot Detection
// ======================================================

const BOT_USERNAMES = [
    'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru', 'Kolkata Knight Riders',
    'Delhi Capitals', 'Sunrisers Hyderabad', 'Punjab Kings', 'Rajasthan Royals',
    'Lucknow Super Giants', 'Gujarat Titans',
];

export const FRANCHISE_ICONS: Record<string, string[]> = {
    'Chennai Super Kings': ['Ruturaj Gaikwad', 'MS Dhoni', 'Sanju Samson'],
    'Gujarat Titans': ['Shubman Gill', 'Rashid Khan'],
    'Mumbai Indians': ['Jasprit Bumrah', 'Suryakumar Yadav', 'Rohit Sharma', 'Hardik Pandya'],
    'Kolkata Knight Riders': ['Rinku Singh', 'Sunil Narine'],
    'Royal Challengers Bengaluru': ['Virat Kohli'],
    'Delhi Capitals': ['KL Rahul', 'Axar Patel'],
    'Sunrisers Hyderabad': ['Heinrich Klaasen', 'Pat Cummins'],
    'Punjab Kings': ['Shreyas Iyer', 'Arshdeep Singh'],
    'Rajasthan Royals': ['Yashasvi Jaiswal', 'Ravindra Jadeja'],
    'Lucknow Super Giants': ['Rishabh Pant', 'Nicholas Pooran'],
};

export function isBotUser(username: string): boolean {
    return BOT_USERNAMES.includes(username);
}

export function isBotUserId(userId: string, teams: AuctionTeam[]): boolean {
    const team = teams.find(t => t.userId === userId);
    return team ? isBotUser(team.username) : false;
}

// Map Team Name to Home Stadium ID
export function getTeamHomeStadiumId(teamName: string): string | undefined {
    const mapping: Record<string, string> = {
        'Chennai Super Kings': 'chepauk',
        'Mumbai Indians': 'wankhede',
        'Royal Challengers Bengaluru': 'chinnaswamy',
        'Kolkata Knight Riders': 'eden_gardens',
        'Delhi Capitals': 'arun_jaitley',
        'Sunrisers Hyderabad': 'rajiv_gandhi',
        'Punjab Kings': 'pca_is_bindra',
        'Rajasthan Royals': 'hpca', // Dharamsala is RR's second home, using it for unique pitch dynamics
        'Lucknow Super Giants': 'ekana',
        'Gujarat Titans': 'narendra_modi',
    };
    return mapping[teamName];
}

// ======================================================
// Bot Bidding Strategy — ML-Driven
// ======================================================

/**
 * Fetches the ML-predicted market valuation for a single player+team pair.
 * Calls /api/auction/valuations with a single team and returns the value in Crores.
 * Falls back to basePrice * 2 if the ML engine is unreachable.
 */
/**
 * Computes a robust skill-based heuristic valuation for a player.
 * Integrates team need and team-specific variance to avoid identical bidding.
 */
export function getHeuristicBotMaxBid(
    player: CricketPlayer,
    team: AuctionTeam,
    availablePurse: number
): number {
    const skill = Math.max(player.battingSkill || 0, player.bowlingSkill || 0);
    let fallback = 0;
    if (skill >= 90) {
        fallback = 14 + (skill - 90) * 0.8; // 14-22 Cr
    } else if (skill >= 80) {
        fallback = 8 + (skill - 80) * 0.6; // 8-14 Cr
    } else if (skill >= 70) {
        fallback = 4 + (skill - 70) * 0.4; // 4-8 Cr
    } else {
        fallback = Math.max(player.basePrice, 1 + skill * 0.04); // 1-3.8 Cr
    }

    // Apply team need multiplier
    const stadiumId = getTeamHomeStadiumId(team.teamName);
    const fillScore = playerFillScore(player, team.squad, stadiumId);
    
    // Scale valuation based on fill score (need).
    const needMult = 0.7 + Math.min(1.3, fillScore) * 0.5; // ranges roughly from 0.7 to 1.35
    fallback *= needMult;

    // Apply team-specific stable variance
    const teamSeed = team.teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const playerSeed = player.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hash = (teamSeed + playerSeed) % 100; // 0 to 99
    const varianceFactor = 0.85 + (hash / 99) * 0.3; // 0.85 to 1.15

    fallback *= varianceFactor;

    // Ensure it's at least the base price
    fallback = Math.max(player.basePrice, fallback);

    // Cap at available purse
    fallback = Math.min(fallback, availablePurse);

    // Round to BID_INCREMENT
    return Math.floor(fallback / BID_INCREMENT) * BID_INCREMENT;
}

/**
 * Fetches the ML-predicted market valuation for a single player+team pair.
 * Calls /api/auction/valuations with a single team and returns the value in Crores.
 * Falls back to getHeuristicBotMaxBid if the ML engine is unreachable.
 */
export async function getMlBotMaxBid(
    player: CricketPlayer,
    team: AuctionTeam
): Promise<number> {
    const comp = getSquadComposition(team.squad);

    // Hard blocks — no ML needed
    if (comp.total >= IPL_MAX_SQUAD) return 0;
    if (player.nationality !== 'Indian' && !canAddOverseas(team.squad)) return 0;

    // Keep enough purse for filling remaining mandatory slots
    const slotsNeeded = Math.max(0, IPL_MIN_SQUAD - comp.total);
    const minReserve = Math.max(0, (slotsNeeded - 1) * 0.5);
    const availablePurse = team.purse - minReserve;
    if (availablePurse <= player.basePrice) return 0;

    const stadiumId = getTeamHomeStadiumId(team.teamName);
    const fillScore = playerFillScore(player, team.squad, stadiumId);
    if (fillScore === 0) return 0;

    // Fetch ML valuation for this single team
    const valuations = await getMlBotValuations(player, [team]);
    let mlVal = valuations[team.userId];

    if (mlVal && mlVal > 0) {
        // Cap at available purse
        mlVal = Math.min(mlVal, availablePurse);
        return Math.floor(mlVal / BID_INCREMENT) * BID_INCREMENT;
    }

    // Fallback: proper skill-based heuristic if ML engine is unreachable
    return getHeuristicBotMaxBid(player, team, availablePurse);
}

export async function getMlBotValuations(player: CricketPlayer, teams: AuctionTeam[]): Promise<Record<string, number>> {
    const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
    const fallbackValuations: Record<string, number> = {};
    
    for (const team of teams) {
        const comp = getSquadComposition(team.squad);
        const slotsNeeded = Math.max(0, IPL_MIN_SQUAD - comp.total);
        const minReserve = Math.max(0, (slotsNeeded - 1) * 0.5);
        const availablePurse = team.purse - minReserve;
        fallbackValuations[team.userId] = getHeuristicBotMaxBid(player, team, availablePurse);
    }

    try {
        const playerFeatures = {
            overall_rating: Math.max(player.battingSkill || 0, player.bowlingSkill || 0),
            age: player.age || 25,
            scarcity: 50,
            form: 0,
            base_price: player.basePrice * 100 // Convert Cr to Lakhs
        };
        const teamPayload = teams.map(t => ({ team_id: t.userId, purse_remaining: t.purse * 100 })); // Convert Cr to Lakhs
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`${mlEngineUrl}/api/auction/valuations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_features: playerFeatures, teams: teamPayload }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const data = await res.json();
            const valuationsInCr: Record<string, number> = {};
            if (data.team_valuations) {
                for (const [key, val] of Object.entries(data.team_valuations)) {
                    valuationsInCr[key] = (val as number) / 100; // Convert Lakhs back to Cr
                }
            }
            // Fill missing or zero values with fallback
            for (const team of teams) {
                if (valuationsInCr[team.userId] === undefined || valuationsInCr[team.userId] <= 0) {
                    valuationsInCr[team.userId] = fallbackValuations[team.userId];
                }
            }
            return valuationsInCr;
        }
    } catch (e) {
        console.error('Failed to fetch ML bot valuations, using fallbacks', e);
    }
    return fallbackValuations;
}

// Removed shouldBotBid heuristic in favor of direct ML integration

// ======================================================
// Run Bot Bidding Loop
// ======================================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runBotBidding(roomCode: string): Promise<AuctionState | null> {
    let state = await getAuctionState(roomCode);
    if (!state || state.status !== 'bidding' || !state.currentPlayer) return state;

    const room = await getRoomState(roomCode);
    if (!room) return state;

    // Identify bot teams
    const botTeams = state.teams.filter(t => isBotUser(t.username));
    if (botTeams.length === 0) return state;

    // Shuffle bot teams for fairness
    const shuffled = [...botTeams].sort(() => Math.random() - 0.5);

    // Multiple rounds of bot bidding (bots can counter-bid each other)
    let biddingActive = true;
    let rounds = 0;
    const maxRounds = 8; // Prevent infinite loops

    while (biddingActive && rounds < maxRounds) {
        biddingActive = false;
        rounds++;

        for (const botTeam of shuffled) {
            // Re-read state as it may have changed
            state = await getAuctionState(roomCode);
            if (!state || state.status !== 'bidding' || !state.currentPlayer) return state;

            // Don't bid against yourself
            if (state.currentBidder?.userId === botTeam.userId) continue;

            // Get fresh team data
            const freshTeam = state.teams.find(t => t.userId === botTeam.userId);
            if (!freshTeam) continue;

            const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
            const playerFeatures = {
                overall_rating: Math.max(state.currentPlayer.battingSkill || 0, state.currentPlayer.bowlingSkill || 0),
                age: state.currentPlayer.age || 25,
                scarcity: 50,
                form: 0,
                base_price: state.currentPlayer.basePrice * 100
            };
            const fillScore = playerFillScore(state.currentPlayer, freshTeam.squad, getTeamHomeStadiumId(freshTeam.teamName));
            
            const payload = {
                team_id: freshTeam.userId,
                player_features: playerFeatures,
                current_bid: state.currentBid * 100,
                purse_remaining: freshTeam.purse * 100,
                scarcity_score: 0.5,
                team_needs_score: fillScore / 10.0 // Normalize roughly 0-1
            };

            let shouldBid = false;
            let bidAmount = 0;
            let success = false;
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(`${mlEngineUrl}/api/auction/decide`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const data = await res.json();
                    const decision = data.decision;
                    success = true;
                    
                    if (decision !== 'PASS' && decision !== 'STOP') {
                        shouldBid = true;
                        
                        let increment = BID_INCREMENT; // 0.25 Cr
                        if (decision === 'RAISE_SMALL') increment = BID_INCREMENT * 2;
                        if (decision === 'RAISE_MEDIUM') increment = BID_INCREMENT * 4;
                        if (decision === 'RAISE_AGGRESSIVE') increment = BID_INCREMENT * 8;
                        
                        const baseAmountForBid = !state.currentBidder ? state.currentBid : state.currentBid + increment;
                        bidAmount = Math.round(baseAmountForBid * 100) / 100;
                    }
                }
            } catch (e) {
                console.error('Failed to get ML bot decision, falling back to heuristic', e);
            }

            // Fallback heuristic if ML call was unsuccessful or returned bad response
            if (!success) {
                const maxBid = await getMlBotMaxBid(state.currentPlayer, freshTeam);
                const minBidRequired = !state.currentBidder ? state.currentBid : state.currentBid + BID_INCREMENT;
                
                if (maxBid >= minBidRequired) {
                    // Decide bid with 90% probability to add natural variety
                    if (Math.random() < 0.9) {
                        shouldBid = true;
                        
                        // Decide increment based on how much headroom we have
                        const headroom = maxBid - state.currentBid;
                        let increment = BID_INCREMENT;
                        if (headroom >= 4.0 && Math.random() < 0.4) {
                            increment = BID_INCREMENT * 8; // Aggressive
                        } else if (headroom >= 2.0 && Math.random() < 0.5) {
                            increment = BID_INCREMENT * 4; // Medium
                        } else if (headroom >= 1.0 && Math.random() < 0.6) {
                            increment = BID_INCREMENT * 2; // Small
                        }
                        
                        const baseAmountForBid = !state.currentBidder ? state.currentBid : state.currentBid + increment;
                        bidAmount = Math.round(baseAmountForBid * 100) / 100;
                    }
                }
            }

            if (shouldBid) {
                if (bidAmount > freshTeam.purse) {
                    bidAmount = freshTeam.purse;
                }
                
                const minBid = !state.currentBidder ? state.currentBid : state.currentBid + BID_INCREMENT;
                if (bidAmount >= minBid) {
                    const result = await placeBid(
                        roomCode,
                        botTeam.userId,
                        botTeam.username,
                        botTeam.teamName,
                        bidAmount
                    );
                    if (result.success) {
                        biddingActive = true;
                        state = result.state;
                        
                        // Broadcast the new bid immediately for real-time interactivity
                        emitToRoom(roomCode, 'auction_update', { state });
                        
                        // Add a realistic delay between bids so humans can track the progress
                        await delay(1200);
                    }
                }
            }
        }
    }

    return state;
}

// ======================================================
// Bot Auto-Sell (when timer expires and no human action)
// ======================================================

export async function botAutoSellIfNeeded(roomCode: string): Promise<AuctionState | null> {
    const state = await getAuctionState(roomCode);
    if (!state || state.status !== 'bidding') return state;

    if (state.timerEnd && Date.now() > state.timerEnd) {
        return await sellCurrentPlayer(roomCode);
    }
    return state;
}

// ======================================================
// Bot Playing 11 Selection
// ======================================================

interface EnrichedPlayer {
    id: string;
    name: string;
    role: string;
    battingSkill: number | null;
    bowlingSkill: number | null;
    nationality?: string;
    battingRole?: string;
    bowlingRole?: string;
    primaryArchetype?: string;
    secondaryArchetype?: string;
    battingRating?: number;
    bowlingRating?: number;
    // For performance tracking
    recentRuns?: number;
    recentWickets?: number;
    recentAverage?: number; // Batting
    recentEconomy?: number; // Bowling
    recentStrikeRate?: number; // Batting SR
    recentMatches?: number;
}

// Role Predicates
const eliteFinishers = ['Nicholas Pooran', 'Heinrich Klaasen', 'Andre Russell', 'Tim David', 'Liam Livingstone', 'Tristan Stubbs'];
const namedFinishers = ['MS Dhoni', 'Ramakrishna Ghosh', ...eliteFinishers];
const finisherArchetypes = ['Finisher', 'Hard Hitter', 'Power Hitter', 'Lower Order'];

export const isOpener = (p: EnrichedPlayer) => 
    (p.battingRole?.toLowerCase().includes('opener') || p.primaryArchetype?.includes('Opener') || p.secondaryArchetype?.includes('Opener') || p.name === 'Mitch Owen') && 
    !namedFinishers.includes(p.name) && 
    p.name !== 'Rishabh Pant' &&
    p.name !== 'Ravindra Jadeja' && 
    p.name !== 'Rashid Khan' &&
    p.name !== 'Wanindu Hasaranga' &&
    p.name !== 'Rajat Patidar';

export const isExplicitFinisher = (p: EnrichedPlayer) => 
    (namedFinishers.includes(p.name) || 
    finisherArchetypes.includes(p.battingRole || '') || 
    finisherArchetypes.some((a: string) => p.primaryArchetype?.includes(a)) ||
    p.secondaryArchetype?.includes('Finisher')) && 
    p.name !== 'Shivam Dube';

export const isAnchor = (p: EnrichedPlayer) => 
    (p.primaryArchetype?.includes('Anchor') || p.primaryArchetype?.includes('Stable') || p.battingRole?.includes('Number 3') || p.name === 'Rishabh Pant' || p.name === 'Ryan Rickelton' || p.name === 'KL Rahul' || p.name === 'Shubman Gill') &&
    !isOpener(p) && p.name !== 'MS Dhoni';

export const isMiddleOrder = (p: EnrichedPlayer) => 
    p.name === 'Shivam Dube' || 
    p.name === 'Tilak Varma' ||
    p.name === 'Rahul Tripathi' ||
    p.name === 'Suryakumar Yadav' ||
    p.name === 'Nitish Rana' ||
    p.name === 'Rajat Patidar' ||
    p.battingRole?.toLowerCase().includes('middle') || 
    p.primaryArchetype?.includes('Middle') || 
    p.primaryArchetype?.includes('Spin Basher') ||
    p.name === 'Liam Livingstone' ||
    p.name === 'Ravindra Jadeja' ||
    p.name === 'Deepak Chahar' ||
    p.name === 'Wanindu Hasaranga';

export const isEliteFinisher = (p: EnrichedPlayer) => eliteFinishers.includes(p.name);

export const isPowerplayPacer = (p: EnrichedPlayer) => 
    (p.bowlingRole?.toLowerCase().includes('powerplay') || p.primaryArchetype?.includes('Powerplay') || p.primaryArchetype?.includes('New Ball')) && !isSpinner(p);

export const isDeathPacer = (p: EnrichedPlayer) => 
    (p.bowlingRole?.toLowerCase().includes('death') || p.primaryArchetype?.includes('Death Specialist')) && !isSpinner(p);

export const isPacer = (p: EnrichedPlayer) => 
    (p.role === 'BOWLER' || p.role === 'ALL_ROUNDER') && !isSpinner(p) && ((p.bowlingSkill || 0) > 40 || (p.bowlingRating || 0) > 40);

export const isSpinner = (p: EnrichedPlayer) => 
    (p.role === 'BOWLER' || p.role === 'ALL_ROUNDER') && 
    (p.bowlingRole?.toLowerCase().includes('spin') || 
     p.primaryArchetype?.includes('Spinner') || 
     p.secondaryArchetype?.includes('Spinner') ||
     p.name === 'Rashid Khan' || p.name === 'Wanindu Hasaranga' || p.name === 'Varun Chakravarthy' || p.name === 'Kuldeep Yadav' || p.name === 'Yuzvendra Chahal' || p.name === 'R. Sai Kishore' || p.name === 'Rahul Chahar');
export const isBattingAR = (p: EnrichedPlayer) => 
    p.role === 'ALL_ROUNDER' && ((p.battingSkill || 0) > (p.bowlingSkill || 0) + 10 || p.primaryArchetype?.includes('Batting All-Rounder'));

export const isBowlingAR = (p: EnrichedPlayer) => 
    p.role === 'ALL_ROUNDER' && ((p.bowlingSkill || 0) > (p.battingSkill || 0) + 10 || p.primaryArchetype?.includes('Bowling All-Rounder'));

export async function botSelectPlaying11(
    squad: EnrichedPlayer[], 
    pitchType: string = 'BALANCED', 
    tossResult?: { winnerId: string; decision: 'bat' | 'bowl' },
    teamUserId?: string
): Promise<{
    selectedIds: string[];
    battingOrder: string[];
    actualOrder: EnrichedPlayer[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
}> {
    const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
    
    let venue = 'Neutral';
    if (pitchType === 'BATTING') venue = 'Wankhede Stadium, Mumbai';
    else if (pitchType === 'BOWLING') venue = 'Eden Gardens, Kolkata';
    else if (pitchType === 'SPINNING') venue = 'MA Chidambaram Stadium, Chepauk, Chennai';

    const payload = {
        team_id: teamUserId || 'bot_team',
        venue: venue,
        players: squad.slice(0, IPL_MAX_SQUAD).map(p => ({
            player_id: p.id,
            name: p.name,
            role: p.role,
            batting_skill: p.battingSkill || 50,
            bowling_skill: p.bowlingSkill || 30,
            nationality: p.nationality || 'Indian',
            is_captain: (p as any).isCaptain ? 1 : 0,
            is_wk: (p as any).isWicketKeeper ? 1 : 0
        }))
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${mlEngineUrl}/api/select/playing11`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const selectedIds = data.selected_xi.map((x: any) => x.player_id);
            
            const selected = squad.filter(p => selectedIds.includes(p.id));
            const wkId = selected.find(p => p.role === 'WICKET_KEEPER')?.id || selectedIds[0];
            const captainId = selected.find(p => (p as any).isCaptain)?.id || selectedIds[0];
            const openingBowlerId = selected.filter(p => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER')[0]?.id || selectedIds[selectedIds.length - 1];

            return {
                selectedIds,
                battingOrder: selectedIds,
                actualOrder: selected,
                captainId,
                wkId,
                openingBowlerId
            };
        }
    } catch (error) {
        console.error('ML Selection Fetch Error:', error);
    }
    
    console.warn('Falling back to basic bot selection');
    const sorted = [...squad].sort((a, b) => Math.max(b.battingSkill || 0, b.bowlingSkill || 0) - Math.max(a.battingSkill || 0, a.bowlingSkill || 0));
    const wks = sorted.filter(p => p.role === 'WICKET_KEEPER');
    const others = sorted.filter(p => p.role !== 'WICKET_KEEPER');
    
    const selected = [];
    if (wks.length > 0) {
        selected.push(wks[0]);
    } else {
        selected.push(others[0]);
        others.shift();
    }
    
    while (selected.length < 11 && others.length > 0) {
        selected.push(others.shift()!);
    }
    
    const selectedIds = selected.map(p => p.id);
    return {
        selectedIds,
        battingOrder: selectedIds,
        actualOrder: selected,
        captainId: selectedIds[0],
        wkId: selected[0]?.id || selectedIds[0],
        openingBowlerId: selectedIds[selectedIds.length - 1]
    };
}

export function botChooseNextBatter(state: MatchState): string | null {
    const available = state.battingOrder.filter(
        (b: BatterState) => !b.isOut && b !== state.striker && b !== state.nonStriker
    );
    if (available.length === 0) return null;

    const phase = state.matchPhase;
    const battingTeamStats = state.currentBatting === 'home' ? state.homeTeam : state.awayTeam;
    const wicketsDown = battingTeamStats.wickets;
    const score = battingTeamStats.score;
    const overs = battingTeamStats.overs + (battingTeamStats.balls / 6);

    // 1. COLLAPSE RECOVERY: If 2+ wickets in last 12 balls
    const last2Fow = battingTeamStats.fow.slice(-2);
    const isCollapse = last2Fow.length >= 2 && (overs - last2Fow[0].over) <= 2.0;

    if (isCollapse) {
        // Send the best Anchor or Middle Order remaining, regardless of phase
        const stabilizer = available.filter(b => isAnchor(b.player) || isMiddleOrder(b.player))
            .sort((a, b) => (b.player.battingRating || b.player.battingSkill || 0) - (a.player.battingRating || a.player.battingSkill || 0))[0];
        if (stabilizer) return stabilizer.player.id;
    }

    // 2. TARGET PRESSURE: High RRR in 2nd Innings
    if (state.target && state.ballsRemaining && state.ballsRemaining > 0) {
        const rrr = ((state.target - battingTeamStats.score) / state.ballsRemaining) * 6;
        if (rrr > 11 && phase !== 'powerplay') {
            // Promote Elite Finisher or Hard Hitter NOW
            const dasher = available.find(b => isEliteFinisher(b.player) || isExplicitFinisher(b.player));
            if (dasher) return dasher.player.id;
        }
    }

    // 3. MOMENTUM: Strong position, attack early
    if (wicketsDown <= 2 && score >= 100 && overs >= 10 && phase !== 'death') {
        const elite = available.find(b => isEliteFinisher(b.player));
        if (elite) return elite.player.id;
    }

    // 4. CRISIS: Top order gone early in Powerplay
    if (phase === 'powerplay' && wicketsDown >= 2) {
        const solid = available.filter(b => isAnchor(b.player))
            .sort((a, b) => (b.player.battingRating || b.player.battingSkill || 0) - (a.player.battingRating || a.player.battingSkill || 0))[0];
        if (solid) return solid.player.id;
    }

    // 5. DEATH: Maximize remaining hitters
    if (phase === 'death') {
        const sorted = [...available].sort((a, b) => {
            const priority = (p: MatchPlayer) => {
                if (isEliteFinisher(p)) return 100;
                if (isExplicitFinisher(p)) return 80;
                if (isMiddleOrder(p)) return 60;
                return 40;
            };
            const pA = priority(a.player);
            const pB = priority(b.player);
            if (pA !== pB) return pB - pA;
            return (b.player.battingRating || b.player.battingSkill || 0) - (a.player.battingRating || a.player.battingSkill || 0);
        });
        return sorted[0].player.id;
    }

    // Default: Follow the pre-set batting order
    // But ensure we don't send a pure bowler if a batter is available
    const batterAvailable = available.find(b => b.player.role !== 'BOWLER' || (b.player.battingSkill || 0) > 40);
    if (batterAvailable) return batterAvailable.player.id;

    return available[0].player.id;
}

export function botChooseNextBowler(state: MatchState): string | null {
    // Basic eligibility: hasn't finished 4 overs and didn't bowl the last one
    const available = state.bowlingOrder.filter(
        (b: BowlerState) => b.overs < 4 && b.player.id !== state.lastBowlerId
    );
    
    // Fallback if everyone else is exhausted but we have someone from the last over with overs left
    const pool = available.length > 0 ? available : state.bowlingOrder.filter(b => b.overs < 4);
    if (pool.length === 0) return null;

    const phase = state.matchPhase;

    // Sorting Logic based on Professional Strategy
    const sorted = [...pool].sort((a, b) => {
        const skillA = a.player.bowlingRating || a.player.bowlingSkill || 0;
        const skillB = b.player.bowlingRating || b.player.bowlingSkill || 0;
        
        const isDeathSpecialistA = isDeathPacer(a.player);
        const isDeathSpecialistB = isDeathPacer(b.player);
        
        const isPowerplaySpecialistA = isPowerplayPacer(a.player);
        const isPowerplaySpecialistB = isPowerplayPacer(b.player);

        const spinnerA = isSpinner(a.player);
        const spinnerB = isSpinner(b.player);

        if (phase === 'powerplay') {
            if (a.player.name === 'Matheesha Pathirana') return 1;
            if (b.player.name === 'Matheesha Pathirana') return -1;

            if (isPowerplaySpecialistA && !isPowerplaySpecialistB) return -1;
            if (isPowerplaySpecialistB && !isPowerplaySpecialistA) return 1;
            if (!spinnerA && spinnerB) return -1;
            if (spinnerA && !spinnerB) return 1;
        } else if (phase === 'death') {
            if (isDeathSpecialistA && !isDeathSpecialistB) return -1;
            if (isDeathSpecialistB && !isDeathSpecialistA) return 1;
            return (skillB || 0) - (skillA || 0);
        } else if (phase === 'middle') {
            // Prefer spinners in middle overs if it's a spinning track
            const spinTrack = state.pitchType === 'SPINNING';
            if (spinTrack) {
                if (spinnerA && !spinnerB) return -1;
                if (!spinnerA && spinnerB) return 1;
            }
        }

        // Performance-based weight
        const econA = a.overs > 0 ? (a.runs / a.overs) : 7.0;
        const econB = b.overs > 0 ? (b.runs / b.overs) : 7.0;
        
        const scoreA = skillA - (econA * 2);
        const scoreB = skillB - (econB * 2);

        return scoreB - scoreA;
    });

    return sorted[0].player.id;
}

// ======================================================
// Bot Toss Decision
// ======================================================

export function botTossDecision(pitchType: string): 'bat' | 'bowl' {
    // Bowling pitches → bowl first
    // Batting pitches → bat first
    // Balanced/Spinning → random with slight bat preference
    switch (pitchType) {
        case 'BOWLING': return 'bowl';
        case 'BATTING': return 'bat';
        case 'SPINNING': return Math.random() < 0.6 ? 'bowl' : 'bat';
        default: return Math.random() < 0.55 ? 'bat' : 'bowl';
    }
}

// ======================================================
// Bot Retention Phase Logic
// ======================================================

export async function runBotRetentions(roomCode: string): Promise<void> {
    const state = await getRetentionState(roomCode);
    if (!state) return;

    for (const team of state.teams) {
        if (!isBotUser(team.username) || team.confirmed) continue;

        const pool = getRetentionEligiblePool(team.teamName);
        if (!pool) continue;

        // Sort by skill descending
        const sorted = [...pool].sort((a, b) => {
            const skillA = Math.max(a?.battingSkill || 0, a?.bowlingSkill || 0);
            const skillB = Math.max(b?.battingSkill || 0, b?.bowlingSkill || 0);
            return (skillB || 0) - (skillA || 0);
        });

        const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';

        for (const player of sorted) {
            if (!player) continue;
            const skill = Math.max(player.battingSkill || 0, player.bowlingSkill || 0);
            const isUncapped = player.capStatus === 'Uncapped';
            const isOverseas = player.nationality !== 'Indian';
            
            let shouldRetain = false;

            // --- Check Franchise Icon Status First ---
            const icons = FRANCHISE_ICONS[team.teamName];
            if (icons && icons.some(iconName => iconName.toLowerCase() === player.name.toLowerCase())) {
                shouldRetain = true;
            }

            if (!shouldRetain) {
                // --- Attempt 1: ML Engine Retention Decision ---
                try {
                    // Approximate form score using the logic from python (skill - 20)
                    const formScore = Math.max(0, Math.min(100, skill - 15)); 
                    
                    const payload = {
                        team_id: team.userId,
                        player_features: {
                            overall_rating: skill,
                            age: (player as any).age || 25,
                            is_uncapped: isUncapped ? 1 : 0,
                            is_overseas: isOverseas ? 1 : 0,
                            form_score: formScore,
                            current_retained_count: team.retained.length,
                            current_overseas_retained_count: team.retained.filter(r => r.nationality !== 'Indian').length
                        }
                    };

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    
                    const response = await fetch(`${mlEngineUrl}/api/retention/decide`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        shouldRetain = !!data.retain;
                    } else {
                        throw new Error('ML endpoint returned non-ok status');
                    }
                } catch (error) {
                    // --- Attempt 2: Fallback to Heuristics ---
                    console.warn(`Falling back to heuristic retention for ${player.name}`);
                    if (skill >= 85) shouldRetain = true;
                    else if (skill >= 78 && team.retained.length < 4) shouldRetain = true;
                    else if (isUncapped && skill >= 70 && team.retained.length < 5) shouldRetain = true;
                }
            }

            // Enforce overseas retention limit (max 2)
            if (shouldRetain && isOverseas) {
                const overseasCount = team.retained.filter(r => r.nationality !== 'Indian').length;
                if (overseasCount >= 2) shouldRetain = false;
            }

            if (shouldRetain) {
                await retainPlayer(roomCode, team.userId, player.name);
                const updatedState = await getRetentionState(roomCode);
                const updatedTeam = updatedState?.teams.find(t => t.userId === team.userId);
                if (updatedTeam) {
                    team.purse = updatedTeam.purse;
                    team.retained = updatedTeam.retained;
                }
            }
        }

        // Always confirm
        await confirmRetentions(roomCode, team.userId);
    }
}


// ======================================================
// Bot RTM Decision Logic
// ======================================================

export async function runBotRtmDecisions(roomCode: string): Promise<AuctionState | null> {
    const state = await getAuctionState(roomCode);
    if (!state || !state.rtmPending || !state.rtmOriginalTeamId || !state.currentPlayer) return state;

    const botTeam = state.teams.find(t => t.userId === state.rtmOriginalTeamId);
    if (!botTeam || !isBotUser(botTeam.username)) return state;

    // Small delay for realism and visibility
    await new Promise(r => setTimeout(r, 2000));

    // Evaluate if bot should use RTM via ML valuation
    const mlMax = await getMlBotMaxBid(state.currentPlayer, botTeam);
    
    // RTM is "guaranteed" purchase — ML valuation is the cap
    const maxRtmPrice = Math.min(mlMax, botTeam.purse); 

    const shouldRtm = state.currentBid <= maxRtmPrice && botTeam.purse >= state.currentBid;

    console.log(`[Bot RTM] ${botTeam.teamName} deciding on ${state.currentPlayer.name}. Bid: ${state.currentBid}, ML Max: ${maxRtmPrice.toFixed(2)}. Decision: ${shouldRtm}`);

    const updatedState = await handleRtm(roomCode, shouldRtm);
    if (updatedState) {
        emitToRoom(roomCode, 'auction_update', { state: updatedState });
        
        // If decision leads to bargain phase, and highest bidder is a bot, trigger it
        if (updatedState.rtmState === 'bargain') {
            await delay(1500);
            return await runBotBargainDecisions(roomCode);
        }
    }
    return updatedState;
}

export async function runBotBargainDecisions(roomCode: string): Promise<AuctionState | null> {
    const state = await getAuctionState(roomCode);
    if (!state || state.rtmState !== 'bargain' || !state.currentBidder || !state.currentPlayer) return state;

    const botTeam = state.teams.find(t => t.userId === state.currentBidder!.userId);
    if (!botTeam || !isBotUser(botTeam.username)) return state;

    // Delay for human highest bidder to see the bargain UI
    await new Promise(r => setTimeout(r, 2000));

    // Get ML valuation as the cap for bargaining
    const mlMax = await getMlBotMaxBid(state.currentPlayer, botTeam);
    const maxBargainPrice = Math.min(mlMax, botTeam.purse);

    // Use the RL agent to decide the raise action
    let bargainAmount = state.currentBid;
    if (maxBargainPrice > state.currentBid) {
        const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
        const fillScore = playerFillScore(state.currentPlayer, botTeam.squad, getTeamHomeStadiumId(botTeam.teamName));
        const payload = {
            team_id: botTeam.userId,
            player_features: {
                overall_rating: Math.max(state.currentPlayer.battingSkill || 0, state.currentPlayer.bowlingSkill || 0),
                age: state.currentPlayer.age || 25,
                scarcity: 50,
                form: 0,
                base_price: state.currentPlayer.basePrice * 100
            },
            current_bid: state.currentBid * 100,
            purse_remaining: botTeam.purse * 100,
            scarcity_score: 0.5,
            team_needs_score: fillScore / 10.0
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${mlEngineUrl}/api/auction/decide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const decision = data.decision;
                let increment = BID_INCREMENT;
                if (decision === 'RAISE_SMALL') increment = BID_INCREMENT * 2;
                if (decision === 'RAISE_MEDIUM') increment = BID_INCREMENT * 4;
                if (decision === 'RAISE_AGGRESSIVE') increment = BID_INCREMENT * 8;

                bargainAmount = Math.min(state.currentBid + increment, maxBargainPrice, botTeam.purse);
                bargainAmount = Math.round(bargainAmount / 0.25) * 0.25;
            }
        } catch (e) {
            // Fallback: small raise
            bargainAmount = Math.min(state.currentBid + BID_INCREMENT, maxBargainPrice, botTeam.purse);
            bargainAmount = Math.round(bargainAmount / 0.25) * 0.25;
        }
    }

    console.log(`[Bot Bargain] ${botTeam.teamName} deciding on ${state.currentPlayer.name}. Bid: ${state.currentBid}, Bargain: ${bargainAmount}, ML Max: ${maxBargainPrice.toFixed(2)}`);

    const updatedState = await handleBargain(roomCode, bargainAmount);
    if (updatedState) {
        emitToRoom(roomCode, 'auction_update', { state: updatedState });

        // If decision leads to final match phase, and original team is a bot, trigger it
        if (updatedState.rtmState === 'final_match') {
            await delay(1500);
            return await runBotFinalMatchDecisions(roomCode);
        }
    }
    return updatedState;
}

export async function runBotFinalMatchDecisions(roomCode: string): Promise<AuctionState | null> {
    const state = await getAuctionState(roomCode);
    if (!state || state.rtmState !== 'final_match' || !state.rtmOriginalTeamId || !state.currentPlayer || !state.rtmBargainBid) return state;

    const botTeam = state.teams.find(t => t.userId === state.rtmOriginalTeamId);
    if (!botTeam || !isBotUser(botTeam.username)) return state;

    // Evaluate if bot should match final bargain price via ML valuation
    const mlMax = await getMlBotMaxBid(state.currentPlayer, botTeam);

    const maxFinalPrice = Math.min(mlMax, botTeam.purse);

    const shouldMatch = state.rtmBargainBid <= maxFinalPrice && botTeam.purse >= state.rtmBargainBid;

    console.log(`[Bot Final Match] ${botTeam.teamName} deciding on ${state.currentPlayer.name}. Bargain Price: ${state.rtmBargainBid}, ML Max: ${maxFinalPrice.toFixed(2)}. Decision: ${shouldMatch}`);

    const updatedState = await handleFinalMatch(roomCode, shouldMatch);
    if (updatedState) {
        emitToRoom(roomCode, 'auction_update', { state: updatedState });
    }
    return updatedState;
}

interface Playing11Selection {
    selectedIds: string[];
    battingOrder: string[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
}

export async function ensureBotSelections(roomCode: string, fixtureId: string, teamUserId: string, tossResult?: { winnerId: string; decision: 'bat' | 'bowl' }): Promise<Playing11Selection | null> {
    const { getAuctionState } = await import('./auctionEngine');
    const { getRoomState } = await import('./roomManager');
    const redisObj = (await import('./redis')).default;

    const key = "selection:" + roomCode + ":" + fixtureId + ":" + teamUserId;
    const existing = await redisObj.get(key);
    if (existing) return JSON.parse(existing);

    const room = await getRoomState(roomCode);
    const roomPlayer = room?.players.find(p => p.userId === teamUserId);
    if (!roomPlayer || !isBotUser(roomPlayer.username)) return null;

    const auction = await getAuctionState(roomCode);
    const leagueState = await (await import('./leagueEngine')).getLeagueState(roomCode);
    
    const teamData = auction?.teams.find(t => t.userId === teamUserId);
    if (!teamData) return null;

    const squad: EnrichedPlayer[] = teamData.squad.map(s => {
        const stats = leagueState?.playerStats.find(ps => ps.playerId === s.player.id);
        let recentAverage = 0;
        let recentWickets = 0;
        let recentEconomy = 0;
        let recentMatches = 0;

        if (stats && stats.matches > 0) {
            recentAverage = stats.runs / stats.matches;
            recentWickets = stats.wickets; 
            recentMatches = stats.matches;
            if (stats.oversBowled > 0) {
                recentEconomy = (stats.runsConceded / stats.oversBowled) * 6;
            }
        }

        return {
            id: s.player.id,
            name: s.player.name,
            role: s.player.role,
            battingSkill: s.player.battingSkill,
            bowlingSkill: s.player.bowlingSkill,
            nationality: s.player.nationality,
            battingRole: s.player.battingRole,
            bowlingRole: s.player.bowlingRole,
            primaryArchetype: s.player.primaryArchetype,
            secondaryArchetype: s.player.secondaryArchetype,
            battingRating: s.player.battingRating,
            bowlingRating: s.player.bowlingRating,
            recentAverage,
            recentWickets,
            recentMatches,
            recentEconomy,
        };
    });

    // Pitch type could be fetched from league fixture if available, otherwise BALANCED
    // Find pitch type from fixture if possible
    const pitchType = 'BALANCED';
    leagueState?.fixtures.find(f => f.id === fixtureId);
    // In a real app we might store pitch in fixture, but for now default or use room settings
    
    const selection = await botSelectPlaying11(squad, pitchType, tossResult, teamUserId);
    await redisObj.set(key, JSON.stringify(selection), 'EX', 86400);
    return selection;
}
