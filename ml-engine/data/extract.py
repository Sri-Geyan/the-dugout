import duckdb
import pandas as pd
import numpy as np

print("Connecting to DuckDB...")
con = duckdb.connect('data/cricket_copy.duckdb')

print("Extracting 50,000 T20 deliveries...")
query = """
SELECT 
    d.match_id,
    d.innings_number as innings,
    d.over_number as over,
    d.ball_number as ball,
    m.team1,
    m.team2,
    d.batter as striker,
    d.non_striker,
    d.bowler,
    m.venue,
    d.runs_batter as runs_scored,
    d.is_wicket as wicket,
    d.wicket_kind as dismissal_type,
    (d.extras_wides + d.extras_noballs + d.extras_byes + d.extras_legbyes + d.extras_penalty) as extras
FROM deliveries d
JOIN matches m ON d.match_id = m.match_id
WHERE m.match_type IN ('T20', 'IT20')
LIMIT 50000
"""

df = con.execute(query).df()

print("Engineering features...")
# Phase
df['phase'] = np.where(df['over'] < 6, 'powerplay', np.where(df['over'] < 16, 'middle', 'death'))

# Simplistic RR and targets just for mock data
df['current_rr'] = np.random.uniform(6.0, 10.0, size=len(df))
df['required_rr'] = np.random.uniform(7.0, 12.0, size=len(df))
df['target'] = np.random.randint(150, 220, size=len(df))
df['wickets_remaining'] = np.random.randint(1, 10, size=len(df))

# Map outcome
def get_outcome(row):
    if row['wicket']:
        return 'WICKET'
    elif row['extras'] > 0:
        return 'EXTRA'
    else:
        return str(row['runs_scored'])

df['ball_outcome'] = df.apply(get_outcome, axis=1)

print("Saving to CSV...")
df.to_csv('data/training_data.csv', index=False)
print("Done! Extracted and saved to data/training_data.csv")
