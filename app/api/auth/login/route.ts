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
            if (!/^\d{6}$/.test(String(pin))) {
                return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 });
            }
        }

        // Helper to generate a deterministic UUID if DB is down
        const getDeterministicId = (name: string) => {
            const hash = createHash('md5').update(name).digest('hex');
            return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
        };

        let user;
        try {
            // Find existing user
            const existing = await prisma.user.findUnique({ where: { username: trimmed } });

            if (existing) {
                // Returning user: check PIN if they have one set
                if (existing.pin) {
                    if (!pin) {
                        return NextResponse.json({ requiresPin: true }, { status: 200 });
                    }
                    const hashed = hashPin(String(pin));
                    if (hashed !== existing.pin) {
                        return NextResponse.json({ error: 'Wrong PIN. Try again.' }, { status: 401 });
                    }
                } else {
                    // Returning user has no PIN (legacy) — they MUST set one now
                    if (!pin) {
                        return NextResponse.json({ requiresPin: true }, { status: 200 });
                    }
                }
                user = existing;
            } else {
                // New user — PIN is MANDATORY
                if (!pin) {
                    // Request user to provide a PIN (will trigger phase change in frontend)
                    return NextResponse.json({ requiresPin: false, isNewUser: true }, { status: 200 });
                }
                const pinHash = hashPin(String(pin));
                user = await prisma.user.create({
                    data: { id: uuidv4(), username: trimmed, pin: pinHash },
                });
            }
        } catch (dbError) {
            console.error('Database connection failed, using local fallback:', dbError);
            // If DB is down, provide a deterministic ID so seeding works
            user = { id: getDeterministicId(trimmed), username: trimmed };
        }

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
