import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class BallOutcomeModel:
    def __init__(self, model_path=None, encoder_path=None):
        self.model_path = model_path or os.path.join(BASE_DIR, "models", "ball_outcome_xgb.json")
        self.encoder_path = encoder_path or os.path.join(BASE_DIR, "models", "label_encoder.pkl")
        self.model = xgb.XGBClassifier(objective='multi:softprob', n_estimators=100, enable_categorical=True)
        self.label_encoder = LabelEncoder()
        
    def train(self, data_path=None):
        if not data_path:
            data_path = os.path.join(BASE_DIR, "data", "training_data.csv")
            
        print(f"Loading data from {data_path}...")
        df = pd.read_csv(data_path)
        
        # Features
        feature_cols = ['innings', 'over', 'ball', 'current_rr', 'required_rr', 'target', 'wickets_remaining']
        
        # Add encoded categorical features
        df['phase_cat'] = df['phase'].astype('category')
        feature_cols.append('phase_cat')
        
        X = df[feature_cols]
        y = self.label_encoder.fit_transform(df['ball_outcome'])
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        print("Training Ball Outcome XGBoost Model...")
        self.model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=10)
        
        print(f"Saving model to {self.model_path}...")
        self.model.save_model(self.model_path)
        joblib.dump(self.label_encoder, self.encoder_path)
        print("Done!")
        
    def load(self):
        self.model.load_model(self.model_path)
        self.label_encoder = joblib.load(self.encoder_path)
        
    def predict_probs(self, features):
        """
        features: dict matching feature_cols
        Returns dict of class: probability
        """
        df = pd.DataFrame([features])
        df['phase_cat'] = df['phase_cat'].astype('category')
        
        probs = self.model.predict_proba(df)[0]
        classes = self.label_encoder.inverse_transform(self.model.classes_)
        
        return dict(zip(classes, probs))
        
if __name__ == "__main__":
    model = BallOutcomeModel()
    model.train()
