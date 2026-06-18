import os
import sys

# Train Market Model
print("--- Training Market Value Model (XGBoost) ---")
# from models.market_value.market_value import MarketValueModel
# mvm = MarketValueModel()
# mvm.train_mock()

# Train PPO Agent
print("\n--- Training PPO Auction Agent (Stable-Baselines3) ---")
# from models.train_ppo import train_ppo_agent
# train_ppo_agent()

# Simulate a decision
print("\n--- Simulating Live Auction Decision ---")
from api.server import AuctionState, decide_bid
import asyncio

async def test_decision():
    # Mock state for CSK looking at an elite spinner
    state = AuctionState(
        team_id="CSK",
        player_features={
            "role": "Spinner",
            "age": 32,
            "overall_rating": 92,
            "form": 2,
            "scarcity": 95, # Very scarce
            "base_price": 200 # 2 Cr
        },
        current_bid=400, # 4 Cr
        purse_remaining=5000, # 50 Cr
        scarcity_score=0.95,
        team_needs_score=0.90 # High need
    )
    
    result = await decide_bid(state)
    print("\nResult for CSK bidding on a 32yo Elite Spinner at 4Cr:")
    print(result)

asyncio.run(test_decision())

# Test Match Orchestrator with Pitch Data
print("\n--- Testing Match Orchestrator (Pitch Data) ---")
from simulator.orchestrator import MatchOrchestrator
orchestrator = MatchOrchestrator()
state = {
    'innings': 2,
    'over': 15,
    'ball': 1,
    'current_score': 120,
    'wickets': 3,
    'target': 180,
    'venue': 'MA Chidambaram Stadium',
    'batter_rating': 85,
    'bowler_rating': 90,
    'pitch_data': {
        'batFriendly': 2,
        'bounce': 2,
        'turn': 5,
        'dewProbability': 0.8
    }
}
result = orchestrator.simulate_ball(state)
print("Simulation result for Spin Bowler on high-turn track in 2nd Innings with Dew:")
print(result)

# Test Fixture Scheduler
print("\n--- Testing Fixture Scheduler ---")
from models.fixtures.scheduler_model import FixtureScheduler
scheduler = FixtureScheduler(teams=[
    'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru', 'Kolkata Knight Riders',
    'Delhi Capitals', 'Sunrisers Hyderabad', 'Punjab Kings', 'Rajasthan Royals',
    'Lucknow Super Giants', 'Gujarat Titans'
])
sched = scheduler.schedule()
print(f"Generated {len(sched)} matches for 10 teams")