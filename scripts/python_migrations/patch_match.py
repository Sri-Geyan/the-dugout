import re

with open(r'c:\Users\welcome\Documents\the-dugout\lib\matchEngine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Make simulateBall async
content = content.replace("export function simulateBall(", "export async function simulateBall(")

# Make processNextBall async
content = content.replace("export function processNextBall(", "export async function processNextBall(")

# In processNextBall, make the call to simulateBall await
content = content.replace(
    "const ballResult = simulateBall(",
    "const ballResult = await simulateBall("
)

# Now, insert the ML fetch at the beginning of simulateBall
# Wait, simulateBall starts with:
# export async function simulateBall(
#    ...
# ): Promise<BallResult> {  <-- Wait, it currently says ): BallResult {
content = content.replace("): BallResult {", "): Promise<BallResult> {")
content = content.replace("): { state: MatchState; ballResult: BallResult } {", "): Promise<{ state: MatchState; ballResult: BallResult }> {")

ml_fetch_code = """
    // --- ML Engine Integration ---
    try {
        const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600); // 600ms timeout for speed

        // Construct payload
        const totalBalls = 120 - ballsRemaining;
        const over = Math.floor(totalBalls / 6);
        const ball = (totalBalls % 6) + 1;
        const wickets = fieldingTeam ? fieldingTeam.wickets : 0;
        const venueName = stadiumId ? (getStadiumById(stadiumId)?.name || 'Neutral') : 'Neutral';
        
        const payload = {
            innings: innings || 1,
            over: over,
            ball: ball,
            current_score: currentScore,
            wickets: wickets,
            target: target || 0,
            venue: venueName,
            batter_rating: batter.player.battingSkill || 50,
            bowler_rating: bowler.player.bowlingSkill || 30
        };

        const response = await fetch(`${mlEngineUrl}/api/simulate/ball`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            // Map Python output to BallResult
            // data contains: runs (string like "4", "WICKET", etc), dismissal, commentary
            let runs = 0;
            let isWicket = false;
            let isBoundary = false;
            let isSix = false;
            let isExtra = false;
            let extraType = null;
            let extraRuns = 0;
            
            if (data.outcome === 'WICKET') {
                isWicket = true;
            } else if (data.outcome === 'EXTRA') {
                isExtra = true;
                extraType = 'wide'; // Simplified fallback
                extraRuns = 1;
            } else {
                runs = parseInt(data.outcome);
                if (runs === 4) isBoundary = true;
                if (runs === 6) isSix = true;
            }
            
            return {
                runs,
                isWicket,
                isBoundary,
                isSix,
                isExtra,
                extraType,
                extraRuns,
                dismissalType: data.dismissal || null,
                commentary: data.commentary || 'Good ball.'
            };
        }
    } catch (e) {
        // Fallback to local math
        // console.warn("ML Engine timeout/error, falling back to local math");
    }
    // --- End ML Engine Integration ---
"""

# Insert ml_fetch_code right after `const stadium = ...`
search_target = "const stadium = stadiumId ? getStadiumById(stadiumId) : null;"
if search_target in content:
    content = content.replace(search_target, search_target + "\n" + ml_fetch_code)
else:
    print("Could not find insertion point")

with open(r'c:\Users\welcome\Documents\the-dugout\lib\matchEngine.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched matchEngine.ts")
