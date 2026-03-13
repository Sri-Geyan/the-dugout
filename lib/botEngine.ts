import { AuctionState, AuctionTeam, placeBid, getAuctionState, sellCurrentPlayer, BID_INCREMENT, handleRtm, handleBargain, handleFinalMatch } from './auctionEngine';
import { CricketPlayer } from '@/data/players';
import { getRoomState } from './roomManager';
import { emitToRoom } from './socket-server';
import type { MatchState, BatterState, BowlerState } from './matchEngine';
import { getRetentionState, retainPlayer, confirmRetentions, getRetentionEligiblePool } from './retentionEngine';
import { analyzeSquadNeeds, canAddOverseas, playerFillScore, getSquadComposition, IPL_MAX_SQUAD, IPL_MIN_SQUAD } from './squadUtils';

// ======================================================
// Bot Detection
// ======================================================

const BOT_USERNAMES = [
    'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru', 'Kolkata Knight Riders',
    'Delhi Capitals', 'Sunrisers Hyderabad', 'Punjab Kings', 'Rajasthan Royals',
    'Lucknow Super Giants', 'Gujarat Titans',
];

export function isBotUser(username: string): boolean {
    return BOT_USERNAMES.includes(username);
}

export function isBotUserId(userId: string, teams: AuctionTeam[]): boolean {
    const team = teams.find(t => t.userId === userId);
    return team ? isBotUser(team.username) : false;
}

// ======================================================
// Bot Bidding Strategy
// ======================================================

interface BotPersonality {
    aggression: number;      // 0.4–1.3: affects bid probability
    maxOverpay: number;      // how much over base price they'll go (multiplier)
    rolePreferences: Record<string, number>; // multiplier for role desire
}

function generatePersonality(teamName: string): BotPersonality {
    // Seed based on team name for consistency
    const hash = teamName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const aggression = 0.5 + (hash % 80) / 100; // 0.5 to 1.3

    return {
        aggression,
        maxOverpay: 1.5 + aggression * 1.5, // 2.25x to 3.45x base price
        rolePreferences: {
            BATSMAN: 1.0,
            BOWLER: 1.0,
            ALL_ROUNDER: 1.2,
            WICKET_KEEPER: 0.9,
        },
    };
}


function evaluatePlayerValue(player: CricketPlayer, team: AuctionTeam, personality: BotPersonality): number {
    const needs = analyzeSquadNeeds(team.squad);
    const roleNeed = needs[player.role] || 1.0;
    const rolePreference = personality.rolePreferences[player.role] || 1.0;
    const skill = Math.max(player.battingSkill, player.bowlingSkill);

    // Value = skill-based multiplier * need * preference * aggression
    const skillFactor = skill / 70; // normalize around 70
    return skillFactor * roleNeed * rolePreference * personality.aggression;
}

export function getBotMaxHighBid(
    player: CricketPlayer,
    team: AuctionTeam
): number {
    const personality = generatePersonality(team.teamName);
    const comp = getSquadComposition(team.squad);

    // Hard blocks
    if (comp.total >= IPL_MAX_SQUAD) return 0;
    if (player.nationality === 'Overseas' && !canAddOverseas(team.squad)) return 0;

    // Keep enough purse for filling remaining mandatory slots
    const slotsNeeded = Math.max(0, IPL_MIN_SQUAD - comp.total);
    const avgSlotCost = 0.5;
    const minReserve = Math.max(0, (slotsNeeded - 1) * avgSlotCost);
    const availablePurse = team.purse - minReserve;

    if (availablePurse <= player.basePrice) return 0;

    // Calculate fill score — 0 means squad is full or no need
    const fillScore = playerFillScore(player, team.squad);
    if (fillScore === 0) return 0;

    const skill = Math.max(player.battingSkill, player.bowlingSkill);
    const maxBidRaw = Math.min(
        player.basePrice * personality.maxOverpay * fillScore,
        availablePurse * 0.35 // Reduced from 0.75: cap single-player spend to 35% of purse
    );

    // Smoother skill-based capping
    // Above 90: full potential
    // 85-90: slight cap
    // 75-85: heavy cap
    // Below 75: strict base-price based cap
    let skillCap = maxBidRaw;
    if (skill < 75) skillCap = Math.min(maxBidRaw, player.basePrice * 2.5);
    else if (skill < 85) skillCap = Math.min(maxBidRaw, player.basePrice * 5);
    else if (skill < 90) skillCap = Math.min(maxBidRaw, player.basePrice * 10);
    
    // Add a bit of randomness to max bid so bots don't always bid the exact same amount
    const jitter = 0.95 + Math.random() * 0.1; // +/- 5% (tighter jitter)
    const finalMax = Math.max(player.basePrice, skillCap * jitter);

    return Math.floor(finalMax / BID_INCREMENT) * BID_INCREMENT;
}

