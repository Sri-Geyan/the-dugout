import gymnasium as gym
from gymnasium import spaces
import numpy as np

class AuctionEnv(gym.Env):
    """
    Custom Environment for franchise auction bidding using Gymnasium.
    """
    metadata = {"render_modes": ["console"]}

    def __init__(self):
        super(AuctionEnv, self).__init__()
        
        # Actions:
        # 0: PASS
        # 1: BID (Match current or minimum increment)
        # 2: RAISE_SMALL
        # 3: RAISE_MEDIUM
        # 4: RAISE_AGGRESSIVE
        # 5: STOP (Give up on this player)
        self.action_space = spaces.Discrete(6)
        
        # Observation space:
        # [Current Bid, Purse Remaining, Player Value, Team Needs Score, Scarcity Score]
        # Normalized between 0 and 1
        self.observation_space = spaces.Box(low=0, high=1, shape=(5,), dtype=np.float32)
        
        self.purse = 1000.0 # 100 Cr represented as 1000 Lakhs
        self.current_bid = 0.0
        self.player_value = 0.0
        self.team_needs_score = 0.0
        self.scarcity_score = 0.0
        
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        # Reset auction state for a new player
        self.current_bid = 20.0 # Base price 20L
        self.player_value = np.random.uniform(50.0, 1500.0)
        self.team_needs_score = np.random.uniform(0, 1)
        self.scarcity_score = np.random.uniform(0, 1)
        
        # We don't reset purse entirely every step, but for the scope of a single episode 
        # (one player auction) we might reset or persist based on outer loop. 
        # For this mock, we assume purse persists unless it's a new season.
        if self.purse < 20.0:
            self.purse = 1000.0
            
        return self._get_obs(), {}

    def _get_obs(self):
        # Normalize
        norm_bid = min(self.current_bid / 2000.0, 1.0)
        norm_purse = min(self.purse / 1000.0, 1.0)
        norm_val = min(self.player_value / 2000.0, 1.0)
        return np.array([norm_bid, norm_purse, norm_val, self.team_needs_score, self.scarcity_score], dtype=np.float32)

    def step(self, action):
        reward = 0.0
        terminated = False
        truncated = False
        
        # Simulate opponent bids
        opponent_bids = np.random.choice([True, False], p=[0.7, 0.3])
        
        if action == 0 or action == 5: # PASS / STOP
            terminated = True
            # Reward logic: Did we pass on a good deal?
            if self.current_bid < self.player_value and self.team_needs_score > 0.5:
                reward = -0.5 # Penalty for missing out
            else:
                reward = 0.5 # Good pass
                
        else: # Bidding actions
            bid_increment = 0
            if action == 1: bid_increment = 10
            elif action == 2: bid_increment = 20
            elif action == 3: bid_increment = 50
            elif action == 4: bid_increment = 100
            
            new_bid = self.current_bid + bid_increment
            
            if new_bid > self.purse:
                # Invalid action, overspending
                reward = -2.0
                terminated = True
            else:
                self.current_bid = new_bid
                if opponent_bids:
                    self.current_bid += np.random.choice([10, 20, 50])
                else:
                    # Won the auction
                    terminated = True
                    self.purse -= self.current_bid
                    
                    # Calculate reward based on value vs price
                    value_diff = self.player_value - self.current_bid
                    
                    # Positive reward for getting a player below perceived value
                    # Boosted by how much the team needed them and their scarcity
                    reward = (value_diff / 100.0) + (self.team_needs_score * 2) + (self.scarcity_score * 1)
                    
                    # Penalty for massive overpay
                    if value_diff < -200:
                        reward -= 2.0

        return self._get_obs(), reward, terminated, truncated, {}
