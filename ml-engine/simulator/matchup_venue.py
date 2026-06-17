class MatchupVenueEngine:
    def __init__(self):
        self.venue_modifiers = {
            "M Chinnaswamy Stadium": {"4": 1.15, "6": 1.20, "WICKET": 0.90}, # High scoring
            "MA Chidambaram Stadium": {"4": 0.90, "6": 0.85, "WICKET": 1.15}, # Low scoring/Spin friendly
            "Wankhede Stadium": {"4": 1.10, "6": 1.15, "WICKET": 1.05}, # Good batting but pace gets early wickets
            "Eden Gardens": {"4": 1.05, "6": 1.10, "WICKET": 0.95}
        }
        
    def adjust_probabilities(self, probs, venue_name, batter_rating=80, bowler_rating=80):
        # Apply Venue Modifiers
        venue_mod = self.venue_modifiers.get(venue_name, {})
        for outcome, multiplier in venue_mod.items():
            if outcome in probs:
                probs[outcome] *= multiplier
                
        # Apply Matchup Modifiers (Higher rating wins)
        rating_diff = batter_rating - bowler_rating
        
        # If batter is much better, increase boundaries, decrease wickets
        # If bowler is much better, increase wickets, decrease boundaries
        boundary_multiplier = 1.0 + (rating_diff * 0.01) # e.g., +10 diff = 10% more boundaries
        wicket_multiplier = 1.0 - (rating_diff * 0.015) # e.g., +10 diff = 15% fewer wickets
        
        # Cap multipliers to prevent absurd probabilities
        boundary_multiplier = max(0.5, min(2.0, boundary_multiplier))
        wicket_multiplier = max(0.3, min(3.0, wicket_multiplier))
        
        if "4" in probs: probs["4"] *= boundary_multiplier
        if "6" in probs: probs["6"] *= boundary_multiplier
        if "WICKET" in probs: probs["WICKET"] *= wicket_multiplier
        if "0" in probs: probs["0"] *= wicket_multiplier # Good bowlers bowl more dots
        
        # Normalize back to 1.0
        total = sum(probs.values())
        return {k: v/total for k, v in probs.items()}
