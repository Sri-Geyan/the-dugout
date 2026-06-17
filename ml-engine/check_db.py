import duckdb
con = duckdb.connect('data/cricket_copy.duckdb')
res = con.execute("SELECT DISTINCT match_type FROM matches").fetchall()
print("Match Types:", res)

res = con.execute("SELECT COUNT(*) FROM deliveries d JOIN matches m ON d.match_id = m.match_id WHERE m.match_type IN ('T20', 'T20I')").fetchone()
print("T20 Deliveries count:", res)
