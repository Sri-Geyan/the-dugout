import random
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from models.ball_outcome_model import BallOutcomeModel
from models.wicket_engine import WicketEngine
from simulator.matchup_venue import MatchupVenueEngine
from simulator.dynamic_behavior import DynamicBehaviorEngine
from simulator.commentary import CommentaryEngine

class MatchOrchestrator:
    def __init__(self):
        print("Loading ML Models for Simulation...")
        self.ball_model = BallOutcomeModel()
        self.ball_model.load()
        
        self.wicket_engine = WicketEngine()
        self.venue_engine = MatchupVenueEngine()
        self.behavior_engine = DynamicBehaviorEngine()
        self.commentary_engine = CommentaryEngine()

    def _determine_phase(self, over):
        if over < 6: return 'powerplay'
        elif over < 16: return 'middle'
        else: return 'death'

    def simulate_ball(self, state):
        """
        state dict contains:
        - innings (int)
        - over (int)
        - ball (int)
        - current_score (int)
        - wickets (int)
        - target (int, can be None for 1st innings)
        - venue (str)
        - batter_rating (int)
        - bowler_rating (int)
        """
        innings = state.get('innings', 1)
        over = state.get('over', 0)
        ball = state.get('ball', 1)
        score = state.get('current_score', 0)
        wickets = state.get('wickets', 0)
        target = state.get('target', 0)
        
        total_balls = (over * 6) + (ball - 1)
        current_rr = (score / total_balls * 6) if total_balls > 0 else 0
        
        balls_remaining = 120 - total_balls
        required_rr = 0
        if innings == 2 and target > 0 and balls_remaining > 0:
            runs_needed = target - score
            required_rr = (runs_needed / balls_remaining) * 6
            
        phase = self._determine_phase(over)
        
        # Prepare features for ML Model
        features = {
            'innings': innings,
            'over': over,
            'ball': ball,
            'current_rr': current_rr,
            'required_rr': required_rr,
            'target': target,
            'wickets_remaining': 10 - wickets,
            'phase_cat': phase
        }
        
        # Base Probabilities from ML Model
        probs = self.ball_model.predict_probs(features)
        
        # Apply heuristics (Venue, Matchups, Game Situation)
        probs = self.venue_engine.adjust_probabilities(
            probs, 
            state.get('venue', 'Neutral'),
            state.get('batter_rating', 80),
            state.get('bowler_rating', 80)
        )
        
        probs = self.behavior_engine.adjust_for_situation(
            probs,
            current_rr,
            required_rr,
            10 - wickets,
            phase
        )
        
        # Sample Outcome
        outcomes = list(probs.keys())
        probabilities = list(probs.values())
        outcome = random.choices(outcomes, weights=probabilities, k=1)[0]
        
        # Handle Wickets
        dismissal_type = None
        if outcome == "WICKET":
            # Very simplistic pace vs spin fallback for demo
            bowler_type = "spin" if state.get('bowler_rating', 80) % 2 == 0 else "pace"
            dismissal_type = self.wicket_engine.generate_dismissal(bowler_type, phase)
            
        # Generate Commentary
        commentary = self.commentary_engine.generate(outcome, dismissal_type)
        
        return {
            "over": over,
            "ball": ball,
            "outcome": outcome,
            "dismissal": dismissal_type,
            "commentary": commentary,
            "raw_probabilities": {k: round(v, 4) for k, v in probs.items()}
        }

    def simulate_innings(self, venue, target=0):
        innings = 1 if target == 0 else 2
        score = 0
        wickets = 0
        ball_by_ball = []
        
        for over in range(20):
            for ball in range(1, 7):
                state = {
                    'innings': innings,
                    'over': over,
                    'ball': ball,
                    'current_score': score,
                    'wickets': wickets,
                    'target': target,
                    'venue': venue,
                    'batter_rating': random.randint(70, 95),
                    'bowler_rating': random.randint(70, 95)
                }
                
                result = self.simulate_ball(state)
                ball_by_ball.append(result)
                
                if result['outcome'] == 'WICKET':
                    wickets += 1
                elif result['outcome'] not in ['EXTRA']:
                    score += int(result['outcome'])
                    
                if wickets >= 10:
                    break
                if innings == 2 and score >= target:
                    break
            if wickets >= 10 or (innings == 2 and score >= target):
                break
                
        return {
            "total_score": score,
            "wickets": wickets,
            "overs": f"{over}.{ball}",
            "balls": ball_by_ball
        }
        
    def simulate_match(self, venue="M Chinnaswamy Stadium"):
        # Innings 1
        print("Simulating Innings 1...")
        inn1 = self.simulate_innings(venue)
        
        # Innings 2
        target = inn1['total_score'] + 1
        print(f"Simulating Innings 2. Target: {target}")
        inn2 = self.simulate_innings(venue, target)
        
        winner = "Team 2" if inn2['total_score'] >= target else "Team 1"
        
        return {
            "venue": venue,
            "innings_1": f"{inn1['total_score']}/{inn1['wickets']} ({inn1['overs']} ov)",
            "innings_2": f"{inn2['total_score']}/{inn2['wickets']} ({inn2['overs']} ov)",
            "winner": winner
        }

if __name__ == "__main__":
    orchestrator = MatchOrchestrator()
    match_result = orchestrator.simulate_match()
    print("\nMatch Result:")
    print(match_result)
