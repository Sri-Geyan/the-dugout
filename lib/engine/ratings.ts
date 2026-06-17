// Normalization Helpers
const normAvg = (avg: number) => Math.min((avg / 50) * 100, 100);
const normSR = (sr: number) => Math.min((sr / 200) * 100, 100);
const normPct = (pct: number) => Math.min(pct, 100);
const normEcon = (econ: number) => {
  // Lower economy is better. Max 100 for econ <= 5, 0 for econ >= 12
  return Math.max(0, Math.min(100, ((12 - econ) / 7) * 100));
};

export interface BattingInputs {
  avg: number;
  sr: number;
  boundaryPct: number;
  dotBallAvoidancePct?: number; // mainly for middle overs
}

export function calculateBattingRating(inputs: BattingInputs, isMiddleOvers = false): number {
  const nAvg = normAvg(inputs.avg);
  const nSr = normSR(inputs.sr);
  
  if (isMiddleOvers && inputs.dotBallAvoidancePct !== undefined) {
    const nDot = normPct(inputs.dotBallAvoidancePct);
    return (nAvg * 0.4) + (nSr * 0.4) + (nDot * 0.2);
  }
  
  const nBound = normPct(inputs.boundaryPct);
  return (nAvg * 0.4) + (nSr * 0.4) + (nBound * 0.2);
}

export function calculateDeathBatting(inputs: BattingInputs): number {
  const nAvg = normAvg(inputs.avg);
  const nSr = normSR(inputs.sr);
  const nBound = normPct(inputs.boundaryPct);
  return (nSr * 0.5) + (nBound * 0.3) + (nAvg * 0.2);
}

export function calculateConsistency(stdDev: number): number {
  // standard deviation of runs, say 0 to 50
  // consistency = 100 - stdDev (if normalized)
  const normalizedStdDev = Math.min((stdDev / 50) * 100, 100);
  return Math.max(0, 100 - normalizedStdDev);
}

export interface BatterOverallInputs {
  pace: number;
  spin: number;
  powerplay: number;
  middle: number;
  death: number;
  chasing: number;
  pressure: number;
  consistency: number;
  fielding: number;
}

export function calculateBatterOverall(inputs: BatterOverallInputs): number {
  const overall = (
    inputs.pace * 0.15 +
    inputs.spin * 0.15 +
    inputs.powerplay * 0.10 +
    inputs.middle * 0.15 +
    inputs.death * 0.15 +
    inputs.chasing * 0.10 +
    inputs.pressure * 0.10 +
    inputs.consistency * 0.05 +
    inputs.fielding * 0.05
  );
  return Math.max(40, Math.min(99, Math.round(overall)));
}

export interface BowlerOverallInputs {
  powerplay: number;
  middle: number;
  death: number;
  economy: number;
  wicket_taking: number;
  pressure: number;
  consistency: number;
  fielding: number;
}

export function calculateBowlerOverall(inputs: BowlerOverallInputs): number {
  const overall = (
    inputs.powerplay * 0.15 +
    inputs.middle * 0.15 +
    inputs.death * 0.20 +
    inputs.economy * 0.15 +
    inputs.wicket_taking * 0.15 +
    inputs.pressure * 0.10 +
    inputs.consistency * 0.05 +
    inputs.fielding * 0.05
  );
  return Math.max(40, Math.min(99, Math.round(overall)));
}
