import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

function hashPin(pin: string): string {
    return createHash('sha256').update(pin + 'dugout_salt_2026').digest('hex');
}

export async function POST(request: NextRequest) {
    try {
        const { username, pin } = await request.json();

        if (!username || typeof username !== 'string') {
            return NextResponse.json({ error: 'Enter your manager name' }, { status: 400 });
        }

        const trimmed = username.trim();
        if (trimmed.length < 3 || trimmed.length > 20) {
            return NextResponse.json({ error: 'Name must be 3–20 characters' }, { status: 400 });
        }

        // Validate PIN if provided
        if (pin !== undefined && pin !== null && pin !== '') {
            if (!/^\d{4}$/.test(String(pin))) {
                return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
            }
        }

        // Find existing user
        const existing = await prisma.user.findUnique({ where: { username: trimmed } });

        if (existing) {
            // Returning user: check PIN if they have one set
            if (existing.pin) {
                if (!pin) {
                    // Signal to frontend to ask for PIN
                    return NextResponse.json({ requiresPin: true }, { status: 200 });
                }
                const hashed = hashPin(String(pin));
                if (hashed !== existing.pin) {
                    return NextResponse.json({ error: 'Wrong PIN. Try again.' }, { status: 401 });
                }
            }

            // Correct PIN (or no PIN set) — log them in
            const response = NextResponse.json({ userId: existing.id, username: existing.username });
            response.cookies.set('session', JSON.stringify({ userId: existing.id, username: existing.username }), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7,
                path: '/',
            });
            return response;
        }

        // New user — create with optional PIN
        const pinHash = pin ? hashPin(String(pin)) : null;
        const user = await prisma.user.create({
            data: { id: uuidv4(), username: trimmed, pin: pinHash },
        });

        const response = NextResponse.json({ userId: user.id, username: user.username });
        response.cookies.set('session', JSON.stringify({ userId: user.id, username: user.username }), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });
        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
