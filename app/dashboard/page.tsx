'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import RoomCard from '@/components/RoomCard';

interface UserRoom {
    code: string;
    status: string;
    playerCount: number;
    maxPlayers: number;
    hostId: string;
    players: string[];
    createdAt: string;
}

export default function DashboardPage() {
    const { userId, username, isLoggedIn, setUser } = useUserStore();
    const [rooms, setRooms] = useState<UserRoom[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            if (!isLoggedIn) {
                try {
                    const res = await fetch('/api/auth/me');
                    if (res.ok) {
                        const data = await res.json();
                        setUser(data.userId, data.username);
                    } else {
                        router.push('/login');
                        return;
                    }
                } catch {
                    router.push('/login');
                    return;
                }
            }
            fetchRooms();
        };
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await fetch('/api/rooms');
            if (res.ok) {
                const data = await res.json();
                setRooms(data.rooms || []);
            }
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const createRoom = async () => {
        setCreating(true);
        setError('');
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create' }),
            });
            const data = await res.json();
            if (res.ok) {
                router.push(`/room/${data.room.code}`);
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to create room');
        } finally {
            setCreating(false);
        }
    };

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        setJoining(true);
        setError('');
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join', code: joinCode.toUpperCase() }),
            });
            const data = await res.json();
            if (res.ok) {
                router.push(`/room/${data.room.code}`);
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to join room');
        } finally {
            setJoining(false);
        }
    };

    const navigateToRoom = (code: string) => {
        const room = rooms.find(r => r.code === code);
        if (!room) return;
        if (room.status === 'auction') router.push(`/auction/${code}`);
        else if (room.status === 'match') router.push(`/match/${code}`);
        else router.push(`/room/${code}`);
    };

    if (loading || !isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="shimmer w-16 h-16 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
            <Navbar />
            <main className="max-w-6xl mx-auto px-6 pt-24 pb-12">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold mb-1">
                        Welcome back, <span className="gold-text">{username}</span>
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Create or join a room to start your cricket management journey
                    </p>
                </div>

                {/* Actions */}
                <div className="grid md:grid-cols-2 gap-6 mb-12">
                    {/* Create Room */}
                    <div className="panel-gold">
                        <h2 className="text-lg font-bold mb-2">Create Room</h2>
                        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                            Start a new game. You&apos;ll be the host with full control over the room.
                        </p>
                        <button
                            id="create-room-btn"
                            onClick={createRoom}
                            disabled={creating}
                            className="btn-primary w-full"
                        >
                            {creating ? 'Creating...' : 'Create New Room'}
                        </button>
                    </div>

                    {/* Join Room */}
                    <div className="panel">
                        <h2 className="text-lg font-bold mb-2">Join Room</h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                            Enter a 6-character room code to join an existing game.
                        </p>
                        <form onSubmit={handleJoinRoom} className="flex gap-3">
                            <input
                                id="join-code-input"
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="ENTER CODE"
                                className="input-field font-mono tracking-widest text-center"
                                maxLength={6}
                            />
                            <button
                                id="join-room-btn"
                                type="submit"
                                disabled={joining || joinCode.length < 6}
                                className="btn-secondary whitespace-nowrap"
                            >
                                {joining ? 'Joining...' : 'Join'}
                            </button>
                        </form>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{
                        background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}>
                        {error}
                    </div>
                )}

                {/* My Rooms */}
                <div>
                    <h2 className="text-sm font-semibold tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--color-text-muted)' }}>
                        Your Rooms
                    </h2>
                    {rooms.length === 0 ? (
                        <div className="panel text-center py-12">
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No rooms yet. Create or join one to get started!
                            </p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rooms.map((room) => (
                                <RoomCard
                                    key={room.code}
                                    code={room.code}
                                    status={room.status}
                                    playerCount={room.playerCount}
                                    maxPlayers={room.maxPlayers}
                                    players={room.players}
                                    hostId={room.hostId}
                                    currentUserId={userId || ''}
                                    onJoin={navigateToRoom}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
