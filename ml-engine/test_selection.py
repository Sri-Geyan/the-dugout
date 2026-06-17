import json
import random

from selection.optimizer import LineupOptimizer
from selection.modifiers import ContextModifierEngine
from selection.explainer import ExplainableAIEngine
from models.selection_model import SelectionModel

def test_selection():
    # 1. Initialize
    selection_model = SelectionModel()
    context_engine = ContextModifierEngine()
    optimizer = LineupOptimizer()
    explainer = ExplainableAIEngine()
    
    # 2. Create 25-man mock roster for CSK
    roles = ['BATTER'] * 8 + ['PACE_BOWLER'] * 7 + ['SPIN_BOWLER'] * 5 + ['ALL_ROUNDER'] * 3 + ['WICKET_KEEPER'] * 2
    random.shuffle(roles)
    
    players = []
    for i in range(25):
        is_overseas = random.random() < 0.35 # ~8 overseas players
        players.append({
            "player_id": f"p_{i}",
            "name": f"Player {i}",
            "role": roles[i],
            "is_overseas": is_overseas,
            "age": random.randint(20, 38),
            "overall_rating": random.randint(65, 95),
            "form_rating": random.randint(2, 9),
            "fitness_rating": random.randint(60, 100)
        })
        
    print(f"Total Squad: {len(players)}")
    print(f"Overseas Players in Squad: {sum(1 for p in players if p['is_overseas'])}")
    print(f"WKs in Squad: {sum(1 for p in players if p['role'] == 'WICKET_KEEPER')}")
    print("\nSimulating Match at MA Chidambaram Stadium (Chepauk) for CSK...\n")
    
    # 3. Evaluate Probabilities
    evaluated = []
    for p in players:
        base_prob = selection_model.predict_probability(p)
        mod_prob, reasons = context_engine.modify_probability(p, base_prob, "CSK", "MA Chidambaram Stadium")
        
        p_eval = p.copy()
        p_eval['modified_prob'] = mod_prob
        p_eval['modifier_reasons'] = reasons
        evaluated.append(p_eval)
        
    # 4. Optimize
    selected_ids, statuses = optimizer.optimize(evaluated)
    
    # 5. Output
    print(f"--- PLAYING XI --- (Total {len(selected_ids)})")
    selected_players = [p for p in evaluated if p['player_id'] in selected_ids]
    
    overseas_count = 0
    bowlers_count = 0
    wk_count = 0
    
    for p in selected_players:
        if p['is_overseas']: overseas_count += 1
        if p['role'] in ['BOWLER', 'PACE_BOWLER', 'SPIN_BOWLER', 'ALL_ROUNDER']: bowlers_count += 1
        if p['role'] == 'WICKET_KEEPER': wk_count += 1
        
        reasons = explainer.explain_selection(
            p['player_id'], p['name'], True, p['modified_prob'], p['modifier_reasons'], statuses[p['player_id']]
        )
        os_str = "(OS)" if p['is_overseas'] else "(IND)"
        print(f"[{p['role']}] {p['name']} {os_str} | Prob: {p['modified_prob']:.2f} | Reasons: {reasons['reasons']}")
        
    print("\n--- BENCH (Sample) ---")
    benched = [p for p in evaluated if p['player_id'] not in selected_ids][:5]
    for p in benched:
        reasons = explainer.explain_selection(
            p['player_id'], p['name'], False, p['modified_prob'], p['modifier_reasons'], statuses[p['player_id']]
        )
        print(f"[{p['role']}] {p['name']} | Prob: {p['modified_prob']:.2f} | Dropped Reason: {reasons['reasons'][-1:]}")

    print(f"\nConstraint Check -> Overseas: {overseas_count}/4 max | WKs: {wk_count}/1 min | Bowlers: {bowlers_count}/5 min")
    
    if overseas_count > 4 or wk_count < 1 or bowlers_count < 5 or len(selected_ids) != 11:
        print("\nERROR: CONSTRAINTS VIOLATED!")
        exit(1)
    else:
        print("\nSUCCESS: All Constraints Satisfied!")

if __name__ == "__main__":
    test_selection()
