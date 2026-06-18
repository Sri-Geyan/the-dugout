import os
import random
import xgboost as xgb
import pandas as pd
import numpy as np

class SelectionModel:
    def __init__(self, model_path=None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "xgboost_selection_model.json")
        self.model_path = model_path
        self.model = xgb.XGBRegressor(objective='reg:logistic', n_estimators=50) # Outputs 0 to 1 probability
        self.is_trained = False
        
    def train_mock(self):
        """Train a dummy model on synthetic data to learn basic heuristics."""
        print("Training mock Selection Model...")
        np.random.seed(42)
        n_samples = 2000
        
        # Synthetic features: rating, form, fitness, experience
        X = pd.DataFrame({
            'overall_rating': np.random.randint(60, 95, n_samples),
            'form_rating': np.random.randint(1, 10, n_samples),
            'fitness_rating': np.random.randint(50, 100, n_samples),
            'experience_rating': np.random.randint(1, 100, n_samples)
        })
        
        # Base selection logic: high rating, good form, healthy fitness -> selected
        y = np.where(
            (X['overall_rating'] > 80) & (X['fitness_rating'] > 75) & (X['form_rating'] > 4),
            1, 0
        )
        
        self.model.fit(X, y)
        self.model.save_model(self.model_path)
        self.is_trained = True
        print(f"Selection Model saved to {self.model_path}")
        
    def predict_probability(self, player_features: dict) -> float:
        """
        player_features: dict containing 'overall_rating', 'form_rating', 'fitness_rating', 'experience_rating'
        """
        if not self.is_trained:
            if os.path.exists(self.model_path):
                self.model.load_model(self.model_path)
                self.is_trained = True
            else:
                self.train_mock()
                
        # Fill missing features with averages
        df = pd.DataFrame([{
            'overall_rating': player_features.get('overall_rating', 75),
            'form_rating': player_features.get('form_rating', 5),
            'fitness_rating': player_features.get('fitness_rating', 85),
            'experience_rating': player_features.get('experience_rating', 50)
        }])
        
        prob = self.model.predict(df)[0]
        return float(max(0.01, min(0.99, prob)))
