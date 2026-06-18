class MatchupVenueEngine:
    def __init__(self):
        pass
        
    def adjust_probabilities(self, probs, pitch_data=None, batter_rating=80, bowler_rating=80, bowler_type="pace", innings=1):
        # 1. Base Matchup Modifiers (Higher rating wins)
        rating_diff = batter_rating - bowler_rating
        
        # Base multipliers
        boundary_multiplier = 1.0 + (rating_diff * 0.01) # e.g., +10 diff = 10% more boundaries
        wicket_multiplier = 1.0 - (rating_diff * 0.015) # e.g., +10 diff = 15% fewer wickets
        
        # 2. Dynamic Pitch Modifiers
        if pitch_data:
            bat_friendly = pitch_data.get('batFriendly', 3) # 1 to 5 scale
            bounce = pitch_data.get('bounce', 3) # 1 to 5
            turn = pitch_data.get('turn', 3) # 1 to 5
            dew_prob = pitch_data.get('dewProbability', 0.0) # 0.0 to 1.0
            
            # Bat friendly pitches increase boundaries
            boundary_multiplier *= (1.0 + (bat_friendly - 3) * 0.05)
            # High bounce increases boundaries (easier timing) but also can get edge wickets
            if bounce > 3:
                boundary_multiplier *= 1.05
                if bowler_type == "pace":
                    wicket_multiplier *= 1.05
                    
            # High turn helps spinners
            if bowler_type == "spin" and turn > 3:
                wicket_multiplier *= (1.0 + (turn - 3) * 0.1)
                
            # Dew probability penalizes spinners in the 2nd innings
            if innings == 2 and dew_prob > 0.3 and bowler_type == "spin":
                wicket_multiplier *= (1.0 - dew_prob * 0.3)
                boundary_multiplier *= (1.0 + dew_prob * 0.2)
        
        # Cap multipliers to prevent absurd probabilities
        boundary_multiplier = max(0.5, min(2.5, boundary_multiplier))
        wicket_multiplier = max(0.3, min(3.5, wicket_multiplier))
        
        if "4" in probs: probs["4"] *= boundary_multiplier
        if "6" in probs: probs["6"] *= boundary_multiplier
        if "WICKET" in probs: probs["WICKET"] *= wicket_multiplier
        if "0" in probs: probs["0"] *= wicket_multiplier # Good bowlers bowl more dots
        
        # Normalize back to 1.0
        total = sum(probs.values())
        return {k: v/total for k, v in probs.items()}
