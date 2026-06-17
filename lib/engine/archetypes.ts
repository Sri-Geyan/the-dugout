export function assignBatterArchetypes(ratings: Record<string, number>): string[] {
  const archetypes: string[] = [];

  if (ratings.boundaryHitting > 85 && ratings.strikeRotation < 60) archetypes.push('Aggressor');
  if (ratings.strikeRotation > 85 && ratings.consistency > 80) archetypes.push('Anchor');
  if (ratings.deathBatting > 85) archetypes.push('Finisher');
  if (ratings.spinRating > 85 && ratings.paceRating < 75) archetypes.push('Spin Basher');
  if (ratings.paceRating > 85 && ratings.spinRating < 75) archetypes.push('Pace Basher');
  if (ratings.pressureBatting > 85) archetypes.push('Clutch Player');
  if (ratings.powerplayBatting > 85 && ratings.boundaryHitting > 80) archetypes.push('Powerplay Destroyer');

  if (archetypes.length === 0) archetypes.push('Accumulator');

  return archetypes;
}

export function assignBowlerArchetypes(ratings: Record<string, number>): string[] {
  const archetypes: string[] = [];

  if (ratings.deathBowling > 85) archetypes.push('Death Specialist');
  if (ratings.wicketTaking > 85) archetypes.push('Strike Bowler');
  if (ratings.economyRating > 85) archetypes.push('Containment Bowler');
  if (ratings.spinSkill > 85 && ratings.wicketTaking > 80) archetypes.push('Mystery Spinner');
  if (ratings.powerplayBowling > 85) archetypes.push('Powerplay Specialist');
  if (ratings.pressureBowling > 85) archetypes.push('Clutch Bowler');

  if (archetypes.length === 0) archetypes.push('Workhorse');

  return archetypes;
}
