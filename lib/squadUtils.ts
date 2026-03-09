import { CricketPlayer } from '@/data/players';

export function analyzeSquadNeeds(squad: { player: CricketPlayer }[]): Record<string, number> {
    const counts: Record<string, number> = {
        BATSMAN: 0, BOWLER: 0, ALL_ROUNDER: 0, WICKET_KEEPER: 0,
    };
    squad.forEach(s => {
        const role = s.player?.role || 'BATSMAN';
        counts[role] = (counts[role] || 0) + 1;
    });

    // How much we need each role (higher = more needed)
    const needs: Record<string, number> = {
        BATSMAN: counts.BATSMAN < 4 ? 1.5 : counts.BATSMAN < 6 ? 1.1 : 0.6,
        BOWLER: counts.BOWLER < 4 ? 1.5 : counts.BOWLER < 6 ? 1.1 : 0.6,
        ALL_ROUNDER: counts.ALL_ROUNDER < 3 ? 1.4 : counts.ALL_ROUNDER < 5 ? 1.1 : 0.7,
        WICKET_KEEPER: counts.WICKET_KEEPER < 1 ? 2.5 : counts.WICKET_KEEPER < 2 ? 1.2 : 0.4,
    };

    // Global density target: 85% of 25 = 21 players
    // If squad is small, increase desire for ANY player
    const densityRatio = squad.length / 21;
    if (densityRatio < 1) {
        Object.keys(needs).forEach(k => {
            (needs as any)[k] *= (1.5 - (densityRatio * 0.5));
        });
    }

    return needs;
}
