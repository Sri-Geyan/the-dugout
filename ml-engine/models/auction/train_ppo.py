from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
import os
from models.auction_env import AuctionEnv

def train_ppo_agent():
    print("Initializing Auction Environment...")
    env = AuctionEnv()
    
    # Check if env is valid
    check_env(env)
    
    model_path = os.path.join(os.path.dirname(__file__), "ppo_auction_bot")
    
    if os.path.exists(model_path + ".zip"):
        print("Loading existing PPO model...")
        model = PPO.load(model_path, env=env)
    else:
        print("Creating new PPO model...")
        model = PPO("MlpPolicy", env, verbose=1)
    
    # Small trial run (10,000 timesteps)
    print("Starting training (10,000 timesteps)...")
    model.learn(total_timesteps=10000)
    
    model.save(model_path)
    print(f"Model saved to {model_path}.zip")

if __name__ == "__main__":
    train_ppo_agent()
