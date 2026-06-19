import sqlite3
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import numpy as np

DB_PATH = "../players.db"

def main():
    print("Connecting to database...")
    conn = sqlite3.connect(DB_PATH)
    
    # Load all data combined
    query = """
    SELECT 
        p.id, p.role,
        b.runs as lifetime_runs,
        b.average as lifetime_bat_avg,
        b.strikeRate as lifetime_bat_sr,
        bw.wickets as lifetime_wickets,
        bw.economy as lifetime_bowl_econ,
        bw.average as lifetime_bowl_avg,
        m.form_runs, m.form_sr, m.form_wickets, m.form_econ,
        m.impact_bat, m.impact_bowl, m.impact_total,
        m.season_runs, m.season_sr, m.season_wickets, m.season_econ
    FROM players p
    LEFT JOIN batting_stats b ON p.id = b.player_id
    LEFT JOIN bowling_stats bw ON p.id = bw.player_id
    LEFT JOIN mcp_features m ON p.id = m.player_id
    """
    df = pd.read_sql_query(query, conn)

    # Impute missing values with 0
    df.fillna(0, inplace=True)

    # Invert economies and averages: lower is better. 
    def invert_metric(series, max_val):
        inverted = np.maximum(0, max_val - series)
        inverted[series == 0] = 0
        return inverted

    df['inv_form_econ'] = invert_metric(df['form_econ'], 15.0)
    df['inv_season_econ'] = invert_metric(df['season_econ'], 15.0)
    df['inv_lifetime_bowl_econ'] = invert_metric(df['lifetime_bowl_econ'], 15.0)
    df['inv_lifetime_bowl_avg'] = invert_metric(df['lifetime_bowl_avg'], 60.0)

    scaler = MinMaxScaler()

    # Batting features
    bat_features = [
        'form_runs', 'form_sr', 'season_runs', 'season_sr', 'impact_bat', 'impact_total',
        'lifetime_runs', 'lifetime_bat_avg', 'lifetime_bat_sr'
    ]
    if len(df) > 0:
        df[bat_features] = scaler.fit_transform(df[bat_features])

    # Bowling features
    bowl_features = [
        'form_wickets', 'inv_form_econ', 'season_wickets', 'inv_season_econ', 'impact_bowl', 'impact_total',
        'lifetime_wickets', 'inv_lifetime_bowl_econ', 'inv_lifetime_bowl_avg'
    ]
    if len(df) > 0:
        df[bowl_features] = scaler.fit_transform(df[bowl_features])

    # Calculate MCP and Lifetime components separately
    df['mcp_bat_score'] = (
        0.1 * df['form_runs'] + 
        0.05 * df['form_sr'] + 
        0.15 * df['season_runs'] + 
        0.05 * df['season_sr'] + 
        0.1 * df['impact_bat'] + 
        0.05 * df['impact_total']
    )
    df['life_bat_score'] = (
        0.25 * df['lifetime_runs'] +
        0.15 * df['lifetime_bat_avg'] +
        0.1 * df['lifetime_bat_sr']
    )

    df['mcp_bowl_score'] = (
        0.1 * df['form_wickets'] + 
        0.05 * df['inv_form_econ'] + 
        0.15 * df['season_wickets'] + 
        0.05 * df['inv_season_econ'] + 
        0.1 * df['impact_bowl'] + 
        0.05 * df['impact_total']
    )
    df['life_bowl_score'] = (
        0.25 * df['lifetime_wickets'] +
        0.15 * df['inv_lifetime_bowl_avg'] +
        0.1 * df['inv_lifetime_bowl_econ']
    )

    # Determine if player has MCP stats using the raw (unscaled) df
    # We can just reload raw df since we modified it in place
    df_raw = pd.read_sql_query(query, conn).fillna(0)
    df['has_mcp_bat'] = (df_raw['season_runs'] > 0) | (df_raw['form_runs'] > 0) | (df_raw['impact_bat'] > 0)
    df['has_mcp_bowl'] = (df_raw['season_wickets'] > 0) | (df_raw['form_wickets'] > 0) | (df_raw['impact_bowl'] > 0)

    df['has_bat_stats'] = df['has_mcp_bat'] | (df_raw['lifetime_runs'] > 0)
    df['has_bowl_stats'] = df['has_mcp_bowl'] | (df_raw['lifetime_wickets'] > 0)

    # Normalize missing MCP data by doubling the lifetime score
    df['raw_bat_score'] = np.where(df['has_mcp_bat'], df['mcp_bat_score'] + df['life_bat_score'], df['life_bat_score'] * 2.0)
    df['raw_bowl_score'] = np.where(df['has_mcp_bowl'], df['mcp_bowl_score'] + df['life_bowl_score'], df['life_bowl_score'] * 2.0)

    # Apply strike rate discount for players with substantial runs (>500) if strike rate is low (<135)
    raw_runs = df_raw['lifetime_runs']
    raw_sr = df_raw['lifetime_bat_sr']
    sr_mult = np.where(
        raw_runs > 500,
        np.where(raw_sr < 115, 0.70, np.minimum(1.0, 0.70 + (raw_sr - 115) * (0.30 / 20.0))),
        1.0
    )
    df['raw_bat_score'] = df['raw_bat_score'] * sr_mult

    # Scale scores from 50 to 100
    final_scaler_bat = MinMaxScaler(feature_range=(50, 100))
    final_scaler_bowl = MinMaxScaler(feature_range=(50, 100))

    batters_with_stats = df[df['has_bat_stats']]
    if len(batters_with_stats) > 0:
        final_scaler_bat.fit(batters_with_stats[['raw_bat_score']])
        df['batting_rating'] = final_scaler_bat.transform(df[['raw_bat_score']])
    else:
        df['batting_rating'] = 50.0

    bowlers_with_stats = df[df['has_bowl_stats']]
    if len(bowlers_with_stats) > 0:
        final_scaler_bowl.fit(bowlers_with_stats[['raw_bowl_score']])
        df['bowling_rating'] = final_scaler_bowl.transform(df[['raw_bowl_score']])
    else:
        df['bowling_rating'] = 50.0

    # Apply baseline to players without ANY stats
    df.loc[~df['has_bat_stats'], 'batting_rating'] = 50.0
    df.loc[~df['has_bowl_stats'], 'bowling_rating'] = 50.0

    # Round to integer
    df['batting_rating'] = df['batting_rating'].round().astype(int)
    df['bowling_rating'] = df['bowling_rating'].round().astype(int)

    # Update database
    cursor = conn.cursor()
    for _, row in df.iterrows():
        p_id = row['id']
        role = row['role']
        bat_r = int(row['batting_rating'])
        bowl_r = int(row['bowling_rating'])

        # Always assign both individual ratings for all roles
        dyn_r = None
        dyn_bat_r = bat_r
        dyn_bowl_r = bowl_r

        cursor.execute("""
            UPDATE players 
            SET dynamicRating = ?, dynamicBattingRating = ?, dynamicBowlingRating = ?
            WHERE id = ?
        """, (dyn_r, dyn_bat_r, dyn_bowl_r, p_id))

    conn.commit()
    conn.close()
    print("Successfully updated players.db with ML generated ratings.")

if __name__ == "__main__":
    main()
