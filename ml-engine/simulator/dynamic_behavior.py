class DynamicBehaviorEngine:
    def adjust_for_situation(self, probs, current_rr, required_rr, wickets_remaining, phase):
        # Calculate pressure
        pressure = required_rr - current_rr
        
        if phase == 'death':
            # At death, batters attack relentlessly, but also get out more
            if "4" in probs: probs["4"] *= 1.3
            if "6" in probs: probs["6"] *= 1.5
            if "WICKET" in probs: probs["WICKET"] *= 1.4
            if "0" in probs: probs["0"] *= 0.8
            
        elif phase == 'powerplay':
            # Field restrictions: high boundaries, moderate wickets
            if "4" in probs: probs["4"] *= 1.2
            if "6" in probs: probs["6"] *= 1.1
            if "0" in probs: probs["0"] *= 0.9
            
        # React to Required Run Rate (RRR)
        if required_rr > 10.0:
            # Desperation mode
            attack_factor = 1.0 + ((required_rr - 10.0) * 0.1)
            risk_factor = 1.0 + ((required_rr - 10.0) * 0.15)
            
            if "4" in probs: probs["4"] *= attack_factor
            if "6" in probs: probs["6"] *= (attack_factor * 1.2)
            if "WICKET" in probs: probs["WICKET"] *= risk_factor
            
        elif required_rr > 0 and required_rr < 6.0:
            # Coasting mode
            if "WICKET" in probs: probs["WICKET"] *= 0.7
            if "0" in probs: probs["0"] *= 1.2
            if "1" in probs: probs["1"] *= 1.2
            if "6" in probs: probs["6"] *= 0.6
            
        # React to Wickets Remaining
        if wickets_remaining <= 3:
            # Tailenders: high wickets, low boundaries
            if "WICKET" in probs: probs["WICKET"] *= 1.5
            if "4" in probs: probs["4"] *= 0.7
            if "6" in probs: probs["6"] *= 0.5
            
        # Normalize
        total = sum(probs.values())
        return {k: v/total for k, v in probs.items()}
