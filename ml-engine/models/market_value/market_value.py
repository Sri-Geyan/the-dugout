import xgboost as xgb
import pandas as pd
import numpy as np
import os
import sqlite3

def generate_market_training_data():
    """
    Generate dataset by pulling real players from players.db
    """
    # 4 levels up to reach project root: market_value -> models -> ml-engine -> the-dugout
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "players.db")
    conn = sqlite3.connect(db_path)
    
    query = """
    SELECT 
        p.id,
        p.name,
        p.role,
        p.basePrice,
        p.dynamicRating,
        p.dynamicBattingRating,
        p.dynamicBowlingRating,
        p.age,
        m.impact_total,
        b.strikeRate as strike_rate
    FROM players p
    LEFT JOIN mcp_features m ON p.id = m.player_id
    LEFT JOIN batting_stats b ON p.id = b.player_id
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    np.random.seed(42)
    
    # Base Price in Lakhs. Check if stored in INR or Cr.
    if (df['basePrice'] > 1000).any():
        df['base_price'] = df['basePrice'] / 100000
    else:
        df['base_price'] = df['basePrice'] * 100
    df['base_price'] = df['base_price'].fillna(20)
    
    df['overall_rating'] = df[['dynamicBattingRating', 'dynamicBowlingRating']].max(axis=1).fillna(50)
    
    df['age'] = df['age'].fillna(26)
    df.loc[df['age'] > 50, 'age'] = 26
    df.loc[df['age'] < 16, 'age'] = 26

    df['strike_rate'] = df['strike_rate'].fillna(135.0)
    
    # Calculate scarcity based on role distribution
    role_counts = df['role'].value_counts()
    total_players = len(df)
    
    def calculate_scarcity(role):
        if pd.isnull(role):
            return 50
        count = role_counts.get(role, 0)
        # Higher scarcity for rarer roles (scale 0-100)
        # e.g., if a role is 30% of players, scarcity is 70
        scarcity = 100 - ((count / total_players) * 100)
        # Boost scarcity slightly for All-rounders specifically
        if "Allrounder" in str(role) or "All-Rounder" in str(role):
            scarcity += 20
        return np.clip(scarcity, 0, 100)
        
    df['scarcity'] = df['role'].apply(calculate_scarcity)
    
    # Form based on impact or random synthesis
    def calculate_form(row):
        form = 0
        if pd.notnull(row['impact_total']) and row['impact_total'] != 0:
            form = (row['impact_total'] * 2) # scale impact to form roughly -10 to +10
        else:
            form = (row['overall_rating'] - 75) / 5 + np.random.normal(0, 2)
        return np.clip(form, -10, 10)
        
    df['form'] = df.apply(calculate_form, axis=1)
    
    # Define Target Variable (Synthetic market value based on heuristics for training)
    def calculate_target_price(row):
        rating_factor = max(0, row['overall_rating'] - 50)
        
        # Exponential curve for elite ratings
        rating_contrib = rating_factor * (6 + (rating_factor ** 1.26) * 0.38)
            
        age = row['age']
        if age <= 28:
            age_penalty = 0
            youth_bonus = max(0, 24 - age) * 12
            age_mult = 1.0
        else:
            age_penalty = (age - 28) * 15
            youth_bonus = 0
            # Multiplicative age penalty
            age_mult = max(0.15, 1.0 - (age - 28) * 0.07)
        
        # Strike rate discount for batting roles
        sr_mult = 1.0
        if row['role'] in ['BATSMAN', 'WICKET_KEEPER', 'ALL_ROUNDER'] or "allrounder" in str(row['role']).lower():
            sr = row['strike_rate']
            if sr < 135.0:
                sr_mult = max(0.60, 0.70 + (sr - 110) * 0.012)
        
        # Experience/Captaincy leadership bonus
        experience_bonus = 0
        if age >= 34 and row['overall_rating'] >= 75:
            experience_bonus = 100 # +1.0 Cr
            
        form_bonus = row['form'] * 20
        scarcity_bonus = row['scarcity'] * 2.0
        
        # Base calculation with multiplicative modifiers
        val = row['base_price'] + (rating_contrib * age_mult * sr_mult) + youth_bonus + experience_bonus - age_penalty + form_bonus + scarcity_bonus
        
        # Cap logic and noise
        val = val * np.random.uniform(0.8, 1.2)
        return np.clip(val, row['base_price'], 2500)
        
    df['target_value'] = df.apply(calculate_target_price, axis=1)
    return df

class MarketValueModel:
    def __init__(self, model_path=None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if model_path is None:
            model_path = os.path.join(base_dir, "xgboost_market_model.json")
        self.model_path = model_path
        self.model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=150, max_depth=8, learning_rate=0.1)
        self.is_trained = False
        
        if os.path.exists(self.model_path):
            self.model.load_model(self.model_path)
            self.is_trained = True

    def train(self):
        """
        Trains model using realistic augmented data from players.db
        """
        self.model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=150, max_depth=8, learning_rate=0.1)
        print("Generating market dataset from players.db...")
        df = generate_market_training_data()
        
        # Augment the data to prevent overfitting on 300 rows
        dfs = [df]
        for _ in range(9):
            noise_df = df.copy()
            noise_df['form'] = np.clip(noise_df['form'] + np.random.normal(0, 1, len(df)), -10, 10)
            noise_df['target_value'] = np.clip(noise_df['target_value'] * np.random.uniform(0.9, 1.1), noise_df['base_price'], 2500)
            dfs.append(noise_df)
            
        # Oversample elite players (overall_rating >= 80) to train the model more strongly on premium valuations
        elite_df = df[df['overall_rating'] >= 80]
        if len(elite_df) > 0:
            for _ in range(30):
                noise_df = elite_df.copy()
                noise_df['form'] = np.clip(noise_df['form'] + np.random.normal(0, 1, len(elite_df)), -10, 10)
                noise_df['target_value'] = np.clip(noise_df['target_value'] * np.random.uniform(0.95, 1.05), noise_df['base_price'], 2500)
                dfs.append(noise_df)
            
        # Generate synthetic grid of players to ensure out-of-distribution generalization
        print("Generating synthetic grid for full feature space coverage...")
        synthetic_rows = []
        for r in range(50, 101, 5):
            for a in range(18, 41, 2):
                for sc in [20, 50, 75]:
                    for bp in [20, 50, 100, 200]:
                        for sr in [110, 125, 135, 150]:
                            for f in [-5, 0, 5]:
                                # Calculate synthetic target value
                                rating_factor = max(0, r - 50)
                                rating_contrib = rating_factor * (6 + (rating_factor ** 1.26) * 0.38)
                                
                                if a <= 28:
                                    age_penalty = 0
                                    youth_bonus = max(0, 24 - a) * 12
                                    age_mult = 1.0
                                else:
                                    age_penalty = (a - 28) * 15
                                    youth_bonus = 0
                                    age_mult = max(0.15, 1.0 - (a - 28) * 0.07)
                                    
                                sr_mult = 1.0
                                if sr < 135.0:
                                    sr_mult = max(0.60, 0.70 + (sr - 110) * 0.012)
                                    
                                exp_bonus = 100 if (a >= 34 and r >= 75) else 0
                                
                                val = bp + (rating_contrib * age_mult * sr_mult) + youth_bonus + exp_bonus - age_penalty + (f * 20) + (sc * 2.0)
                                val = np.clip(val, bp, 2500)
                                
                                synthetic_rows.append({
                                    'id': f'SYN-{r}-{a}-{sc}-{bp}-{sr}-{f}',
                                    'name': 'Synthetic Player',
                                    'role': 'BATSMAN',  # Default to enable strike rate checks
                                    'basePrice': bp / 100.0,
                                    'dynamicRating': r,
                                    'dynamicBattingRating': r,
                                    'dynamicBowlingRating': 50,
                                    'age': a,
                                    'impact_total': 0.0,
                                    'base_price': float(bp),
                                    'overall_rating': r,
                                    'scarcity': float(sc),
                                    'form': float(f),
                                    'strike_rate': float(sr),
                                    'target_value': float(val)
                                })
        
        synth_df = pd.DataFrame(synthetic_rows)
        dfs.append(synth_df)
        
        final_df = pd.concat(dfs, ignore_index=True)
        
        # Save dataset
        # 3 levels up to reach ml-engine directory
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
        os.makedirs(data_dir, exist_ok=True)
        csv_path = os.path.join(data_dir, "market_value_training_data.csv")
        final_df.to_csv(csv_path, index=False)
        print(f"Saved market value training data (augmented to {len(final_df)} rows) to {csv_path}")

        features = ['overall_rating', 'age', 'scarcity', 'form', 'base_price', 'strike_rate']
        X = final_df[features]
        y = final_df['target_value']

        print("Training XGBoost Regressor...")
        self.model.fit(X, y)
        self.model.save_model(self.model_path)
        self.is_trained = True
        print(f"Market XGBoost model trained and saved successfully to {self.model_path}")

    def predict(self, features: dict) -> float:
        """
        Predict expected market value based on features.
        """
        if not self.is_trained:
            self.train()
            
        df = pd.DataFrame([features])
        cols = ['overall_rating', 'age', 'scarcity', 'form', 'base_price', 'strike_rate']
        for c in cols:
            if c not in df.columns:
                if c == 'strike_rate':
                    df[c] = 135.0
                else:
                    df[c] = 0
                
        pred = self.model.predict(df[cols])
        return max(float(pred[0]), features.get('base_price', 20.0))

if __name__ == "__main__":
    mvm = MarketValueModel()
    mvm.train()
