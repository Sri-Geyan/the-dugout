import asyncio
import sqlite3
import json
import os
import pandas as pd
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

DB_PATH = "../players.db"

async def process_player(session, p):
    player_id = p["id"]
    player_name = p["name"]
    role = p["role"]
    
    features = {
        "player_id": player_id,
        "form_runs": 0.0,
        "form_sr": 0.0,
        "form_wickets": 0.0,
        "form_econ": 0.0,
        "impact_bat": 0.0,
        "impact_bowl": 0.0,
        "impact_total": 0.0,
        "season_runs": 0.0,
        "season_sr": 0.0,
        "season_wickets": 0.0,
        "season_econ": 0.0,
    }

    # Prepare async calls
    tasks = []

    async def get_batting():
        try:
            form_res = await session.call_tool("get_player_form", {
                "player_name": player_name, "perspective": "batting", "match_type": "T20"
            })
            form_data = json.loads(form_res.content[0].text)
            if "summary" in form_data:
                features["form_runs"] = form_data["summary"].get("runs", 0)
                features["form_sr"] = form_data["summary"].get("strike_rate", 0)

            season_res = await session.call_tool("get_season_stats", {
                "player_name": player_name, "perspective": "batting", 
                "event_name": "Indian Premier League", "date_from": "2024-01-01", "date_to": "2026-12-31"
            })
            season_data = json.loads(season_res.content[0].text)
            if "seasons" in season_data:
                total_runs = sum(s.get("runs", 0) for s in season_data["seasons"])
                total_balls = sum(s.get("balls_faced", 0) for s in season_data["seasons"])
                features["season_runs"] = total_runs
                features["season_sr"] = (total_runs / total_balls * 100) if total_balls > 0 else 0
        except Exception:
            pass

    async def get_bowling():
        try:
            form_res = await session.call_tool("get_player_form", {
                "player_name": player_name, "perspective": "bowling", "match_type": "T20"
            })
            form_data = json.loads(form_res.content[0].text)
            if "summary" in form_data:
                features["form_wickets"] = form_data["summary"].get("wickets", 0)
                features["form_econ"] = form_data["summary"].get("economy", 0)

            season_res = await session.call_tool("get_season_stats", {
                "player_name": player_name, "perspective": "bowling", 
                "event_name": "Indian Premier League", "date_from": "2024-01-01", "date_to": "2026-12-31"
            })
            season_data = json.loads(season_res.content[0].text)
            if "seasons" in season_data:
                total_wickets = sum(s.get("wickets", 0) for s in season_data["seasons"])
                econs = [s.get("economy", 0) for s in season_data["seasons"] if s.get("economy")]
                features["season_wickets"] = total_wickets
                features["season_econ"] = sum(econs)/len(econs) if econs else 0
        except Exception:
            pass

    async def get_impact():
        try:
            impact_res = await session.call_tool("get_career_impact", {
                "player_name": player_name, 
                "event_name": "Indian Premier League", 
                "date_from": "2024-01-01", "date_to": "2026-12-31"
            })
            impact_data = json.loads(impact_res.content[0].text)
            if "career_summary" in impact_data:
                c_impact = impact_data["career_summary"]
                features["impact_total"] = c_impact.get("total_impact", 0)
                features["impact_bat"] = c_impact.get("avg_batting_impact", 0)
                features["impact_bowl"] = c_impact.get("avg_bowling_impact", 0)
        except Exception:
            pass

    if role in ["BATSMAN", "WICKET_KEEPER", "ALL_ROUNDER"]:
        tasks.append(get_batting())
    if role in ["BOWLER", "ALL_ROUNDER"]:
        tasks.append(get_bowling())
    tasks.append(get_impact())

    await asyncio.gather(*tasks)
    return features


async def extract_features():
    print("Loading players from DB...", flush=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, role FROM players")
    
    players = []
    for row in cursor.fetchall():
        players.append({"id": row[0], "name": row[1], "role": row[2]})

    # Ensure table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mcp_features (
            player_id TEXT PRIMARY KEY,
            form_runs REAL,
            form_sr REAL,
            form_wickets REAL,
            form_econ REAL,
            impact_bat REAL,
            impact_bowl REAL,
            impact_total REAL,
            season_runs REAL,
            season_sr REAL,
            season_wickets REAL,
            season_econ REAL,
            FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
        )
    """)
    conn.commit()

    # Using npx.cmd for Windows
    server_params = StdioServerParameters(
        command="npx.cmd",
        args=["tsx", "src/index.ts", "serve"],
        env=os.environ.copy()
    )

    print("Connecting to MCP server...", flush=True)
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("Session initialized.", flush=True)

            batch_size = 20
            for i in range(0, len(players), batch_size):
                batch = players[i:i+batch_size]
                print(f"Processing batch {i//batch_size + 1}/{(len(players)+batch_size-1)//batch_size}...", flush=True)
                
                batch_tasks = [process_player(session, p) for p in batch]
                results = await asyncio.gather(*batch_tasks)
                
                # Write to DB immediately
                for r in results:
                    cursor.execute("""
                        INSERT OR REPLACE INTO mcp_features
                        (player_id, form_runs, form_sr, form_wickets, form_econ, 
                         impact_bat, impact_bowl, impact_total, season_runs, season_sr, 
                         season_wickets, season_econ)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["player_id"], r["form_runs"], r["form_sr"], r["form_wickets"], r["form_econ"],
                        r["impact_bat"], r["impact_bowl"], r["impact_total"], r["season_runs"], r["season_sr"],
                        r["season_wickets"], r["season_econ"]
                    ))
                conn.commit()

    conn.close()
    print(f"Features generated and saved to {DB_PATH}", flush=True)

if __name__ == "__main__":
    asyncio.run(extract_features())
