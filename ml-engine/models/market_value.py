import xgboost as xgb
import pandas as pd
import numpy as np
import os

class MarketValueModel:
    def __init__(self, model_path=None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "xgboost_market_model.json")
        self.model_path = model_path
        self.model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100)
        self.is_trained = False
        
        if os.path.exists(self.model_path):
            self.model.load_model(self.model_path)
            self.is_trained = True

    def train_mock(self):
        """
        Trains a mock model if no real data is available, ensuring the pipeline works.
        """
        # Generate dummy data
        np.random.seed(42)
        X = pd.DataFrame({
            'overall_rating': np.random.randint(60, 100, 1000),
            'age': np.random.randint(18, 40, 1000),
            'scarcity': np.random.uniform(0, 100, 1000),
            'form': np.random.uniform(-5, 5, 1000),
            'base_price': np.random.choice([20, 50, 100, 200], 1000) # In Lakhs
        })
        # Target variable: roughly based on rating but with noise
        y = (X['overall_rating'] - 50) * 10 + X['scarcity'] * 2 - (X['age'] - 25) * 5 + np.random.normal(0, 50, 1000)
        y = np.clip(y, X['base_price'], 2000) # Max 20 Cr

        self.model.fit(X, y)
        self.model.save_model(self.model_path)
        self.is_trained = True
        print("Mock XGBoost model trained and saved.")

    def predict(self, features: dict) -> float:
        """
        Predict expected market value based on features.
        """
        if not self.is_trained:
            self.train_mock()
            
        df = pd.DataFrame([features])
        # Ensure we only use the expected columns
        cols = ['overall_rating', 'age', 'scarcity', 'form', 'base_price']
        for c in cols:
            if c not in df.columns:
                df[c] = 0
                
        pred = self.model.predict(df[cols])
        return max(float(pred[0]), features.get('base_price', 20.0))

if __name__ == "__main__":
    mvm = MarketValueModel()
    mvm.train_mock()
