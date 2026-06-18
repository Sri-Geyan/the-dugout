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