function shouldBotBid(
    player: CricketPlayer,
    currentBid: number,
    team: AuctionTeam,
    personality: BotPersonality
): { shouldBid: boolean; bidAmount: number } {
    const skillCap = getBotMaxHighBid(player, team);

    const bidAmount = Math.round((currentBid + BID_INCREMENT) * 100) / 100;
    if (bidAmount > skillCap) return { shouldBid: false, bidAmount: 0 };

    // Probability of bidding decreases as bid ratio to max climbs
    const bidRatio = bidAmount / Math.max(skillCap, bidAmount);
    const comp = getSquadComposition(team.squad);
    const squadsNeedFactor = comp.total < IPL_MIN_SQUAD ? 1.3 : 1.0;
    const bidProbability = Math.max(0, (1 - bidRatio) * personality.aggression * squadsNeedFactor);

    return { shouldBid: Math.random() < bidProbability, bidAmount };
}

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

            const personality = generatePersonality(freshTeam.teamName);
            const { shouldBid, bidAmount } = shouldBotBid(
                state.currentPlayer,
                state.currentBid,
                freshTeam,
                personality
            );

            if (shouldBid) {
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
    battingSkill: number;
    bowlingSkill: number;
    nationality?: string;
}

export function botSelectPlaying11(squad: EnrichedPlayer[], pitchType: string = 'BALANCED'): {
    selectedIds: string[];
    battingOrder: string[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
} {
    const eligible = squad.slice(0, IPL_MAX_SQUAD);

    // Initial pool separation
    const indian = eligible.filter(p => p.nationality === 'Indian');
    const overseas = eligible.filter(p => p.nationality === 'Overseas');

    const selected: EnrichedPlayer[] = [];
    const pool = [...eligible];

    // 1. Mandatory Wicket Keeper (Must pick 1)
    const wks = pool.filter(p => p.role === 'WICKET_KEEPER').sort((a, b) => b.battingSkill - a.battingSkill);
    const primaryWK = wks[0];
    if (primaryWK) {
        selected.push(primaryWK);
        const idx = pool.findIndex(p => p.id === primaryWK.id);
        if (idx > -1) pool.splice(idx, 1);
    }

    // 2. Pitch-based Role Targets
    let targetBatters = 4;
    let targetBowlers = 4;
    
    if (pitchType === 'BATTING') {
        targetBatters = 5;
        targetBowlers = 3;
    } else if (pitchType === 'BOWLING' || pitchType === 'PACE' || pitchType === 'SPINNING') {
        targetBatters = 3;
        targetBowlers = 5;
    }

    // Sort remaining pool by primary skill
    const getBestAvailableByRole = (role: string, max: number) => {
        const matching = pool
            .filter(p => p.role === role)
            .sort((a, b) => Math.max(b.battingSkill, b.bowlingSkill) - Math.max(a.battingSkill, a.bowlingSkill));
        
        const picks: EnrichedPlayer[] = [];
        for (const p of matching) {
            if (picks.length >= max) break;
            
            // Check overseas limit (strictly 4)
            const currentOverseas = selected.filter(s => s.nationality === 'Overseas').length + picks.filter(s => s.nationality === 'Overseas').length;
            if (p.nationality === 'Overseas' && currentOverseas >= 4) continue;

            picks.push(p);
        }
        return picks;
    };

    // Pick specialized roles first
    const topBatters = getBestAvailableByRole('BATSMAN', targetBatters);
    selected.push(...topBatters);
    topBatters.forEach(p => {
        const idx = pool.findIndex(x => x.id === p.id);
        if (idx > -1) pool.splice(idx, 1);
    });

    const topBowlers = getBestAvailableByRole('BOWLER', targetBowlers);
    selected.push(...topBowlers);
    topBowlers.forEach(p => {
        const idx = pool.findIndex(x => x.id === p.id);
        if (idx > -1) pool.splice(idx, 1);
    });

    // Fill remaining slots (usually All-rounders or best remaining)
    // Sort pool by combined impact
    pool.sort((a, b) => (b.battingSkill + b.bowlingSkill) - (a.battingSkill + a.bowlingSkill));

    for (const p of pool) {
        if (selected.length >= 11) break;

        const currentOverseas = selected.filter(s => s.nationality === 'Overseas').length;
        if (p.nationality === 'Overseas' && currentOverseas >= 4) continue;

        selected.push(p);
    }

    // Fallback: If we still don't have 11 (due to overseas logic filtering too much), just fill from Indians
    if (selected.length < 11) {
        const remainingIndians = eligible.filter(p => !selected.find(s => s.id === p.id) && p.nationality === 'Indian');
        selected.push(...remainingIndians.slice(0, 11 - selected.length));
    }

    // Batting Order Logic
    const openers = selected.filter(p => p.role === 'BATSMAN' || p.role === 'WICKET_KEEPER').sort((a, b) => b.battingSkill - a.battingSkill);
    const middleOrder = selected.filter(p => p.role === 'ALL_ROUNDER').sort((a, b) => b.battingSkill - a.battingSkill);
    const tail = selected.filter(p => p.role === 'BOWLER').sort((a, b) => b.battingSkill - a.battingSkill);

    const battingOrder = [...openers, ...middleOrder, ...tail].map(p => p.id);

    // Captain = Highest batting or bowling skill
    const captain = [...selected].sort((a, b) => Math.max(b.battingSkill, b.bowlingSkill) - Math.max(a.battingSkill, a.bowlingSkill))[0];

    // WK = best WICKET_KEEPER role, or best batter
    const wk = selected.find(p => p.role === 'WICKET_KEEPER') || selected.sort((a, b) => b.battingSkill - a.battingSkill)[0];

    // Opening Bowler = Best bowler by bowling skill
    const openingBowler = selected.filter(p => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER').sort((a, b) => b.bowlingSkill - a.bowlingSkill)[0];

    return {
        selectedIds: selected.map(p => p.id),
        battingOrder,
        captainId: captain?.id || '',
        wkId: wk?.id || '',
        openingBowlerId: openingBowler?.id || '',
    };
}

// ======================================================
// Bot Match Decisions
// ======================================================

export function botChooseNextBatter(state: MatchState): string | null {
    const available = state.battingOrder.filter(
        (b: BatterState) => !b.isOut && b !== state.striker && b !== state.nonStriker
    );
    if (available.length === 0) return null;

    const phase = state.matchPhase;
    const rrr = state.requiredRunRate || 0;
    const wicketsDown = (state.currentBatting === 'home' ? state.homeTeam.wickets : state.awayTeam.wickets);

    // Pick strategy based on state
    const sorted = [...available].sort((a, b) => {
        const skillA = a.player.battingSkill;
        const skillB = b.player.battingSkill;

        // Death Overs + High RRR: Pick highest batting skill immediately (Power hitters)
        if (phase === 'death' || rrr > 10) {
            return skillB - skillA;
        }

        // Early Wickets: Pick the most technically solid batter remaining (highest skill)
        if (phase === 'powerplay' && wicketsDown >= 2) {
            return skillB - skillA;
        }

        // Default: Follow the pre-set batting order (stable accumulation)
        return 0; // Keeping sort order neutral as it's already ordered in state.battingOrder
    });

    return sorted[0].player.id;
}

export function botChooseNextBowler(state: MatchState): string | null {
    const available = state.bowlingOrder.filter(
        (b: BowlerState) => b.overs < 4 && b.player.id !== state.lastBowlerId
    );
    // Fallback if everyone else is exhausted but we have someone from the last over with overs left
    const pool = available.length > 0 ? available : state.bowlingOrder.filter(b => b.overs < 4);
    
    if (pool.length === 0) return null;

    const phase = state.matchPhase;
    const battingTeam = state.currentBatting === 'home' ? state.homeTeam : state.awayTeam;

    const sorted = [...pool].sort((a, b) => {
        const skillA = a.player.bowlingSkill;
        const skillB = b.player.bowlingSkill;
        const roleA = a.player.role;
        const roleB = b.player.role;

        // Death Phase Logic (Overs 17-20)
        // Strictly pick the absolute best bowlers (highest skill) regardless of role
        if (phase === 'death') {
            return skillB - skillA;
        }

        // Powerplay Phase Logic (Overs 0-6)
        // Prefer PACE bowlers with high skill
        if (phase === 'powerplay') {
            if (roleA === 'BOWLER' && roleB !== 'BOWLER') return -1;
            if (roleB === 'BOWLER' && roleA !== 'BOWLER') return 1;
            return skillB - skillA;
        }

        // Middle Overs Phase Logic (Overs 7-16)
        // Prefer SPINNING assistance if pitch is spinning
        if (state.pitchType === 'SPINNING') {
            // Note: We don't have sub-roles "Spinner" here, so we default to skill weighting
            return skillB - skillA;
        }

        // Rotation Management: Avoid 3rd consecutive over
        // If they just bowled the previous over (overs count incremented in matchEngine)
        // and we have others available, de-prioritize them slightly
        const matchPerformanceA = a.overs > 0 ? (a.runs / a.overs) : 5; // Default 5 econ
        const matchPerformanceB = b.overs > 0 ? (b.runs / b.overs) : 5;

        // Weight: Skill (70%) vs match performance (30%)
        const scoreA = skillA * 0.7 - matchPerformanceA * 0.3;
        const scoreB = skillB * 0.7 - matchPerformanceB * 0.3;

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
            return skillB - skillA;
        });

        // Retention strategy:
        // 1. Always retain superstar players (skill > 90)
        // 2. Retain very good players (skill > 85) if they are uncapped (cheaper)
        // 3. Limit to max 4 total retentions to save money for auction

        for (const player of sorted) {
            if (!player) continue;
            const skill = Math.max(player.battingSkill || 0, player.bowlingSkill || 0);

            const isUncapped = player.capStatus === 'Uncapped';

            let shouldRetain = false;
            // Bot strategy: retain if skill is high enough
            if (skill >= 90) shouldRetain = true;
            else if (skill >= 86 && team.retained.length < 3) shouldRetain = true;
            else if (isUncapped && skill >= 80 && team.retained.length < 5) shouldRetain = true;

            // Enforce overseas limit
            if (shouldRetain && player.nationality === 'Overseas') {
                const overseasCount = team.retained.filter(r => r.nationality === 'Overseas').length;
                if (overseasCount >= 2) shouldRetain = false;
            }

            if (shouldRetain) {
                // await result of retainPlayer
                await retainPlayer(roomCode, team.userId, player.name);
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

    // Evaluate if bot should use RTM
    const baseMax = getBotMaxHighBid(state.currentPlayer, botTeam);
    
    // RTM is "guaranteed" purchase, so we might be a bit more willing, but respect overall cap heuristics
    const maxRtmPrice = Math.min(baseMax * 1.1, botTeam.purse); 

    const shouldRtm = state.currentBid <= maxRtmPrice && botTeam.purse >= state.currentBid;

    console.log(`[Bot RTM] ${botTeam.teamName} deciding on ${state.currentPlayer.name}. Bid: ${state.currentBid}, Max: ${maxRtmPrice.toFixed(2)}. Decision: ${shouldRtm}`);

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

    // Evaluate if bot should increase price
    const baseMax = getBotMaxHighBid(state.currentPlayer, botTeam);

    // Max bargaining price — slightly higher since they are close to losing the player
    const maxBargainPrice = Math.min(baseMax * 1.25, botTeam.purse);

    // Decide how much to increase. IPL 2025 rule: any amount >= current bid.
    // Bot will try to increase by a significant amount if they really want the player,
    // otherwise they stay at current bid.
    let bargainAmount = state.currentBid;
    if (maxBargainPrice > state.currentBid) {
        // Increase by a random amount between 0.5 and 2.0 Cr
        const increase = Math.max(0.25, Math.round((Math.random() * 1.5 + 0.5) / 0.25) * 0.25);
        bargainAmount = Math.min(state.currentBid + increase, maxBargainPrice, botTeam.purse);
        bargainAmount = Math.round(bargainAmount / 0.25) * 0.25;
    }

    console.log(`[Bot Bargain] ${botTeam.teamName} deciding on ${state.currentPlayer.name}. Bid: ${state.currentBid}, Bargain: ${bargainAmount}, Max: ${maxBargainPrice.toFixed(2)}`);

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

    // Evaluate if bot should match final bargain price
    const baseMax = getBotMaxHighBid(state.currentPlayer, botTeam);

    const maxFinalPrice = Math.min(baseMax * 1.15, botTeam.purse);

    const shouldMatch = state.rtmBargainBid <= maxFinalPrice && botTeam.purse >= state.rtmBargainBid;

    console.log(`[Bot Final Match] ${botTeam.teamName} deciding on ${state.currentPlayer.name}. Bargain Price: ${state.rtmBargainBid}, Max: ${maxFinalPrice.toFixed(2)}. Decision: ${shouldMatch}`);

    const updatedState = await handleFinalMatch(roomCode, shouldMatch);
    if (updatedState) {
        emitToRoom(roomCode, 'auction_update', { state: updatedState });
    }
    return updatedState;
}

export async function ensureBotSelections(roomCode: string, fixtureId: string, teamUserId: string): Promise<any> {
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
    const teamData = auction?.teams.find(t => t.userId === teamUserId);
    if (!teamData) return null;

    const squad = teamData.squad.map(s => ({
        id: s.player.id,
        name: s.player.name,
        role: s.player.role,
        battingSkill: s.player.battingSkill,
        bowlingSkill: s.player.bowlingSkill,
        nationality: s.player.nationality,
    }));

    // Pitch type could be fetched from league fixture if available, otherwise BALANCED
    const selection = botSelectPlaying11(squad);
    await redisObj.set(key, JSON.stringify(selection), 'EX', 86400);
    return selection;
}
