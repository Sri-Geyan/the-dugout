import { CricketPlayer } from '@/data/players';

export const IPL_MAX_OVERSEAS = 8;
export const IPL_MIN_SQUAD = 21;
export const IPL_MAX_SQUAD = 25;

export interface SquadComposition {
    total: number;
    overseas: number;
    indian: number;
    batsmen: number;
    bowlers: number;
    allRounders: number;
    wicketKeepers: number;
}

export function getSquadComposition(squad: { player: CricketPlayer }[]): SquadComposition {
    const counts: SquadComposition = {
        total: 0, overseas: 0, indian: 0,
        batsmen: 0, bowlers: 0, allRounders: 0, wicketKeepers: 0,
    };
    squad.forEach(s => {
        const p = s.player;
        if (!p) return;
        counts.total++;
        if (p.nationality === 'Overseas') counts.overseas++;
        else counts.indian++;
        if (p.role === 'BATSMAN') counts.batsmen++;
        else if (p.role === 'BOWLER') counts.bowlers++;
        else if (p.role === 'ALL_ROUNDER') counts.allRounders++;
        else if (p.role === 'WICKET_KEEPER') counts.wicketKeepers++;
    });
    return counts;
}

export function canAddOverseas(squad: { player: CricketPlayer }[]): boolean {
    const comp = getSquadComposition(squad);
    return comp.overseas < IPL_MAX_OVERSEAS;
}

import { STADIUMS, getStadiumById } from '@/data/stadiums';

/**
 * Returns a "need score" per role and nationality combo for this team.
 * Higher = more needed. Used by bots to decide whom to bid on.
 */
export function analyzeSquadNeeds(
    squad: { player: CricketPlayer }[],
    homeStadiumId?: string
): Record<string, number> {
    const comp = getSquadComposition(squad);
    const stadium = homeStadiumId ? getStadiumById(homeStadiumId) : null;
    
    // Pitch multipliers (default to 1.0)
    let spinMultiplier = 1.0;
    let paceMultiplier = 1.0;
    let batMultiplier = 1.0;

    if (stadium) {
        if (stadium.defaultPitch === 'SPINNING') spinMultiplier = 1.3;
        if (stadium.defaultPitch === 'BATTING') batMultiplier = 1.25;
        if (stadium.turn >= 4) spinMultiplier = Math.max(spinMultiplier, 1.4);
        if (stadium.bounce >= 4) paceMultiplier = 1.2;
        if (stadium.earlySwing) paceMultiplier = Math.max(paceMultiplier, 1.25);
    }

    // Track granular sub-roles
    let openers = 0;
    let anchors = 0;
    let finishers = 0;
    let pacers = 0;
    let spinBashers = 0;

    const eliteFinishers = ['Nicholas Pooran', 'Heinrich Klaasen', 'Andre Russell', 'Tim David', 'Liam Livingstone', 'Tristan Stubbs'];
    const finisherArchetypes = ['Finisher', 'Hard Hitter', 'Power Hitter', 'Lower Order'];
    const spinBasherArchetypes = ['Middle-Order Hitter', 'Aggressive Middle-Order', '360', 'Pinch-Hitter', 'Finisher'];

    squad.forEach(s => {
        const p = s.player;
        if (!p) return;
        const roleStr = (p.battingRole || '').toLowerCase();
        const archStr = (p.primaryArchetype || '').toLowerCase();

        if (roleStr.includes('opener') || archStr.includes('opener')) openers++;
        else if (roleStr.includes('anchor') || archStr.includes('stable') || roleStr.includes('number 3') || archStr.includes('anchor')) anchors++;
        else if (eliteFinishers.includes(p.name) || finisherArchetypes.some(a => roleStr.includes(a.toLowerCase()) || archStr.includes(a.toLowerCase()))) finishers++;

        if (spinBasherArchetypes.some(a => roleStr.includes(a.toLowerCase()) || archStr.includes(a.toLowerCase()))) spinBashers++;

        const isPace = p.bowlingRole?.toLowerCase().includes('pacer') || 
                       p.bowlingRole?.toLowerCase().includes('fast') ||
                       p.primaryArchetype?.toLowerCase().includes('pacer');
        if (isPace) pacers++;
    });

    // Hard-coded minimums for a balanced 25-player squad
    const needs: Record<string, number> = {
        WICKET_KEEPER: comp.wicketKeepers < 1 ? 1.8 : comp.wicketKeepers < 2 ? 1.3 : 0.4,
        BATSMAN: (comp.batsmen < 4 ? 1.5 : comp.batsmen < 6 ? 1.1 : 0.6) * batMultiplier,
        BOWLER: comp.bowlers < 5 ? 1.5 : comp.bowlers < 8 ? 1.1 : 0.6,
        ALL_ROUNDER: (comp.allRounders < 3 ? 1.6 : comp.allRounders < 6 ? 1.2 : 0.6) * ((batMultiplier + paceMultiplier + (pacers < 3 ? 1.5 : spinMultiplier)) / 3),
    };

    if (pacers < 3) paceMultiplier = Math.max(paceMultiplier, 1.5);
    else if (pacers < 5) paceMultiplier = Math.max(paceMultiplier, 1.25);

    // Sub-role multipliers
    let openerMultiplier = (openers < 2 ? 1.5 : openers < 3 ? 1.2 : 0.7) * (batMultiplier > 1.1 ? 1.15 : 1.0);
    let anchorMultiplier = (anchors < 2 ? 1.3 : anchors < 3 ? 1.1 : 0.8) * (spinMultiplier > 1.1 ? 1.1 : 1.0);
    let finisherMultiplier = (finishers < 2 ? 1.4 : finishers < 3 ? 1.2 : 0.7) * (batMultiplier > 1.1 ? 1.2 : 1.0);
    let spinBasherMultiplier = (spinBashers < 3 ? 1.3 : spinBashers < 5 ? 1.1 : 0.8);

    return { 
        ...needs, 
        _openers: openerMultiplier, 
        _anchors: anchorMultiplier, 
        _finishers: finisherMultiplier,
        _spinBashers: spinBasherMultiplier,
        _spin: spinMultiplier,
        _pace: paceMultiplier
    };
}

