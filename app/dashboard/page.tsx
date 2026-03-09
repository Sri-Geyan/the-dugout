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

const STATUS_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    waiting: { label: 'Waiting for players', emoji: '⏳', color: '#FFA726' },
    retention: { label: 'Retention phase', emoji: '🛡️', color: '#CE93D8' },
    auction: { label: 'Auction live', emoji: '🔨', color: '#EF5350' },
    selection: { label: 'Squad selection', emoji: '📋', color: '#4FC3F7' },
    league: { label: 'League running', emoji: '🏆', color: '#66BB6A' },
    match: { label: 'Match in progress', emoji: '🏏', color: '#FFD700' },
    completed: { label: 'Season complete', emoji: '🎉', color: '#66BB6A' },
};

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
        } catch { } finally {
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
            if (res.ok) router.push(`/room/${data.room.code}`);
            else setError(data.error);
        } catch {
            setError('Could not create room. Try again.');
        } finally {
            setCreating(false);
        }
    };

    const deleteRoom = async (code: string) => {
        if (!confirm(`Remove room ${code}? All progress will be lost.`)) return;
        try {
            const res = await fetch(`/api/rooms/${code}`, { method: 'DELETE' });
            if (res.ok) setRooms(rooms.filter(r => r.code !== code));
            else { const d = await res.json(); setError(d.error || 'Could not remove room'); }
        } catch {
            setError('Could not remove room');
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
            if (res.ok) router.push(`/room/${data.room.code}`);
            else setError(data.error);
        } catch {
            setError('Could not join room. Check the code and try again.');
        } finally {
            setJoining(false);
        }
    };

    const navigateToRoom = (code: string) => {
        const room = rooms.find(r => r.code === code);
        if (!room) return;
        if (room.status === 'auction') router.push(`/auction/${code}`);
        else if (room.status === 'selection') router.push(`/selection/${code}`);
        else if (room.status === 'league') router.push(`/league/${code}`);
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

    const activeRoom = rooms.find(r => r.status !== 'completed' && r.status !== 'waiting');

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
            <Navbar />

            {/* Subtle ambient glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06] -translate-y-1/2 translate-x-1/2"
                    style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(80px)' }} />
            </div>

            <main className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-20">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10 animate-fadeInUp">
                    <div>
                        <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            IPL 2026
                        </p>
                        <h1 className="text-3xl font-black tracking-tight">
                            Hey, <span className="gold-text">{username}</span> 👋
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            {rooms.length === 0
                                ? 'Create a room to start your season.'
                                : `You're in ${rooms.length} room${rooms.length > 1 ? 's' : ''}.`}
                        </p>
                    </div>
                    <button id="create-room-btn" onClick={createRoom} disabled={creating} className="btn-primary px-8 py-3 font-bold self-start sm:self-auto">
                        {creating ? 'Creating...' : '+ New Room'}
                    </button>
                </div>

                {/* Active session banner */}
                {activeRoom && (
                    <div className="mb-8 p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}
                        onClick={() => navigateToRoom(activeRoom.code)}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{STATUS_LABELS[activeRoom.status]?.emoji ?? '🏏'}</span>
                            <div>
                                <p className="text-xs font-bold tracking-widest uppercase gold-text mb-0.5">Active Season</p>
                                <p className="text-sm font-semibold text-white">
                                    {STATUS_LABELS[activeRoom.status]?.label ?? 'In progress'} · Room {activeRoom.code}
                                </p>
                            </div>
                        </div>
                        <span className="text-sm font-bold gold-text">Rejoin →</span>
                    </div>
                )}

                {/* Join a room */}
                <div className="panel mb-8" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1">
                            <h2 className="text-base font-bold text-white mb-0.5">Join a Room</h2>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Got an invite code? Enter it here.</p>
                        </div>
                        <form onSubmit={handleJoinRoom} className="flex gap-3 w-full sm:w-auto">
                            <input id="join-code-input" type="text" value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="ROOM CODE"
                                className="input-field font-mono font-black tracking-[0.25em] text-center w-36 uppercase"
                                maxLength={6} />
                            <button id="join-room-btn" type="submit"
                                disabled={joining || joinCode.length < 6} className="btn-secondary">
                                {joining ? '...' : 'Join'}
                            </button>
                        </form>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3"
                        style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Rooms list */}
                <div>
                    <div className="flex items-center gap-4 mb-5">
                        <h2 className="text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                            Your Rooms
                        </h2>
                        <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.06), transparent)' }} />
                    </div>

                    {rooms.length === 0 ? (
                        <div className="panel text-center py-20 bg-white/[0.01]">
                            <div className="text-4xl mb-4">🏏</div>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                No rooms yet — create one and invite your friends.
                            </p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {rooms.map(room => (
                                <div key={room.code} onClick={() => navigateToRoom(room.code)} className="cursor-pointer">
                                    <RoomCard
                                        code={room.code}
                                        status={room.status}
                                        playerCount={room.playerCount}
                                        maxPlayers={room.maxPlayers}
                                        players={room.players}
                                        hostId={room.hostId}
                                        currentUserId={userId || ''}
                                        onJoin={navigateToRoom}
                                        onDelete={deleteRoom}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Season info strip */}
                <div className="mt-10 flex items-center justify-center gap-8 pt-6 border-t border-white/[0.04]">
                    {[
                        { label: 'Auction Purse', value: '120 Cr' },
                        { label: 'Players', value: '299' },
                        { label: 'Teams', value: '10' },
                    ].map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-lg font-black gold-text">{s.value}</div>
                            <div className="text-[9px] tracking-widest uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
