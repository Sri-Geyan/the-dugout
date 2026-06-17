export interface InningData {
  score: number;
  balls: number;
  isOut: boolean;
  date: string; // ISO date string
}

export function calculateFormDecay(innings: InningData[]): number {
  if (!innings || innings.length === 0) return 0;
  
  // Sort by most recent first
  const sorted = [...innings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const last5 = sorted.slice(0, 5);
  const next5 = sorted.slice(5, 10);
  const next10 = sorted.slice(10, 20);

  // Example heuristic: 
  // Good form = high average and high SR recently
  // We'll calculate a "score" for each bracket and weight it.
  
  const getBracketScore = (bracket: InningData[]) => {
    if (bracket.length === 0) return 0;
    const runs = bracket.reduce((sum, inn) => sum + inn.score, 0);
    const outs = bracket.filter(inn => inn.isOut).length || 1; // avoid / 0
    const avg = runs / outs;
    // Map avg to a -5 to +5 modifier scale where 30 is neutral
    return (avg - 30) / 10; 
  };

  const score1 = getBracketScore(last5);
  const score2 = getBracketScore(next5);
  const score3 = getBracketScore(next10);

  // Decay weighting
  // Last 5: 50%
  // 6-10: 30%
  // 11-20: 20%
  let finalModifier = (score1 * 0.5) + (score2 * 0.3) + (score3 * 0.2);

  // Clamp modifier to [-5, +5]
  return Math.round(Math.max(-5, Math.min(5, finalModifier)));
}

export function calculateCurrentOverall(baseRating: number, currentForm: number): number {
  return Math.max(40, Math.min(99, baseRating + currentForm));
}
