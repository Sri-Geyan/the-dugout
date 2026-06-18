import pandas as pd
import numpy as np
import xgboost as xgb
import os
import sqlite3

def generate_db_seeded_data(num_samples=3000):
    # 4 levels up to reach project root: retention -> models -> ml-engine -> the-dugout
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "players.db")
    conn = sqlite3.connect(db_path)
    
    query = """
    SELECT 
        p.id,
        p.name,
        p.nationality,
        p.dynamicRating,
        p.age,
        m.impact_total
    FROM players p
    LEFT JOIN mcp_features m ON p.id = m.player_id
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    np.random.seed(42)
    
    df['overall_rating'] = df['dynamicRating'].fillna(50)
    df['age'] = df['age'].fillna(26)
    
    # Process is_overseas
    def check_overseas(nat):
        if not nat: return 0
        return 0 if 'india' in nat.lower() else 1
    df['is_overseas'] = df['nationality'].apply(check_overseas)
    
    # Process is_uncapped (based on age or impact)
    def check_uncapped(age):
        if age <= 23: return 1
        return 0
    df['is_uncapped'] = df['age'].apply(check_uncapped)
    
    # Form score based on impact_total
    def calc_form(impact, rating):
        if pd.notnull(impact) and impact != 0:
            return min(100, max(0, 50 + (impact * 5)))
        return min(100, max(0, rating - 20 + np.random.normal(0, 15)))
    df['form_score'] = df.apply(lambda r: calc_form(r['impact_total'], r['overall_rating']), axis=1)
    
    # Simulate current team retained counts
    df['current_retained_count'] = np.random.randint(0, 6, len(df))
    df['current_overseas_retained_count'] = np.where(df['current_retained_count'] > 0, 
                                               np.random.randint(0, 3, len(df)), 0)
                                               
    labels = []
    for _, row in df.iterrows():
        retain = 0
        skill = row['overall_rating']
        
        if skill >= 90 and row['current_retained_count'] < 5:
            retain = 1
        elif skill >= 85 and row['current_retained_count'] < 3 and row['form_score'] > 60:
            retain = 1
        elif row['is_uncapped'] == 1 and skill >= 75 and row['age'] <= 25 and row['current_retained_count'] < 5:
            retain = 1
            
        if retain == 1 and row['is_overseas'] == 1 and row['current_overseas_retained_count'] >= 2:
            retain = 0
            
        if row['age'] >= 35 and row['form_score'] < 50:
            retain = 0
            
        labels.append(retain)
        
    df['retain_decision'] = labels
    
    # Augment data if less than num_samples
    if len(df) < num_samples:
        multiplier = (num_samples // len(df)) + 1
        dfs = [df]
        for _ in range(multiplier):
            noise_df = df.copy()
            noise_df['form_score'] = np.clip(noise_df['form_score'] + np.random.normal(0, 5, len(df)), 0, 100)
            dfs.append(noise_df)
        df = pd.concat(dfs, ignore_index=True)
        
    return df.head(num_samples)

class RetentionModel:
    def __init__(self, model_path=None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if model_path is None:
            model_path = os.path.join(base_dir, "xgboost_retention_model.json")
        self.model_path = model_path
        self.model = xgb.XGBClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, objective='binary:logistic')
        self.is_trained = False
        
        if os.path.exists(self.model_path):
            self.model.load_model(self.model_path)
            self.is_trained = True

    def train(self):
        print("Generating dataset from players.db...")
        df = generate_db_seeded_data(3000)
        
        # Save dataset
        # 3 levels up: retention -> models -> ml-engine -> data
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
        os.makedirs(data_dir, exist_ok=True)
        csv_path = os.path.join(data_dir, "retention_training_data.csv")
        df.to_csv(csv_path, index=False)
        print(f"Saved training data to {csv_path}")
        
        features = ['overall_rating', 'age', 'is_uncapped', 'is_overseas', 'form_score', 
                    'current_retained_count', 'current_overseas_retained_count']
        
        X = df[features]
        y = df['retain_decision']
        
        print("Training XGBoost Classifier...")
        self.model.fit(X, y)
        
        self.model.save_model(self.model_path)
        self.is_trained = True
        print(f"Model saved successfully to {self.model_path}")
        
    def predict(self, features: dict) -> bool:
        if not self.is_trained:
            self.train()
            
        df = pd.DataFrame([features])
        cols = ['overall_rating', 'age', 'is_uncapped', 'is_overseas', 'form_score', 
                'current_retained_count', 'current_overseas_retained_count']
        for c in cols:
            if c not in df.columns:
                df[c] = 0
                
        pred = self.model.predict(df[cols])
        return bool(pred[0] == 1)

if __name__ == "__main__":
    rm = RetentionModel()
    rm.train()
