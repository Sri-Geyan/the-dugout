from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
import os

# Add parent directory to path so we can import models and core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.market_value.market_value import MarketValueModel
from core.franchise_dna import apply_franchise_dna
from stable_baselines3 import PPO
from models.retention.retention_model import RetentionModel
import numpy as np

app = FastAPI(title="The Dugout - ML Auction Engine")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Initialize models
try:
    market_model = MarketValueModel(os.path.join(BASE_DIR, "models", "market_value", "xgboost_market_model.json"))
except Exception as e:
    market_model = None
    print(f"Failed to load Market Model: {e}")

try:
    rl_model = PPO.load(os.path.join(BASE_DIR, "models", "auction", "ppo_auction_bot.zip"))
except Exception as e:
    rl_model = None
    print(f"Failed to load PPO Model: {e}")

try:
    retention_model = RetentionModel(os.path.join(BASE_DIR, "models", "retention", "xgboost_retention_model.json"))
except Exception as e:
    retention_model = None
    print(f"Failed to load Retention Model: {e}")

# Load Match Simulator
import sys
sys.path.append(BASE_DIR)
try:
    from simulator.orchestrator import MatchOrchestrator
    match_simulator = MatchOrchestrator()
except Exception as e:
    match_simulator = None
    print(f"Failed to load Match Simulator: {e}")

# Load Selection Engine
try:
    from models.selection.selection_model import SelectionModel
    from selection.modifiers import ContextModifierEngine
    from selection.optimizer import LineupOptimizer
    from selection.explainer import ExplainableAIEngine
    
    selection_model = SelectionModel()
    context_engine = ContextModifierEngine()
    lineup_optimizer = LineupOptimizer()
    explainer_engine = ExplainableAIEngine()
except Exception as e:
    selection_model = None
    print(f"Failed to load Selection Engine: {e}")

class AuctionState(BaseModel):
    team_id: str
    player_features: dict
    current_bid: float
    purse_remaining: float
    scarcity_score: float
    team_needs_score: float

@app.post("/api/auction/decide")
async def decide_bid(state: AuctionState):
    if not market_model:
        raise HTTPException(status_code=500, detail="Market model not initialized.")
        
    # 1. Evaluate base market value
    base_val = market_model.predict(state.player_features)
    
    # 2. Apply Franchise DNA
    adjusted_val = apply_franchise_dna(state.team_id, state.player_features, base_val)
    
    # 3. Create observation vector for RL agent
    norm_bid = min(state.current_bid / 2000.0, 1.0)
    norm_purse = min(state.purse_remaining / 1000.0, 1.0)
    norm_val = min(adjusted_val / 2000.0, 1.0)
    
    obs = np.array([norm_bid, norm_purse, norm_val, state.team_needs_score, state.scarcity_score], dtype=np.float32)
    
    # 4. Get decision from RL model
    if rl_model:
        action, _ = rl_model.predict(obs, deterministic=True)
        action_val = int(action)
    else:
        # Fallback heuristic if model isn't trained yet
        if state.current_bid < adjusted_val and state.purse_remaining > state.current_bid:
            action_val = 1 # BID
        else:
            action_val = 0 # PASS
            
    # Map action to string
    action_map = {
        0: "PASS",
        1: "BID",
        2: "RAISE_SMALL",
        3: "RAISE_MEDIUM",
        4: "RAISE_AGGRESSIVE",
        5: "STOP"
    }
    
    decision = action_map.get(action_val, "PASS")
    
    # Generate reasoning
    reasons = []
    if adjusted_val > base_val:
        reasons.append(f"Strong Franchise Fit (+{int((adjusted_val/base_val - 1)*100)}% valuation)")
    if state.scarcity_score > 0.8:
        reasons.append("High Scarcity Player")
    if state.team_needs_score > 0.8:
        reasons.append("Critical Team Need")
        
    if decision != "PASS" and decision != "STOP":
        if state.current_bid > adjusted_val:
            reasons.append("Willing to overpay due to need/scarcity")
            
    return {
        "decision": decision,
        "expected_value": round(adjusted_val, 2),
        "reasoning": reasons
    }

class AuctionValuationsPayload(BaseModel):
    player_features: dict
    teams: list

