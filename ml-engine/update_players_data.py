import duckdb
import json
import re
import os

db_path = "data/cricket_copy.duckdb"
players_ts_path = "../data/players.ts"

def main():
    print("Connecting to duckdb...")
    con = duckdb.connect(db_path)
    
    # 1. Read existing players.ts
    with open(players_ts_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the JSON part from `export const IPL_PLAYERS: CricketPlayer[] = [...]`
    match = re.search(r'export const IPL_PLAYERS:\s*CricketPlayer\[\]\s*=\s*(\[.*?\]);\n', content, re.DOTALL)
    if not match:
        print("Could not find IPL_PLAYERS array in players.ts")
        return
        
    players_json_str = match.group(1)
    
    # Convert JS object keys without quotes to valid JSON if necessary, but actually the existing file has quoted keys already.
    # Let's try parsing it
    # We might need to handle single quotes or trailing commas
    # Actually, it's safer to use a loose JSON parser or regex. The file looks like standard JSON with double quotes.
    try:
        players = json.loads(players_json_str)
    except Exception as e:
        print("Failed to parse JSON directly. Attempting to fix.", e)
        # remove trailing commas
        players_json_str = re.sub(r',\s*}', '}', players_json_str)
        players_json_str = re.sub(r',\s*]', ']', players_json_str)
        players = json.loads(players_json_str)

    print(f"Loaded {len(players)} players from players.ts")

    # 2. Get batting stats for all players
    print("Calculating batting stats...")
    batting_stats = con.execute("""
        WITH match_scores AS (
            SELECT batter, match_id, SUM(runs_batter) as match_runs
            FROM deliveries
            GROUP BY batter, match_id
        ),
        max_scores AS (
            SELECT batter, MAX(match_runs) as highest_score
            FROM match_scores
            GROUP BY batter
        )
        SELECT 
            d.batter,
            COUNT(DISTINCT d.match_id) as matches,
            COUNT(DISTINCT d.match_id || d.innings_number) as innings,
            SUM(d.runs_batter) as runs,
            COUNT(d.runs_batter) as balls_faced,
            SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
            SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
            SUM(CASE WHEN d.wicket_player_out = d.batter THEN 1 ELSE 0 END) as dismissals,
            m.highest_score
        FROM deliveries d
        LEFT JOIN max_scores m ON d.batter = m.batter
        GROUP BY d.batter, m.highest_score
    """).fetchall()
    
    # Create dict mapping batter to stats
    batting_dict = {}
    for row in batting_stats:
        (batter, matches, innings, runs, balls_faced, fours, sixes, dismissals, highest_score) = row
        avg = round(runs / dismissals, 2) if dismissals and dismissals > 0 else runs
        sr = round((runs / balls_faced) * 100, 2) if balls_faced and balls_faced > 0 else 0
        batting_dict[batter.lower()] = {
            "matches": matches,
            "innings": innings,
            "runs": runs,
            "average": float(avg) if avg else 0.0,
            "strikeRate": float(sr) if sr else 0.0,
            "highestScore": highest_score,
            "fours": fours,
            "sixes": sixes
        }

    # 3. Get bowling stats for all players
    print("Calculating bowling stats...")
    bowling_stats = con.execute("""
        WITH match_bowling AS (
            SELECT bowler, match_id, SUM(CASE WHEN is_wicket AND wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field') THEN 1 ELSE 0 END) as match_wickets, SUM(runs_batter + COALESCE(extras_wides, 0) + COALESCE(extras_noballs, 0)) as match_runs
            FROM deliveries
            GROUP BY bowler, match_id
        ),
        best_bowling AS (
            SELECT bowler, MAX(match_wickets) as best_wickets, MIN(match_runs) as best_runs
            FROM match_bowling
            GROUP BY bowler
        )
        SELECT 
            d.bowler,
            COUNT(DISTINCT d.match_id) as matches,
            COUNT(DISTINCT d.match_id || d.innings_number) as innings,
            COUNT(d.bowler) as balls_bowled,
            SUM(d.runs_batter + COALESCE(d.extras_wides, 0) + COALESCE(d.extras_noballs, 0)) as runs_conceded,
            SUM(CASE WHEN d.is_wicket AND d.wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field') THEN 1 ELSE 0 END) as wickets,
            b.best_wickets,
            b.best_runs
        FROM deliveries d
        LEFT JOIN best_bowling b ON d.bowler = b.bowler
        GROUP BY d.bowler, b.best_wickets, b.best_runs
    """).fetchall()

    bowling_dict = {}
    for row in bowling_stats:
        (bowler, matches, innings, balls, runs_conceded, wickets, best_wickets, best_runs) = row
        overs = balls / 6.0
        econ = round(runs_conceded / overs, 2) if overs > 0 else 0.0
        avg = round(runs_conceded / wickets, 2) if wickets and wickets > 0 else 0.0
        bowling_dict[bowler.lower()] = {
            "matches": matches,
            "innings": innings,
            "overs": round(overs, 1),
            "runsConceded": runs_conceded,
            "wickets": wickets,
            "average": float(avg) if avg else 0.0,
            "economy": float(econ) if econ else 0.0,
            "bestBowling": f"{best_wickets}/{best_runs}" if best_wickets else "-"
        }

    # 4. Inject into players
    for p in players:
        name = p['name'].lower()
        if name in batting_dict:
            p['battingStats'] = batting_dict[name]
        if name in bowling_dict:
            p['bowlingStats'] = bowling_dict[name]

    # 5. Write back to players.ts
    print("Writing back to players.ts...")
    
    # Construct the new content
    # We need to maintain the CricketPlayer interface
    interface_str = content.split("export const IPL_PLAYERS")[0]
    
    # Update the interface if it doesn't have battingStats/bowlingStats
    if "battingStats?:" not in interface_str:
        interface_str = interface_str.replace("}", """    battingStats?: {
        matches: number;
        innings: number;
        runs: number;
        average: number;
        strikeRate: number;
        highestScore: number;
        fours: number;
        sixes: number;
    };
    bowlingStats?: {
        matches: number;
        innings: number;
        overs: number;
        runsConceded: number;
        wickets: number;
        average: number;
        economy: number;
        bestBowling: string;
    };
}""")

    new_json = json.dumps(players, indent=4)
    new_content = f"{interface_str}export const IPL_PLAYERS: CricketPlayer[] = {new_json};\n"
    
    with open(players_ts_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Successfully updated players.ts with real-world stats!")

if __name__ == "__main__":
    main()