/**
 * Returns how much "need" a specific player fills for a team.
 * Considers overseas quota, squad density, and role requirements.
 */
export function playerFillScore(
    player: CricketPlayer,
    squad: { player: CricketPlayer }[],
    homeStadiumId?: string
): number {
    const comp = getSquadComposition(squad);

    // Hard block: squad full
    if (comp.total >= IPL_MAX_SQUAD) return 0;
    // Hard block: overseas quota full
    if (player.nationality === 'Overseas' && comp.overseas >= IPL_MAX_OVERSEAS) return 0;

    const needs = analyzeSquadNeeds(squad, homeStadiumId);
    let roleNeed = needs[player.role] ?? 1.0;

    const isSpinPlayer = player.bowlingRole?.toLowerCase().includes('spinner') || 
                       player.primaryArchetype?.toLowerCase().includes('spinner');
    const isPacePlayer = player.bowlingRole?.toLowerCase().includes('pacer') || 
                       player.bowlingRole?.toLowerCase().includes('fast') ||
                       player.primaryArchetype?.toLowerCase().includes('pacer');

    if (isSpinPlayer) roleNeed *= (needs._spin ?? 1.0);
    if (isPacePlayer) roleNeed *= (needs._pace ?? 1.0);

    // Apply granular sub-role multipliers
    const roleStr = (player.battingRole || '').toLowerCase();
    const archStr = (player.primaryArchetype || '').toLowerCase();
    const eliteFinishers = ['Nicholas Pooran', 'Heinrich Klaasen', 'Andre Russell', 'Tim David', 'Liam Livingstone', 'Tristan Stubbs'];
    const finisherArchetypes = ['Finisher', 'Hard Hitter', 'Power Hitter', 'Lower Order'];

    if (roleStr.includes('opener') || archStr.includes('opener')) {
        roleNeed *= (needs._openers ?? 1.0);
    } else if (roleStr.includes('anchor') || archStr.includes('stable') || roleStr.includes('number 3') || archStr.includes('anchor')) {
        roleNeed *= (needs._anchors ?? 1.0);
    } else if (eliteFinishers.includes(player.name) || finisherArchetypes.some(a => roleStr.includes(a.toLowerCase()) || archStr.includes(a.toLowerCase()))) {
        roleNeed *= (needs._finishers ?? 1.0);
    }

    const spinBasherArchetypes = ['Middle-Order Hitter', 'Aggressive Middle-Order', '360', 'Pinch-Hitter', 'Finisher'];
    if (spinBasherArchetypes.some(a => roleStr.includes(a.toLowerCase()) || archStr.includes(a.toLowerCase()))) {
        roleNeed *= (needs._spinBashers ?? 1.0);
    }

    // Capped vs Uncapped Balance
    // Define "Capped" as basePrice >= 1.0 or skill > 75
    const isCapped = player.basePrice >= 1.0 || Math.max(player.battingSkill, player.bowlingSkill) > 75;
    const squadCapped = squad.filter(s => (s.player.basePrice || 0) >= 1.0 || Math.max(s.player.battingSkill, s.player.bowlingSkill) > 75).length;
    const squadUncapped = comp.total - squadCapped;

    let balanceMultiplier = 1.0;
    if (isCapped && squadCapped > 10) balanceMultiplier = 0.8; // Don't overspend on too many stars
    if (!isCapped && squadUncapped > 12) balanceMultiplier = 0.7; // Don't fill squad with too many low-skill players

    const skill = Math.max(player.battingSkill, player.bowlingSkill);
    return roleNeed * (skill / 70) * balanceMultiplier;
}
