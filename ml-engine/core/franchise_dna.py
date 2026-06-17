FRANCHISE_DNA = {
    "CSK": {
        "experience_bias": 1.30,
        "indian_player_bias": 1.20,
        "spinner_bias": 1.20,
        "captaincy_value": 1.15
    },
    "MI": {
        "youth_potential": 1.30,
        "fast_bowler_bias": 1.20,
        "long_term_investment": 1.20
    },
    "RCB": {
        "star_player_bias": 1.25,
        "batting_bias": 1.20
    },
    "KKR": {
        "power_hitter_bias": 1.20,
        "mystery_spinner_bias": 1.25
    },
    "RR": {
        "value_hunter_bias": 1.30,
        "young_talent_bias": 1.20
    },
    "SRH": {
        "aggressive_t20_bias": 1.25,
        "overseas_bias": 1.15
    }
}

def apply_franchise_dna(team_id: str, player_features: dict, base_value: float) -> float:
    """
    Adjusts a player's perceived value based on franchise DNA biases.
    """
    dna = FRANCHISE_DNA.get(team_id, {})
    multiplier = 1.0
    
    # Example bias applications
    if "CSK" == team_id:
        if player_features.get("age", 0) > 30:
            multiplier *= dna.get("experience_bias", 1.0)
        if player_features.get("role") == "Spinner":
            multiplier *= dna.get("spinner_bias", 1.0)
            
    elif "MI" == team_id:
        if player_features.get("age", 0) < 24:
            multiplier *= dna.get("youth_potential", 1.0)
        if player_features.get("role") == "Pacer":
            multiplier *= dna.get("fast_bowler_bias", 1.0)
            
    elif "RCB" == team_id:
        if player_features.get("role") in ["Batter", "All-Rounder"]:
            multiplier *= dna.get("batting_bias", 1.0)
            
    # Add other team logic here
    
    return base_value * multiplier
