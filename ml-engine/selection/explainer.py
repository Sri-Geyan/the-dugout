class ExplainableAIEngine:
    def explain_selection(self, player_id, name, was_selected, probability, modifier_reasons, optimization_status):
        explanation = {
            "player_id": player_id,
            "name": name,
            "selected": was_selected,
            "selection_probability": round(probability, 3),
            "reasons": []
        }
        
        # Add the context modifiers
        explanation["reasons"].extend(modifier_reasons)
        
        # Add optimization constraint reasons
        if optimization_status == "selected_core":
            explanation["reasons"].append("Core squad selection (High ML Probability)")
        elif optimization_status == "selected_constraint":
            explanation["reasons"].append("Selected to satisfy role/balance constraints")
        elif optimization_status == "dropped_overseas":
            explanation["reasons"].append("Dropped due to maximum 4 overseas player limit")
        elif optimization_status == "dropped_balance":
            explanation["reasons"].append("Dropped to maintain team role balance")
        elif optimization_status == "dropped_form":
            explanation["reasons"].append("Dropped due to low selection probability vs peers")
            
        return explanation
