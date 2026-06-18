import json

PLAYERS_FILE = "players_detailed.json"

def main():
    with open(PLAYERS_FILE, "r", encoding="utf-8") as f:
        players = json.load(f)

    changes = []

    for p in players:
        old_role = p.get("role", "BATSMAN")
        b_stats = p.get("battingStats") or {}
        bw_stats = p.get("bowlingStats") or {}

        runs = float(b_stats.get("runs") or 0)
        bat_avg = float(b_stats.get("average") or 0)
        
        wickets = float(bw_stats.get("wickets") or 0)
        overs = float(bw_stats.get("overs") or 0)

        # Skip Wicket Keepers
        if old_role == "WICKET_KEEPER":
            continue

        # Skip players with absolutely zero stats
        if runs == 0 and overs == 0 and wickets == 0:
            continue

        # True Heuristic based purely on lifetime stats
        bat_significant = (runs >= 100) or (bat_avg >= 15.0 and runs >= 50)
        bowl_significant = (wickets >= 5) or (overs >= 10.0)

        if bat_significant and bowl_significant:
            new_role = "ALL_ROUNDER"
        elif bowl_significant:
            new_role = "BOWLER"
        elif bat_significant:
            new_role = "BATSMAN"
        else:
            # Neither is "significant", figure out what they mainly do
            if overs > 0 or wickets > 0:
                if runs > 50:
                    new_role = "BATSMAN"
                else:
                    new_role = "BOWLER"
            else:
                new_role = "BATSMAN"

        if new_role != old_role:
            changes.append(f"{p['name']}: {old_role} -> {new_role} (Runs: {runs}, Wickets: {wickets}, Overs: {overs})")
            p["role"] = new_role

    print(f"Proposed {len(changes)} role changes:")
    for c in changes:
        print(c)

    with open(PLAYERS_FILE, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2)
    print("Done updating roles.")

if __name__ == "__main__":
    main()
