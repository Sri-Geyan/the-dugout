import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const sessionCookie = request.cookies.get('session');

    if (!sessionCookie?.value) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const session = JSON.parse(sessionCookie.value);
        return NextResponse.json({
            userId: session.userId,
            username: session.username,
        });
    } catch {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
}
