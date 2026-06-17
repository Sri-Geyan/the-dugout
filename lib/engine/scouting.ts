export interface ScoutReportInputs {
  name: string;
  role: string;
  ratings: Record<string, number>;
  overall: number;
}

export interface ScoutReportOutput {
  strengths: string[];
  weaknesses: string[];
  futurePotential: string;
  generatedText: string;
}

export function generateScoutReport(inputs: ScoutReportInputs): ScoutReportOutput {
  const { name, role, ratings, overall } = inputs;
  
  // Sort attributes to find top and bottom
  const entries = Object.entries(ratings)
    .filter(([key]) => key !== 'overall' && key !== 'id')
    .sort((a, b) => b[1] - a[1]);

  const top3 = entries.slice(0, 3);
  const bottom2 = entries.slice(-2);

  const formatKey = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  const strengths = top3.map(([k, v]) => `Excellent ${formatKey(k)} (${Math.round(v)})`);
  const weaknesses = bottom2.map(([k, v]) => `Below Average ${formatKey(k)} (${Math.round(v)})`);

  let potential = 'C';
  if (overall > 85) potential = 'A+';
  else if (overall > 75) potential = 'A';
  else if (overall > 65) potential = 'B';
  
  const generatedText = `Player: ${name}\n\nStrengths:\n${strengths.map(s => '* ' + s).join('\n')}\n\nWeaknesses:\n${weaknesses.map(w => '* ' + w).join('\n')}\n\nFuture Potential: ${potential}`;

  return {
    strengths,
    weaknesses,
    futurePotential: potential,
    generatedText
  };
}
