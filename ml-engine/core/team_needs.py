def generate_team_needs(squad: list) -> dict:
    """
    Analyzes a current squad and outputs a need vector.
    """
    needs = {
        "batters_needed": 0,
        "finishers_needed": 0,
        "spinners_needed": 0,
        "death_bowlers_needed": 0,
        "wicketkeepers_needed": 0,
        "overseas_slots_remaining": 8,
        "captain_needed": True
    }
    
    overseas_count = 0
    wk_count = 0
    
    for player in squad:
        if player.get("is_overseas"):
            overseas_count += 1
        if player.get("role") == "Wicketkeeper":
            wk_count += 1
        if player.get("is_captain"):
            needs["captain_needed"] = False
            
    needs["overseas_slots_remaining"] = max(0, 8 - overseas_count)
    needs["wicketkeepers_needed"] = max(0, 2 - wk_count) # Aim for 2 WKs
    
    # Simple calculation for other roles based on ideal composition (e.g. 6 pure batters, 4 spinners, etc.)
    # This can be expanded based on game rules
    
    return needs
