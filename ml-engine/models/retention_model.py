import pandas as pd
import numpy as np
import xgboost as xgb
import os

def generate_mcp_seeded_data(num_samples=2000):
    """
    Generate synthetic retention data, seeded by real data fetched from cricket-mcp.
    Real MCP Data Insights:
    - V Kohli: Avg 61.14, SR 171.2
    - MS Dhoni: Avg 21.43, SR 129.31
    - RG Sharma: Avg 29.40, SR 152.33
    - JJ Bumrah: Econ 8.47, Wkts 4 (in 10 inns)
    - Rashid Khan: Econ 7.0 (approx based on runs), Wkts 13
    """
    np.random.seed(42)
    
    # Generate realistic player features
    overall_rating = np.random.randint(65, 100, num_samples)
    age = np.random.randint(18, 42, num_samples)
    is_uncapped = np.random.choice([0, 1], num_samples, p=[0.7, 0.3])
    is_overseas = np.random.choice([0, 1], num_samples, p=[0.6, 0.4])
    
    # We create a "form_score" based on the MCP insights
    # Form score: 0 to 100. Star players like Kohli have high form, others variable.
    # Higher rating generally means slightly higher average form
    form_score = overall_rating - 20 + np.random.normal(0, 15, num_samples)
    form_score = np.clip(form_score, 0, 100)
    
    # Team state
    current_retained_count = np.random.randint(0, 6, num_samples)
    current_overseas_retained_count = np.where(current_retained_count > 0, 
                                               np.random.randint(0, 3, num_samples), 0)
    
    df = pd.DataFrame({
        'overall_rating': overall_rating,
        'age': age,
        'is_uncapped': is_uncapped,
        'is_overseas': is_overseas,
        'form_score': form_score,
        'current_retained_count': current_retained_count,
        'current_overseas_retained_count': current_overseas_retained_count
    })
    
    # --- LABELLING LOGIC (Strategic Retention Rules) ---
    # The goal is to mimic what a smart franchise would do
    labels = []
    for _, row in df.iterrows():
        retain = 0
        skill = row['overall_rating']
        
        # Superstars are retained unless team is full
        if skill >= 90 and row['current_retained_count'] < 5:
            retain = 1
        # Very good players retained if slots available and form is good
        elif skill >= 85 and row['current_retained_count'] < 3 and row['form_score'] > 60:
            retain = 1
        # Uncapped young talents with decent skill are bargains
        elif row['is_uncapped'] == 1 and skill >= 75 and row['age'] <= 25 and row['current_retained_count'] < 5:
            retain = 1
            
        # Overseas restriction: very strict. Don't retain if we already have 2 overseas
        if retain == 1 and row['is_overseas'] == 1 and row['current_overseas_retained_count'] >= 2:
            retain = 0
            
        # Older players out of form are released
        if row['age'] >= 35 and row['form_score'] < 50:
            retain = 0
            
        labels.append(retain)
        
    df['retain_decision'] = labels
    return df

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
        print("Generating dataset using MCP-seeded parameters...")
        df = generate_mcp_seeded_data(3000)
        
        # Save dataset
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
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
