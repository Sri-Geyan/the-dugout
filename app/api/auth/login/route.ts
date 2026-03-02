import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    try {
        const { username } = await request.json();

        if (!username || typeof username !== 'string') {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        const trimmed = username.trim();
        if (trimmed.length < 3 || trimmed.length > 20) {
            return NextResponse.json({ error: 'Username must be 3-20 characters' }, { status: 400 });
        }

        // Find or create user
        let user = await prisma.user.findUnique({ where: { username: trimmed } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: uuidv4(),
                    username: trimmed,
                },
            });
        }

        // Create response with session cookie
        const response = NextResponse.json({
            userId: user.id,
            username: user.username,
        });

        response.cookies.set('session', JSON.stringify({
            userId: user.id,
            username: user.username,
        }), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
