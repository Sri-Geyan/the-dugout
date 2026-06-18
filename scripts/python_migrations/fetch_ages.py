import sqlite3
import requests
import time
from datetime import datetime
import os

# Root DB Path relative to the script directory
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "players.db")

def setup_db(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(players)")
    columns = [info[1] for info in cursor.fetchall()]
    if 'age' not in columns:
        print("Adding 'age' column to players table...", flush=True)
        cursor.execute("ALTER TABLE players ADD COLUMN age INTEGER")
        conn.commit()

def get_age_from_wikidata(player_name, retries=3):
    search_url = "https://www.wikidata.org/w/api.php"
    headers = {"User-Agent": "TheDugoutBot/1.1 (contact@example.com)"}
    
    search_params = {
        "action": "wbsearchentities",
        "search": f"{player_name} cricketer",
        "language": "en",
        "format": "json"
    }
    
    for attempt in range(retries):
        try:
            res = requests.get(search_url, params=search_params, headers=headers, timeout=10)
            if res.status_code == 429:
                print(f"Rate limited on {player_name}. Waiting 10s...", flush=True)
                time.sleep(10)
                continue
            
            search_res = res.json()
            if not search_res.get("search"):
                # Try plain name
                search_params["search"] = player_name
                res2 = requests.get(search_url, params=search_params, headers=headers, timeout=10)
                if res2.status_code == 429:
                    print(f"Rate limited on {player_name} (2). Waiting 10s...", flush=True)
                    time.sleep(10)
                    continue
                search_res = res2.json()
                if not search_res.get("search"):
                    return None
            
            entity_id = search_res["search"][0]["id"]
            
            claims_params = {
                "action": "wbgetclaims",
                "entity": entity_id,
                "property": "P569",
                "format": "json"
            }
            res3 = requests.get(search_url, params=claims_params, headers=headers, timeout=10)
            if res3.status_code == 429:
                print(f"Rate limited on {player_name} (3). Waiting 10s...", flush=True)
                time.sleep(10)
                continue
                
            claims_res = res3.json()
            
            if "claims" in claims_res and "P569" in claims_res["claims"]:
                snak = claims_res["claims"]["P569"][0].get("mainsnak", {})
                if "datavalue" in snak:
                    dob_value = snak["datavalue"]["value"]["time"]
                    if dob_value.startswith("+"):
                        dob_str = dob_value[1:11]
                        if dob_str.endswith("-00-00"):
                            dob_date = datetime(int(dob_str[0:4]), 1, 1)
                        else:
                            dob_date = datetime.strptime(dob_str, "%Y-%m-%d")
                            
                        current_date = datetime(2026, 6, 18)
                        age = current_date.year - dob_date.year - ((current_date.month, current_date.day) < (dob_date.month, dob_date.day))
                        return age
            return None
            
        except ValueError as e: # JSONDecodeError inherits from ValueError
            print(f"JSON Error fetching {player_name}: {e}. Retrying...", flush=True)
            time.sleep(5)
        except Exception as e:
            print(f"Error fetching {player_name}: {e}", flush=True)
            return None
            
    return None

def main():
    print(f"Connecting to DB at {DB_PATH}", flush=True)
    conn = sqlite3.connect(DB_PATH)
    setup_db(conn)
    
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM players WHERE age IS NULL")
    players = cursor.fetchall()
    
    print(f"Found {len(players)} players missing age.", flush=True)
    
    updates = 0
    not_found = 0
    
    for i, (p_id, name) in enumerate(players):
        age = get_age_from_wikidata(name)
        
        if age:
            cursor.execute("UPDATE players SET age = ? WHERE id = ?", (age, p_id))
            updates += 1
            print(f"[{i+1}/{len(players)}] Updated {name}: Age {age}", flush=True)
        else:
            not_found += 1
            print(f"[{i+1}/{len(players)}] Warning: Could not find age for {name}", flush=True)
            
        if (i + 1) % 10 == 0:
            conn.commit()
            
        time.sleep(1) # Increased delay to 1 second
        
    conn.commit()
    conn.close()
    
    print("\n--- Scraping Summary ---", flush=True)
    print(f"Successfully updated: {updates}", flush=True)
    print(f"Could not find: {not_found}", flush=True)
    print("Database updated.", flush=True)

if __name__ == "__main__":
    main()
