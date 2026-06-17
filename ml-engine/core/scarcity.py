class ScarcityEngine:
    def __init__(self, initial_pool: list):
        self.available_players = initial_pool
        self.total_initial = len(initial_pool)
        
    def get_scarcity_score(self, role: str) -> float:
        """
        Returns a 0-100 score representing how scarce a role is.
        95+ means very scarce.
        """
        role_players = [p for p in self.available_players if p.get("role") == role]
        
        if not role_players:
            return 100.0
            
        remaining = len(role_players)
        
        # Simple heuristic: if fewer than 3 elite players left, high scarcity
        elite_players = [p for p in role_players if p.get("overall_rating", 0) > 85]
        
        if len(elite_players) == 0:
            return 100.0
        elif len(elite_players) <= 2:
            return 95.0
        else:
            # Scale from 0 to 90 based on raw count
            return max(0.0, 90.0 - (remaining * 2))

    def remove_player(self, player_id: str):
        self.available_players = [p for p in self.available_players if p.get("player_id") != player_id]