@app.post("/api/auction/valuations")
async def get_auction_valuations(payload: AuctionValuationsPayload):
    if not market_model:
        raise HTTPException(status_code=500, detail="Market model not initialized.")
        
    base_val = market_model.predict(payload.player_features)
    
    valuations = {}
    for team in payload.teams:
        team_id = team.get("team_id")
        # Apply Franchise DNA
        adjusted_val = apply_franchise_dna(team_id, payload.player_features, base_val)
        valuations[team_id] = round(adjusted_val, 2)
        
    return {
        "base_value": round(base_val, 2),
        "team_valuations": valuations
    }

class RetentionState(BaseModel):
    team_id: str
    player_features: dict
    
@app.post("/api/retention/decide")
async def decide_retention(state: RetentionState):
    if not retention_model:
        raise HTTPException(status_code=500, detail="Retention model not initialized.")
    
    decision = retention_model.predict(state.player_features)
    return {"retain": decision}

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "market_model_loaded": market_model is not None,
        "rl_model_loaded": rl_model is not None,
        "match_simulator_loaded": match_simulator is not None,
        "retention_model_loaded": retention_model is not None,
        "selection_model_loaded": selection_model is not None
    }

# --- Match Simulation Endpoints ---

class MatchState(BaseModel):
    venue: str = "Neutral"
    target: int = 0
    # Additional configurations can go here

@app.post("/api/simulate/ball")
async def simulate_ball(state: dict):
    if not match_simulator:
        raise HTTPException(status_code=500, detail="Match Simulator not loaded")
    return match_simulator.simulate_ball(state)

@app.post("/api/simulate/batch")
async def simulate_batch(state: dict):
    if not match_simulator:
        raise HTTPException(status_code=500, detail="Match Simulator not loaded")
    max_balls = state.get('max_balls', 6)
    return match_simulator.simulate_batch(state, max_balls)

@app.post("/api/simulate/innings")
async def simulate_innings(state: MatchState):
    if not match_simulator:
        raise HTTPException(status_code=500, detail="Match Simulator not loaded")
    return match_simulator.simulate_innings(state.venue, state.target)

@app.post("/api/simulate/match")
async def simulate_match(state: MatchState):
    if not match_simulator:
        raise HTTPException(status_code=500, detail="Match Simulator not loaded")
    return match_simulator.simulate_match(state.venue)

# --- Playing XI Selection Endpoints ---

class SquadPayload(BaseModel):
    team_id: str
    venue: str
    players: list # List of dicts representing the squad

@app.post("/api/select/playing11")
async def select_playing11(payload: SquadPayload):
    if not selection_model:
        raise HTTPException(status_code=500, detail="Selection Engine not loaded")
        
    evaluated_players = []
    
    # 1. Base ML Probabilities & Modifiers
    for p in payload.players:
        base_prob = selection_model.predict_probability(p)
        mod_prob, reasons = context_engine.modify_probability(p, base_prob, payload.team_id, payload.venue)
        
        # Store for optimizer
        p_eval = p.copy()
        p_eval['base_prob'] = base_prob
        p_eval['modified_prob'] = mod_prob
        p_eval['modifier_reasons'] = reasons
        evaluated_players.append(p_eval)
        
    # 2. Integer Programming Optimizer
    selected_ids, statuses = lineup_optimizer.optimize(evaluated_players)
    
    # 3. Explainable AI Results
    final_roster = []
    for p in evaluated_players:
        pid = p['player_id']
        was_selected = pid in selected_ids
        explanation = explainer_engine.explain_selection(
            player_id=pid,
            name=p.get('name', 'Unknown'),
            was_selected=was_selected,
            probability=p['modified_prob'],
            modifier_reasons=p['modifier_reasons'],
            optimization_status=statuses.get(pid, "unknown")
        )
        final_roster.append(explanation)
        
    # Sort with selected players first, then by probability
    final_roster.sort(key=lambda x: (not x['selected'], -x['selection_probability']))
    
    return {
        "team_id": payload.team_id,
        "venue": payload.venue,
        "selected_xi": [x for x in final_roster if x['selected']],
        "bench": [x for x in final_roster if not x['selected']]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
