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
        m.impact_total
    FROM players p
    LEFT JOIN mcp_features m ON p.id = m.player_id
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
    # Formula: Rating boosts value, Scarcity boosts value, Youth boosts value, Form boosts value
    # Max price around 2500 Lakhs (25 Crores)
    # High skill players get massive exponential multiplier
    
    def calculate_target_price(row):
        rating_factor = max(0, row['overall_rating'] - 50)
        
        # Exponential curve for elite ratings
        rating_contrib = rating_factor * (6 + (rating_factor ** 1.26) * 0.38)
            
        age_penalty = max(0, row['age'] - 27) * 5
        youth_bonus = max(0, 24 - row['age']) * 10
        
        form_bonus = row['form'] * 20
        scarcity_bonus = row['scarcity'] * 4.5
        
        # Base calculation
        val = row['base_price'] + rating_contrib + youth_bonus - age_penalty + form_bonus + scarcity_bonus
        
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
            
        final_df = pd.concat(dfs, ignore_index=True)
        
        # Save dataset
        # 3 levels up to reach ml-engine directory
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
        os.makedirs(data_dir, exist_ok=True)
        csv_path = os.path.join(data_dir, "market_value_training_data.csv")
        final_df.to_csv(csv_path, index=False)
        print(f"Saved market value training data (augmented to {len(final_df)} rows) to {csv_path}")

        features = ['overall_rating', 'age', 'scarcity', 'form', 'base_price']
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
        cols = ['overall_rating', 'age', 'scarcity', 'form', 'base_price']
        for c in cols:
            if c not in df.columns:
                df[c] = 0
                
        pred = self.model.predict(df[cols])
        return max(float(pred[0]), features.get('base_price', 20.0))

if __name__ == "__main__":
    mvm = MarketValueModel()
    mvm.train()
