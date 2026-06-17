class ContextModifierEngine:
    def __init__(self):
        self.venue_bonuses = {
            "MA Chidambaram Stadium": {"SPIN_BOWLER": 1.20, "PACE_BOWLER": 0.90},
            "M Chinnaswamy Stadium": {"BATTER": 1.15, "PACE_BOWLER": 1.10},
            "Wankhede Stadium": {"PACE_BOWLER": 1.15}
        }
        self.dna_bonuses = {
            "CSK": {"experience": 1.15, "SPIN_BOWLER": 1.10},
            "MI": {"youth": 1.15, "PACE_BOWLER": 1.10},
            "KKR": {"ALL_ROUNDER": 1.15, "SPIN_BOWLER": 1.10},
            "RCB": {"BATTER": 1.20}
        }
        
    def modify_probability(self, player, base_prob, team_id, venue):
        modified_prob = base_prob
        reasons = []
        
        role = player.get("role", "BATTER")
        age = player.get("age", 25)
        
        # Venue modifiers
        venue_mods = self.venue_bonuses.get(venue, {})
        if role in venue_mods:
            multiplier = venue_mods[role]
            modified_prob *= multiplier
            if multiplier > 1.0:
                reasons.append(f"{venue} {role} Advantage (+{int((multiplier-1)*100)}%)")
            else:
                reasons.append(f"{venue} {role} Disadvantage (-{int((1-multiplier)*100)}%)")
                
        # Franchise DNA modifiers
        dna = self.dna_bonuses.get(team_id, {})
        if role in dna:
            modified_prob *= dna[role]
            reasons.append(f"{team_id} DNA: Prefers {role}s")
            
        if "experience" in dna and age > 30:
            modified_prob *= dna["experience"]
            reasons.append(f"{team_id} DNA: Values Experience")
            
        if "youth" in dna and age < 25:
            modified_prob *= dna["youth"]
            reasons.append(f"{team_id} DNA: Values Youth")
            
        # Form / Fitness modifiers
        if player.get("form_rating", 5) > 8:
            reasons.append("Exceptional Recent Form")
            modified_prob *= 1.2
        elif player.get("form_rating", 5) < 3:
            reasons.append("Poor Recent Form")
            modified_prob *= 0.7
            
        if player.get("fitness_rating", 100) < 60:
            reasons.append("Low Fitness / Workload Managed")
            modified_prob *= 0.5
            
        # Cap probability at 0.99
        modified_prob = min(0.99, modified_prob)
        return modified_prob, reasons
