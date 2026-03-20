import { AuctionState, AuctionTeam, placeBid, getAuctionState, sellCurrentPlayer, BID_INCREMENT, handleRtm, handleBargain, handleFinalMatch } from './auctionEngine';
import { CricketPlayer } from '@/data/players';
import { getRoomState } from './roomManager';
import { emitToRoom } from './socket-server';
import { isSpinner } from './matchEngine';
import type { MatchState, BatterState, BowlerState, MatchPlayer } from './matchEngine';
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
    const aggression = 0.8 + (hash % 50) / 100; // 0.8 to 1.3

    return {
        aggression,
        maxOverpay: 1.5 + aggression * 1.5, // 2.25x to 3.45x base price
        rolePreferences: {
            BATSMAN: 1.1,
            BOWLER: 1.0,
            ALL_ROUNDER: 1.4, // Increased as requested
            WICKET_KEEPER: 1.0,
        },
    };
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

    const stadiumId = getTeamHomeStadiumId(team.teamName);
    // Calculate fill score — 0 means squad is full or no need
    const fillScore = playerFillScore(player, team.squad, stadiumId);
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
    hasCurrentBidder: boolean,
    team: AuctionTeam,
    personality: BotPersonality
): { shouldBid: boolean; bidAmount: number } {
    const skillCap = getBotMaxHighBid(player, team);

    const bidAmount = !hasCurrentBidder
        ? currentBid
        : Math.round((currentBid + BID_INCREMENT) * 100) / 100;
    if (bidAmount > skillCap) return { shouldBid: false, bidAmount: 0 };

    const comp = getSquadComposition(team.squad);
    const squadsNeedFactor = comp.total < IPL_MIN_SQUAD ? 1.4 : 1.0;
    const bidRatio = bidAmount / Math.max(skillCap, bidAmount);
    
    // Base probability: (1.2 - bidRatio) ensures even at limit (ratio=1) there's a 20% chance
    let bidProbability = Math.max(0, (1.2 - bidRatio) * personality.aggression * squadsNeedFactor);

    if (!hasCurrentBidder) bidProbability *= 2.0;
    
    const willBid = Math.random() < bidProbability;

    return { shouldBid: willBid, bidAmount };
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
                !!state.currentBidder,
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

export function botSelectPlaying11(squad: EnrichedPlayer[], pitchType: string = 'BALANCED'): {
    selectedIds: string[];
    battingOrder: string[];
    actualOrder: EnrichedPlayer[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
} {
    const isSpinFriendly = pitchType === 'SPINNING';
    const isPaceFriendly = pitchType === 'GREEN' || pitchType === 'HARD';

    // 0. Weighting logic for selection based on skill + ratings + performance
    const getSelectionScore = (p: EnrichedPlayer, context: 'bat' | 'bowl') => {
        let base = context === 'bat' ? (p.battingRating || p.battingSkill) : (p.bowlingRating || p.bowlingSkill);

        // Specialist Roles Boost
        if (context === 'bat') {
            if (p.role === 'BATSMAN' || p.role === 'WICKET_KEEPER') base += 10;
            if (p.role === 'BOWLER') base -= 40; // Heavy penalty for bowlers in batting lineup
        }
        if (context === 'bowl') {
            if (p.role === 'BOWLER') base += 10;
            if (p.role === 'BATSMAN') base -= 40; // Heavy penalty for batters in bowling lineup
        }

        // Performance boost/penalty (More aggressive rotation)
        // Form-based rotation logic
        if (context === 'bat') {
            if (p.recentAverage !== undefined) {
                if (p.recentAverage > 50) base += 20;
                else if (p.recentAverage > 35) base += 10;
                else if (p.recentAverage < 15 && (p.recentMatches || 0) >= 2) base -= 25;
                else if (p.recentAverage < 10) base -= 40;
            }
            if (p.recentStrikeRate !== undefined) {
                if (p.recentStrikeRate > 160) base += 15;
                else if (p.recentStrikeRate > 140) base += 8;
                else if (p.recentStrikeRate < 110 && (p.recentMatches || 0) >= 2) base -= 15;
            }
            if (!p.recentMatches || p.recentMatches === 0) base += 8; 
        } else { // context === 'bowl'
            if (p.recentWickets !== undefined) {
                if (p.recentWickets > 5) base += 15;
                if (p.recentWickets === 0 && (p.recentMatches || 0) >= 2) base -= 15;
            }
            if (p.recentEconomy !== undefined) {
                if (p.recentEconomy < 7.0) base += 12;
                if (p.recentEconomy > 10.5) base -= 25;
            }
            // Bowling Average (Runs per Wicket)
            if (p.recentAverage !== undefined && context === 'bowl') {
                if (p.recentAverage < 20) base += 10;
                else if (p.recentAverage > 40) base -= 10;
            }
            if (!p.recentMatches || p.recentMatches === 0) base += 5;
        }
        return base;
    };

    const eligible: EnrichedPlayer[] = [];
    const seenIds = new Set<string>();
    for (const p of squad.slice(0, IPL_MAX_SQUAD)) {
        if (!seenIds.has(p.id)) {
            eligible.push(p);
            seenIds.add(p.id);
        }
    }

    const selected: EnrichedPlayer[] = [];
    const isSelected = (p: EnrichedPlayer) => selected.some(s => s.id === p.id);

    // Helper for overseas count
    const getOverseasCount = (list: EnrichedPlayer[]) => list.filter(p => p.nationality === 'Overseas').length;

    const finisherArchetypes = ['Finisher', 'Hard Hitter', 'Power Hitter', 'Lower Order'];
    const eliteFinishers = ['Nicholas Pooran', 'Heinrich Klaasen', 'Andre Russell', 'Tim David', 'Liam Livingstone', 'Tristan Stubbs'];
    const namedFinishers = ['MS Dhoni', 'Ramakrishna Ghosh', ...eliteFinishers];
    
    // STRICT ROLE IDENTIFIERS
    const isOpener = (p: EnrichedPlayer) => 
        (p.battingRole?.toLowerCase().includes('opener') || p.primaryArchetype?.includes('Opener') || p.secondaryArchetype?.includes('Opener')) && 
        !namedFinishers.includes(p.name) && 
        p.name !== 'Rishabh Pant' &&
        p.name !== 'Ravindra Jadeja' && 
        p.name !== 'Rashid Khan';

    const isExplicitFinisher = (p: EnrichedPlayer) => 
        (namedFinishers.includes(p.name) || 
        finisherArchetypes.includes(p.battingRole || '') || 
        finisherArchetypes.some(a => p.primaryArchetype?.includes(a)) ||
        p.secondaryArchetype?.includes('Finisher')) && 
        p.name !== 'Shivam Dube';

    const isAnchor = (p: EnrichedPlayer) => 
        (p.primaryArchetype?.includes('Anchor') || p.primaryArchetype?.includes('Stable') || p.battingRole?.includes('Number 3') || p.name === 'Rishabh Pant' || p.name === 'Ryan Rickelton' || p.name === 'KL Rahul') &&
        !isOpener(p);

    const isMiddleOrder = (p: EnrichedPlayer) => 
        p.name === 'Shivam Dube' || 
        p.name === 'Tilak Varma' ||
        p.name === 'Rahul Tripathi' ||
        p.battingRole?.toLowerCase().includes('middle') || 
        p.primaryArchetype?.includes('Middle') || 
        p.primaryArchetype?.includes('Spin Basher') ||
        p.name === 'Liam Livingstone' ||
        p.name === 'Ravindra Jadeja';

    const isEliteFinisher = (p: EnrichedPlayer) => eliteFinishers.includes(p.name);

    // 1. Mandatory Picks (WK)
    const wks = [...eligible].filter(p => p.role === 'WICKET_KEEPER')
        .sort((a, b) => getSelectionScore(b, 'bat') - getSelectionScore(a, 'bat'));
    
    // Pick best WK, but be mindful of overseas
    let primaryWK = wks.find(p => p.nationality !== 'Overseas');
    if (!primaryWK) primaryWK = wks[0]; // If only overseas WKs exist
    if (primaryWK) selected.push(primaryWK);

    // Helper for adding players with overseas constraint
    const tryAddWithLimit = (pool: EnrichedPlayer[], count: number) => {
        let added = 0;
        for (const p of pool) {
            if (added >= count) break;
            if (isSelected(p)) continue;
            
            const isOverseas = p.nationality === 'Overseas';
            if (isOverseas && getOverseasCount(selected) >= 4) continue;
            
            selected.push(p);
            added++;
        }
    };

    // 2. ROLE-BASED SELECTION (Balanced XI)
    // 2a. Ensure 2 Openers
    const openersPool = eligible.filter(p => isOpener(p) && !isSelected(p))
        .sort((a, b) => getSelectionScore(b, 'bat') - getSelectionScore(a, 'bat'));
    tryAddWithLimit(openersPool, 2);

    // 2b. Ensure 1 Anchor
    const anchorPool = eligible.filter(p => isAnchor(p) && !isSelected(p))
        .sort((a, b) => getSelectionScore(b, 'bat') - getSelectionScore(a, 'bat'));
    tryAddWithLimit(anchorPool, 1);

    // 2c. Ensure 2 Middle Order
    const midPool = eligible.filter(p => isMiddleOrder(p) && !isSelected(p))
        .sort((a, b) => getSelectionScore(b, 'bat') - getSelectionScore(a, 'bat'));
    tryAddWithLimit(midPool, 2);

    // 2d. Ensure 1 Finisher
    const finPool = eligible.filter(p => isExplicitFinisher(p) && !isSelected(p))
        .sort((a, b) => getSelectionScore(b, 'bat') - getSelectionScore(a, 'bat'));
    tryAddWithLimit(finPool, 1);

    // 2e. Pick bowlers (Ensure at least 4 specialists)
    const bowlsPool = eligible.filter(p => p.role === 'BOWLER' && !isSelected(p))
        .sort((a, b) => getSelectionScore(b, 'bowl') - getSelectionScore(a, 'bowl'));
    tryAddWithLimit(bowlsPool, 4);

    // 2f. Fill to 11 (Favor best remaining, prioritizing Indians if overseas limit reached)
    const othersPool = eligible.filter(p => !isSelected(p))
        .sort((a, b) => {
            const scoreB = Math.max(getSelectionScore(b, 'bat'), getSelectionScore(b, 'bowl'));
            const scoreA = Math.max(getSelectionScore(a, 'bat'), getSelectionScore(a, 'bowl'));
            return scoreB - scoreA;
        });

    while (selected.length < 11 && othersPool.length > 0) {
        const next = othersPool.shift()!;
        const isOverseas = next.nationality === 'Overseas';
        if (isOverseas && getOverseasCount(selected) >= 4) continue;
        
        selected.push(next);
    }
    
    // 3. Absolute Fallback (If still short)
    if (selected.length < 11) {
        const fallbacks = eligible.filter(p => !isSelected(p))
            .sort((a, b) => (a.nationality === 'Overseas' ? 1 : -1));
        for (const p of fallbacks) {
            if (selected.length >= 11) break;
            if (p.nationality === 'Overseas' && getOverseasCount(selected) >= 4) continue;
            selected.push(p);
        }
    }

    // 4. Construct strictly sequenced order (#1-11)
    const getBattingPriority = (p: EnrichedPlayer) => {
        if (isOpener(p)) return 100;
        if (isAnchor(p)) return 95;
        if (isMiddleOrder(p)) return 90; 
        if (isEliteFinisher(p)) return 85; 
        if (isExplicitFinisher(p)) return 75;
        
        if (p.role === 'BATSMAN' || p.role === 'WICKET_KEEPER') return 60;
        if (p.role === 'ALL_ROUNDER') return 50;
        if (p.role === 'BOWLER' || p.battingSkill < 30) return 20;
        return 10;
    };

    const actualOrder = [...selected].sort((a, b) => {
        const pA = getBattingPriority(a);
        const pB = getBattingPriority(b);
        
        if (pA !== pB) return pB - pA;
        
        // If same priority, use skill/rating
        const scoreA = getSelectionScore(a, 'bat');
        const scoreB = getSelectionScore(b, 'bat');
        return scoreB - scoreA;
    });

    const battingOrder = actualOrder.map(p => p.id).slice(0, 11);

    // 4. Metadata (Captain/WK/Bowler)
    // 4a. Leadership Logic: Exclude Pathirana and pure Tail-enders from Captaincy
    const KNOWN_CAPTAINS = [
        'MS Dhoni', 'Virat Kohli', 'Rohit Sharma', 'Hardik Pandya', 'KL Rahul', 
        'Shubman Gill', 'Ruturaj Gaikwad', 'Shreyas Iyer', 'Sanju Samson', 'Pat Cummins', 
        'Rishabh Pant', 'Nicholas Pooran', 'David Miller', 'Kane Williamson', 'Jos Buttler'
    ];

    const captain = [...selected]
        .filter(p => p.name !== 'Matheesha Pathirana' && p.battingSkill > 40)
        .sort((a, b) => {
            // 1. Prioritize known established captains
            const aKnown = KNOWN_CAPTAINS.includes(a.name) ? 1 : 0;
            const bKnown = KNOWN_CAPTAINS.includes(b.name) ? 1 : 0;
            if (aKnown !== bKnown) return bKnown - aKnown;

            // 2. Prioritize named captains in data
            const aCap = a.battingRole?.includes('Captain') || a.primaryArchetype?.includes('Captain') ? 1 : 0;
            const bCap = b.battingRole?.includes('Captain') || b.primaryArchetype?.includes('Captain') ? 1 : 0;
            if (aCap !== bCap) return bCap - aCap;
            
            // 3. Overall skill
            return Math.max(b.battingSkill, b.bowlingSkill) - Math.max(a.battingSkill, a.bowlingSkill);
        })[0] || selected[0];
    
    const wk = selected.find(p => p.role === 'WICKET_KEEPER') || selected[0];
    const openingBowler = selected.filter(p => (p.role === 'BOWLER' || p.role === 'ALL_ROUNDER') && p.name !== 'Matheesha Pathirana')
        .sort((a, b) => getSelectionScore(b, 'bowl') - getSelectionScore(a, 'bowl'))[0];

    return {
        selectedIds: selected.map(p => p.id),
        battingOrder,
        actualOrder: actualOrder.slice(0, 11),
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
    const battingTeamStats = state.currentBatting === 'home' ? state.homeTeam : state.awayTeam;
    const wicketsDown = battingTeamStats.wickets;
    const score = battingTeamStats.score;
    const overs = battingTeamStats.overs + (battingTeamStats.balls / 6);

    // Helpers from main scope (using identical logic from botSelectPlaying11)
    const eliteFinishers = ['Nicholas Pooran', 'Heinrich Klaasen', 'Andre Russell', 'Tim David', 'Liam Livingstone', 'Tristan Stubbs'];
    const finisherArchetypes = ['Finisher', 'Hard Hitter', 'Power Hitter', 'Lower Order'];
    
    const isElite = (p: MatchPlayer) => eliteFinishers.includes(p.name);
    const isFin = (p: MatchPlayer) => 
        finisherArchetypes.includes(p.battingRole || '') || 
        finisherArchetypes.some((a: string) => p.primaryArchetype?.includes(a) || p.secondaryArchetype?.includes(a));
    
    const isAnchorPlayer = (p: MatchPlayer) => 
        (p.primaryArchetype?.includes('Anchor') || p.primaryArchetype?.includes('Stable') || p.battingRole?.includes('Number 3') || p.name === 'Rishabh Pant' || p.name === 'KL Rahul');

    const isMidOrderPlayer = (p: MatchPlayer) =>
        p.name === 'Tilak Varma' || 
        p.name === 'Rahul Tripathi' || 
        p.name === 'Shivam Dube' ||
        p.battingRole?.toLowerCase().includes('middle') || 
        p.primaryArchetype?.includes('Middle');

    // SITUATIONS
    
    // 1. COLLAPSE RECOVERY: If 2+ wickets in last 12 balls
    const last2Fow = battingTeamStats.fow.slice(-2);
    const isCollapse = last2Fow.length >= 2 && (overs - last2Fow[0].over) <= 2.0;

    if (isCollapse) {
        // Send the best Anchor or Middle Order remaining, regardless of phase
        const stabilizer = available.filter(b => isAnchorPlayer(b.player) || isMidOrderPlayer(b.player))
            .sort((a, b) => (b.player.battingRating || b.player.battingSkill) - (a.player.battingRating || a.player.battingSkill))[0];
        if (stabilizer) return stabilizer.player.id;
    }

    // 2. TARGET PRESSURE: High RRR in 2nd Innings
    if (state.target && state.ballsRemaining && state.ballsRemaining > 0) {
        const rrr = ((state.target - battingTeamStats.score) / state.ballsRemaining) * 6;
        if (rrr > 11 && phase !== 'powerplay') {
            // Promote Elite Finisher or Hard Hitter NOW
            const dasher = available.find(b => isElite(b.player) || isFin(b.player));
            if (dasher) return dasher.player.id;
        }
    }

    // 3. MOMENTUM: Strong position, attack early
    if (wicketsDown <= 2 && score >= 100 && overs >= 10 && phase !== 'death') {
        const elite = available.find(b => isElite(b.player));
        if (elite) return elite.player.id;
    }

    // 4. CRISIS: Top order gone early in Powerplay
    if (phase === 'powerplay' && wicketsDown >= 2) {
        const solid = available.filter(b => isAnchorPlayer(b.player))
            .sort((a, b) => (b.player.battingRating || b.player.battingSkill) - (a.player.battingRating || a.player.battingSkill))[0];
        if (solid) return solid.player.id;
    }

    // 5. DEATH: Maximize remaining hitters
    if (phase === 'death') {
        const sorted = [...available].sort((a, b) => {
            const priority = (p: MatchPlayer) => (isElite(p) ? 100 : (isFin(p) ? 80 : 50));
            const pA = priority(a.player);
            const pB = priority(b.player);
            if (pA !== pB) return pB - pA;
            return (b.player.battingRating || b.player.battingSkill) - (a.player.battingRating || a.player.battingSkill);
        });
        return sorted[0].player.id;
    }

    // Default: Follow the pre-set batting order
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
        const skillA = a.player.bowlingRating || a.player.bowlingSkill;
        const skillB = b.player.bowlingRating || b.player.bowlingSkill;
        
        const isDeathSpecialistA = a.player.bowlingRole?.toLowerCase().includes('death');
        const isDeathSpecialistB = b.player.bowlingRole?.toLowerCase().includes('death');
        
        const isPowerplaySpecialistA = a.player.bowlingRole?.toLowerCase().includes('opening') || a.player.bowlingRole?.toLowerCase().includes('new ball');
        const isPowerplaySpecialistB = b.player.bowlingRole?.toLowerCase().includes('opening') || b.player.bowlingRole?.toLowerCase().includes('new ball');

        const spinnerA = isSpinner(a.player);
        const spinnerB = isSpinner(b.player);

        if (phase === 'powerplay') {
            if (a.player.name === 'Matheesha Pathirana') return 1; // Pathirana shouldn't bowl in PP
            if (b.player.name === 'Matheesha Pathirana') return -1;

            if (isPowerplaySpecialistA && !isPowerplaySpecialistB) return -1;
            if (isPowerplaySpecialistB && !isPowerplaySpecialistA) return 1;
            // Prefer pace in powerplay unless it's a specialist spinner
            if (!spinnerA && spinnerB) return -1;
            if (spinnerA && !spinnerB) return 1;
        } else if (phase === 'death') {
            if (isDeathSpecialistA && !isDeathSpecialistB) return -1;
            if (isDeathSpecialistB && !isDeathSpecialistA) return 1;
            return skillB - skillA;
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
            return skillB - skillA;
        });

        // Retention strategy:
        // - Retain superstars (92+) regardless.
        // - Retain very good (87+) if slots < 3.
        // - Retain uncapped assets (80+) aggressively (slots < 5).
        
        for (const player of sorted) {
            if (!player) continue;
            const skill = Math.max(player.battingSkill || 0, player.bowlingSkill || 0);
            const isUncapped = player.capStatus === 'Uncapped';
            
            let shouldRetain = false;
            if (skill >= 92) shouldRetain = true;
            else if (skill >= 87 && team.retained.length < 3) shouldRetain = true;
            else if (isUncapped && skill >= 80 && team.retained.length < 5) shouldRetain = true;

            if (shouldRetain && player.nationality === 'Overseas') {
                const overseasCount = team.retained.filter(r => r.nationality === 'Overseas').length;
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

interface Playing11Selection {
    selectedIds: string[];
    battingOrder: string[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
}

export async function ensureBotSelections(roomCode: string, fixtureId: string, teamUserId: string): Promise<Playing11Selection | null> {
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

        if (stats && stats.matches > 0) {
            recentAverage = stats.runs / stats.matches;
            recentWickets = stats.wickets / stats.matches;
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
        };
    });

    // Pitch type could be fetched from league fixture if available, otherwise BALANCED
    const selection = botSelectPlaying11(squad);
    await redisObj.set(key, JSON.stringify(selection), 'EX', 86400);
    return selection;
}
