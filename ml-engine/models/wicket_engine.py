import random

class WicketEngine:
    def __init__(self):
        # Base probabilities for T20 cricket
        self.base_distributions = {
            'caught': 0.65,
            'bowled': 0.15,
            'lbw': 0.08,
            'run out': 0.08,
            'stumped': 0.03,
            'hit wicket': 0.01
        }
        
    def generate_dismissal(self, bowler_type="pace", phase="middle"):
        dist = self.base_distributions.copy()
        
        # Adjust based on bowler type and phase
        if bowler_type == "spin":
            dist['stumped'] += 0.05
            dist['lbw'] += 0.02
            dist['caught'] -= 0.07
            
        if phase == "death":
            dist['run out'] += 0.05
            dist['bowled'] += 0.05
            dist['caught'] -= 0.10
            
        # Normalize
        total = sum(dist.values())
        for k in dist:
            dist[k] /= total
            
        outcomes = list(dist.keys())
        probs = list(dist.values())
        
        return random.choices(outcomes, weights=probs, k=1)[0]
