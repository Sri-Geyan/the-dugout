import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';

// Helper to get session user
function getSession(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) return null;
    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

// GET: Returns the selection status for a specific room/team
export async function GET(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    const teamId = searchParams.get('teamId');

    const fixtureId = searchParams.get('fixtureId');

    if (!roomCode) return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });

    try {
        const keyPrefix = fixtureId ? `selection:${roomCode}:${fixtureId}` : `selection:${roomCode}`;

        if (teamId) {
            // Get single team's selection
            const data = await redis.get(`${keyPrefix}:${teamId}`);
            return NextResponse.json({ selectedIds: data ? JSON.parse(data) : [] });
        } else {
            // Get all selections for the room/fixture
            const keys = await redis.keys(`${keyPrefix}:*`);
            const selections: Record<string, string[]> = {};

            for (const key of keys) {
                const parts = key.split(':');
                const tId = parts[parts.length - 1]; // Last part is always the teamId
                if (tId) {
                    const data = await redis.get(key);
                    if (data) selections[tId] = JSON.parse(data);
                }
            }
            return NextResponse.json({ selections });
        }
    } catch (error) {
        console.error('Redis selection error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// POST: Save a team's playing 11 selection
export async function POST(request: NextRequest) {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const { roomCode, teamId, selectedIds, fixtureId } = await request.json();

        if (!roomCode || !teamId || !Array.isArray(selectedIds)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        if (selectedIds.length !== 11) {
            return NextResponse.json({ error: 'Exactly 11 players must be selected' }, { status: 400 });
        }

        const key = fixtureId
            ? `selection:${roomCode}:${fixtureId}:${teamId}`
            : `selection:${roomCode}:${teamId}`;

        await redis.set(key, JSON.stringify(selectedIds), 'EX', 86400);

        // If this is the initial selection (no fixtureId), check for global start
        if (!fixtureId) {
            const keys = await redis.keys(`selection:${roomCode}:*`);
            // filter out fixture-specific keys
            const globalKeys = keys.filter((k: string) => k.split(':').length === 3);
            if (globalKeys.length === 10) {
                try {
                    const url = new URL(`/api/league`, request.url);
                    await fetch(url.toString(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cookie': request.headers.get('cookie') || ''
                        },
                        body: JSON.stringify({ action: 'init', roomCode })
                    });
                } catch (err) {
                    console.error('Failed to auto-init league:', err);
                }
            }
        }

        return NextResponse.json({ success: true, selectedIds });
    } catch (error) {
        console.error('Failed to save selection:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
