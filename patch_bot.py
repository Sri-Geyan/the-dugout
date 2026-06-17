import re
import sys

with open(r'c:\Users\welcome\Documents\the-dugout\lib\botEngine.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """export async function botSelectPlaying11(
    squad: EnrichedPlayer[], 
    pitchType: string = 'BALANCED', 
    tossResult?: { winnerId: string; decision: 'bat' | 'bowl' },
    teamUserId?: string
): Promise<{
    selectedIds: string[];
    battingOrder: string[];
    actualOrder: EnrichedPlayer[];
    captainId: string;
    wkId: string;
    openingBowlerId: string;
}> {
    const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:8000';
    
    let venue = 'Neutral';
    if (pitchType === 'BATTING') venue = 'Wankhede Stadium, Mumbai';
    else if (pitchType === 'BOWLING') venue = 'Eden Gardens, Kolkata';
    else if (pitchType === 'SPINNING') venue = 'MA Chidambaram Stadium, Chepauk, Chennai';

    const payload = {
        team_id: teamUserId || 'bot_team',
        venue: venue,
        players: squad.slice(0, IPL_MAX_SQUAD).map(p => ({
            player_id: p.id,
            name: p.name,
            role: p.role,
            batting_skill: p.battingSkill || 50,
            bowling_skill: p.bowlingSkill || 30,
            nationality: p.nationality || 'Indian',
            is_captain: (p as any).isCaptain ? 1 : 0,
            is_wk: (p as any).isWicketKeeper ? 1 : 0
        }))
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${mlEngineUrl}/api/select/playing11`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const selectedIds = data.selected_xi.map((x: any) => x.player_id);
            
            const selected = squad.filter(p => selectedIds.includes(p.id));
            const wkId = selected.find(p => p.role === 'WICKET_KEEPER')?.id || selectedIds[0];
            const captainId = selected.find(p => (p as any).isCaptain)?.id || selectedIds[0];
            const openingBowlerId = selected.filter(p => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER')[0]?.id || selectedIds[selectedIds.length - 1];

            return {
                selectedIds,
                battingOrder: selectedIds,
                actualOrder: selected,
                captainId,
                wkId,
                openingBowlerId
            };
        }
    } catch (error) {
        console.error('ML Selection Fetch Error:', error);
    }
    
    console.warn('Falling back to basic bot selection');
    const sorted = [...squad].sort((a, b) => Math.max(b.battingSkill || 0, b.bowlingSkill || 0) - Math.max(a.battingSkill || 0, a.bowlingSkill || 0));
    const wks = sorted.filter(p => p.role === 'WICKET_KEEPER');
    const others = sorted.filter(p => p.role !== 'WICKET_KEEPER');
    
    const selected = [];
    if (wks.length > 0) {
        selected.push(wks[0]);
    } else {
        selected.push(others[0]);
        others.shift();
    }
    
    while (selected.length < 11 && others.length > 0) {
        selected.push(others.shift()!);
    }
    
    const selectedIds = selected.map(p => p.id);
    return {
        selectedIds,
        battingOrder: selectedIds,
        actualOrder: selected,
        captainId: selectedIds[0],
        wkId: selected[0]?.id || selectedIds[0],
        openingBowlerId: selectedIds[selectedIds.length - 1]
    };
}"""

start_idx = content.find("export function botSelectPlaying11(")
end_idx = content.find("export function botChooseNextBatter(")

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_func + "\n\n" + content[end_idx:]
    # And remember to await the botSelectPlaying11 call inside botEngine.ts
    new_content = new_content.replace(
        "const selection = botSelectPlaying11(squad, pitchType, tossResult, teamUserId);",
        "const selection = await botSelectPlaying11(squad, pitchType, tossResult, teamUserId);"
    )
    with open(r'c:\Users\welcome\Documents\the-dugout\lib\botEngine.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success")
else:
    print("Function boundaries not found")
