import pulp

class LineupOptimizer:
    def optimize(self, players):
        """
        players: List of dicts, each containing:
        - player_id
        - role (BATTER, BOWLER, WICKET_KEEPER, ALL_ROUNDER, PACE_BOWLER, SPIN_BOWLER)
        - is_overseas (bool)
        - modified_prob (float)
        
        Returns: list of selected player_ids and their optimization reasons.
        """
        # Create the LP Problem
        prob = pulp.LpProblem("PlayingXI_Selection", pulp.LpMaximize)
        
        # Variables: binary decision for each player (1 = selected, 0 = not selected)
        player_vars = {}
        for p in players:
            player_vars[p['player_id']] = pulp.LpVariable(f"Select_{p['player_id']}", cat='Binary')
            
        # Objective Function: Maximize the sum of modified probabilities
        prob += pulp.lpSum([p['modified_prob'] * player_vars[p['player_id']] for p in players]), "Total_Selection_Probability"
        
        # --- Constraints ---
        
        # 1. Exactly 11 players
        prob += pulp.lpSum([player_vars[p['player_id']] for p in players]) == 11, "Total_Players"
        
        # 2. Maximum 4 overseas players
        prob += pulp.lpSum([player_vars[p['player_id']] for p in players if p.get('is_overseas', False)]) <= 4, "Max_Overseas"
        
        # 3. At least 1 Wicketkeeper
        prob += pulp.lpSum([player_vars[p['player_id']] for p in players if p['role'] == 'WICKET_KEEPER']) >= 1, "Min_WicketKeeper"
        
        # 4. At least 5 Bowlers (Bowler, Pace, Spin, All Rounder)
        bowler_roles = ['BOWLER', 'PACE_BOWLER', 'SPIN_BOWLER', 'ALL_ROUNDER']
        prob += pulp.lpSum([player_vars[p['player_id']] for p in players if p['role'] in bowler_roles]) >= 5, "Min_Bowlers"
        
        # 5. At least 5 Batters (Batter, WK, All Rounder)
        batter_roles = ['BATTER', 'WICKET_KEEPER', 'ALL_ROUNDER']
        prob += pulp.lpSum([player_vars[p['player_id']] for p in players if p['role'] in batter_roles]) >= 5, "Min_Batters"
        
        # Solve the problem silently
        prob.solve(pulp.PULP_CBC_CMD(msg=0))
        
        # Determine statuses
        selected_ids = []
        statuses = {}
        
        # Identify the "Core 11" if there were no constraints (just the top 11 by prob)
        sorted_by_prob = sorted(players, key=lambda x: x['modified_prob'], reverse=True)
        top_11_ids = [p['player_id'] for p in sorted_by_prob[:11]]
        
        for p in players:
            var_value = player_vars[p['player_id']].varValue
            pid = p['player_id']
            if var_value == 1.0:
                selected_ids.append(pid)
                if pid in top_11_ids:
                    statuses[pid] = "selected_core"
                else:
                    statuses[pid] = "selected_constraint"
            else:
                if pid in top_11_ids:
                    # Why was a top 11 player dropped?
                    if p.get('is_overseas', False):
                        statuses[pid] = "dropped_overseas"
                    else:
                        statuses[pid] = "dropped_balance"
                else:
                    statuses[pid] = "dropped_form"
                    
        return selected_ids, statuses
