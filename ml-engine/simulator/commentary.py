import random

class CommentaryEngine:
    def __init__(self):
        self.templates = {
            "0": [
                "Solid defense, straight to the fielder.",
                "Pushed to cover, no run.",
                "Beaten! Good movement off the pitch.",
                "Played back to the bowler."
            ],
            "1": [
                "Tucked away on the leg side for a single.",
                "Driven to long off for one.",
                "Quick single taken.",
                "Worked into the gap, just a single."
            ],
            "2": [
                "Driven through the covers, they'll come back for two.",
                "Whipped away, good running between the wickets.",
                "Pushed into the deep, easy two."
            ],
            "3": [
                "Great shot, but cut off at the boundary. Three runs.",
                "Driven beautifully, brilliant fielding saves a run."
            ],
            "4": [
                "CRACKING SHOT! That raced to the boundary for four.",
                "Short and punished! Pulled away for four.",
                "Exquisite cover drive, beats the fielder. Four runs.",
                "Pierces the gap! One bounce into the fence."
            ],
            "6": [
                "HUGE! That is out of the stadium! Six runs.",
                "What a clean strike! Goes all the way for a maximum.",
                "Down the track and launched into the stands!",
                "Massive hit! Six runs to the batter."
            ],
            "WICKET": {
                "bowled": "BOWLED HIM! Knocked him over!",
                "caught": "IN THE AIR... AND TAKEN! Great catch.",
                "lbw": "HUGE APPEAL... Umpire raises the finger! LBW.",
                "run out": "Direct hit! He is miles short. Run out.",
                "stumped": "Danced down the track, missed it. Smart stumping by the keeper.",
                "hit wicket": "Oh dear, he has dislodged his own bails. Hit wicket!"
            },
            "EXTRA": [
                "Wide ball, bowler needs to check his line.",
                "No ball called. Free hit coming up!",
                "Down the leg side, signaled wide.",
                "Leg byes given."
            ]
        }
        
    def generate(self, outcome, dismissal_type=None):
        if outcome == "WICKET" and dismissal_type:
            return self.templates["WICKET"].get(dismissal_type.lower(), "OUT! What a delivery.")
        elif outcome in self.templates:
            return random.choice(self.templates[outcome])
        else:
            return f"Outcome: {outcome}"
