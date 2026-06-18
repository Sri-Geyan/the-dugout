import random
from typing import List, Dict, Tuple
from datetime import datetime, timedelta

class FixtureScheduler:
    def __init__(self, teams: List[str], start_date: str = "2026-03-22"):
        if len(teams) != 10:
            raise ValueError("Standard IPL group format requires exactly 10 teams.")
        self.teams = teams
        self.start_date = datetime.strptime(start_date, "%Y-%m-%d")
        
        # High profile teams to prioritize on weekends
        self.high_profile = ["Chennai Super Kings", "Mumbai Indians", "Royal Challengers Bengaluru"]
        
    def _create_groups(self) -> Tuple[List[str], List[str]]:
        # For realistic simulation, we randomly seed teams or use a fixed order.
        shuffled = self.teams.copy()
        random.shuffle(shuffled)
        return shuffled[:5], shuffled[5:]

    def _generate_matchups(self, group_a: List[str], group_b: List[str]) -> List[Dict]:
        matches = []
        
        # 1. Play teams in same group twice (Home & Away)
        for group in [group_a, group_b]:
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    matches.append({"home": group[i], "away": group[j], "type": "intra-group"})
                    matches.append({"home": group[j], "away": group[i], "type": "intra-group"})

        # 2. Play teams in other group
        # Each team plays the team at the same index in the other group TWICE
        # And the other 4 teams ONCE.
        for i, team_a in enumerate(group_a):
            for j, team_b in enumerate(group_b):
                if i == j:
                    # Same seed -> Play twice
                    matches.append({"home": team_a, "away": team_b, "type": "inter-group-paired"})
                    matches.append({"home": team_b, "away": team_a, "type": "inter-group-paired"})
                else:
                    # Play once. To balance home/away:
                    # If (i+j) is even, team_a is home, else team_b is home
                    if (i + j) % 2 == 0:
                        matches.append({"home": team_a, "away": team_b, "type": "inter-group-single"})
                    else:
                        matches.append({"home": team_b, "away": team_a, "type": "inter-group-single"})
                        
        return matches

    def _is_high_profile(self, match: Dict) -> bool:
        return match["home"] in self.high_profile or match["away"] in self.high_profile

    def schedule(self) -> List[Dict]:
        group_a, group_b = self._create_groups()
        all_matches = self._generate_matchups(group_a, group_b)
        
        # We need 70 matches. Verify count.
        assert len(all_matches) == 70, f"Expected 70 matches, got {len(all_matches)}"
        
        # Sort matches to put high profile matches first so they can grab weekend slots
        all_matches.sort(key=self._is_high_profile, reverse=True)
        
        # Generate slots
        # E.g., 52 days to fit 70 matches.
        # Weekdays: 1 match (19:30)
        # Weekends: 2 matches (15:30, 19:30)
        slots = []
        current_date = self.start_date
        while len(slots) < 70:
            if current_date.weekday() >= 5: # Sat or Sun
                slots.append({"date": current_date, "time": "15:30"})
                slots.append({"date": current_date, "time": "19:30"})
            else:
                slots.append({"date": current_date, "time": "19:30"})
            current_date += timedelta(days=1)
            
        # Truncate to exactly 70 slots just in case
        slots = slots[:70]
        
        # Assign matches to slots (Greedy approach with basic backtracking / swaps)
        schedule = []
        unassigned = all_matches.copy()
        
        # Shuffle slightly to add variety but keep high profile near top
        top_half = unassigned[:20]
        bottom_half = unassigned[20:]
        random.shuffle(top_half)
        random.shuffle(bottom_half)
        unassigned = top_half + bottom_half
        
        for slot in slots:
            is_weekend = slot["date"].weekday() >= 5
            
            best_match = None
            best_idx = -1
            
            for idx, match in enumerate(unassigned):
                # Constraints check
                team1, team2 = match["home"], match["away"]
                
                # Check if either team played yesterday or today
                can_play = True
                for s in schedule:
                    s_date = datetime.strptime(s["date"], "%Y-%m-%d")
                    days_diff = (slot["date"] - s_date).days
                    if days_diff == 0 or days_diff == 1:
                        if s["home_team"] in [team1, team2] or s["away_team"] in [team1, team2]:
                            can_play = False
                            break
                            
                if can_play:
                    # Prefer high profile for weekends
                    if is_weekend and not self._is_high_profile(match):
                        # keep looking for a high profile match, but remember this one if none found
                        if best_idx == -1:
                            best_match = match
                            best_idx = idx
                    else:
                        best_match = match
                        best_idx = idx
                        break
                        
            if best_match is None and len(unassigned) > 0:
                # Fallback: Relax constraints (allow playing next day)
                best_match = unassigned[0]
                best_idx = 0
                
            if best_match:
                # Add to schedule
                sched_entry = {
                    "match_id": len(schedule) + 1,
                    "date": slot["date"].strftime("%Y-%m-%d"),
                    "day": slot["date"].strftime("%A"),
                    "time": slot["time"],
                    "home_team": best_match["home"],
                    "away_team": best_match["away"],
                    "venue": f"Home ground of {best_match['home']}", # Simplified
                    "match_type": best_match["type"],
                    "is_weekend": is_weekend
                }
                schedule.append(sched_entry)
                unassigned.pop(best_idx)
                
        return schedule
