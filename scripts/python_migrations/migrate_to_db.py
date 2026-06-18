import sqlite3
import json
import pandas as pd
import os

DB_PATH = "players.db"
JSON_PATH = "players_detailed.json"
CSV_PATH = "cricket-mcp/data/features.csv"

def init_db(conn):
    cursor = conn.cursor()
    
    # Players Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name TEXT,
            role TEXT,
            battingStyle TEXT,
            bowlingStyle TEXT,
            nationality TEXT,
            basePrice REAL,
            dynamicRating INTEGER,
            dynamicBattingRating INTEGER,
            dynamicBowlingRating INTEGER
        )
    """)

    # Batting Stats Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS batting_stats (
            player_id TEXT PRIMARY KEY,
            matches INTEGER,
            innings INTEGER,
            runs INTEGER,
            average REAL,
            strikeRate REAL,
            highestScore INTEGER,
            fours INTEGER,
            sixes INTEGER,
            centuries INTEGER,
            fifties INTEGER,
            ducks INTEGER,
            FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
        )
    """)

    # Bowling Stats Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bowling_stats (
            player_id TEXT PRIMARY KEY,
            matches INTEGER,
            innings INTEGER,
            wickets INTEGER,
            economy REAL,
            average REAL,
            bestWickets TEXT,
            overs REAL,
            FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
        )
    """)

    # MCP Features Table
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

def migrate_json(conn):
    if not os.path.exists(JSON_PATH):
        print(f"File {JSON_PATH} not found.")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        players = json.load(f)

    cursor = conn.cursor()
    for p in players:
        # Insert Player
        cursor.execute("""
            INSERT OR REPLACE INTO players 
            (id, name, role, battingStyle, bowlingStyle, nationality, basePrice, dynamicRating, dynamicBattingRating, dynamicBowlingRating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            p.get("id"),
            p.get("name"),
            p.get("role"),
            p.get("battingStyle"),
            p.get("bowlingStyle"),
            p.get("nationality"),
            p.get("basePrice"),
            p.get("dynamicRating"),
            p.get("dynamicBattingRating"),
            p.get("dynamicBowlingRating")
        ))

        # Insert Batting Stats
        b_stats = p.get("battingStats")
        if b_stats:
            cursor.execute("""
                INSERT OR REPLACE INTO batting_stats
                (player_id, matches, innings, runs, average, strikeRate, highestScore, fours, sixes, centuries, fifties, ducks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id"],
                b_stats.get("matches"),
                b_stats.get("innings"),
                b_stats.get("runs"),
                b_stats.get("average"),
                b_stats.get("strikeRate"),
                b_stats.get("highestScore"),
                b_stats.get("fours"),
                b_stats.get("sixes"),
                b_stats.get("centuries"),
                b_stats.get("fifties"),
                b_stats.get("ducks")
            ))

        # Insert Bowling Stats
        bw_stats = p.get("bowlingStats")
        if bw_stats:
            cursor.execute("""
                INSERT OR REPLACE INTO bowling_stats
                (player_id, matches, innings, wickets, economy, average, bestWickets, overs)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                p["id"],
                bw_stats.get("matches"),
                bw_stats.get("innings"),
                bw_stats.get("wickets"),
                bw_stats.get("economy"),
                bw_stats.get("average"),
                bw_stats.get("bestWickets"),
                bw_stats.get("overs")
            ))
    conn.commit()
    print("Migrated JSON data.")

def migrate_csv(conn):
    if not os.path.exists(CSV_PATH):
        print(f"File {CSV_PATH} not found.")
        return

    df = pd.read_csv(CSV_PATH)
    # Rename 'id' to 'player_id' for the database
    df.rename(columns={'id': 'player_id'}, inplace=True)
    
    # We only want the feature columns
    cols_to_keep = [
        'player_id', 'form_runs', 'form_sr', 'form_wickets', 'form_econ',
        'impact_bat', 'impact_bowl', 'impact_total', 'season_runs', 'season_sr',
        'season_wickets', 'season_econ'
    ]
    df = df[[c for c in cols_to_keep if c in df.columns]]
    
    df.to_sql("mcp_features", conn, if_exists="append", index=False)
    print("Migrated CSV data.")

def main():
    # Ensure fresh DB
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    migrate_json(conn)
    migrate_csv(conn)
    conn.close()
    print(f"Database successfully created at {DB_PATH}")

if __name__ == "__main__":
    main()
