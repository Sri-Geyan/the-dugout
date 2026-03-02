import { NextRequest, NextResponse } from 'next/server';
import { initMatchState, processNextBall, saveMatchState, getMatchState } from '@/lib/matchEngine';
import { v4 as uuidv4 } from 'uuid';

function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try { return JSON.parse(sessionCookie.value); } catch { return null; }
}

export async function POST(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const { action, matchId, roomCode, homeTeam, awayTeam, pitchType } = await request.json();

        if (action === 'init') {
            const id = matchId || uuidv4();
            const state = initMatchState(id, roomCode, homeTeam, awayTeam, pitchType || 'BALANCED');
            await saveMatchState(state);
            return NextResponse.json({ state });
        }

        if (action === 'ball') {
            const state = await getMatchState(matchId);
            if (!state) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

            if (state.status === 'innings_break') {
                state.status = 'live';
            }

            const result = processNextBall(state);
            await saveMatchState(result.state);
            return NextResponse.json({ state: result.state, ballResult: result.ballResult });
        }

        if (action === 'status') {
            const state = await getMatchState(matchId);
            return NextResponse.json({ state });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Match error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    if (!matchId) return NextResponse.json({ error: 'Match ID required' }, { status: 400 });

    const state = await getMatchState(matchId);
    return NextResponse.json({ state });
}
