'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import PlayerAvatar from '@/components/PlayerAvatar';

interface SquadPlayer {
    player: {
        id: string;
        name: string;
        role: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
        battingSkill: number;
        bowlingSkill: number;
        nationality?: string;
    };
    soldPrice: number;
}

interface TeamData {
    userId: string;
    username: string;
    teamName: string;
    squad: SquadPlayer[];
}

export default function PreMatchSelectionPage() {
    const params = useParams();
    const code = params.code as string;
    const searchParams = useSearchParams();
    const fixtureId = searchParams.get('fixture');
    const router = useRouter();
    const { userId, isLoggedIn, setUser } = useUserStore();

    const [loading, setLoading] = useState(true);
    const [fixture, setFixture] = useState<any>(null);
    const [myTeam, setMyTeam] = useState<TeamData | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isLocked, setIsLocked] = useState(false);
    const [otherTeamLocked, setOtherTeamLocked] = useState(false);
    const [hostId, setHostId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            // Get league state to find fixture
            const leagueRes = await fetch(`/api/league?roomCode=${code}`);
            if (leagueRes.ok) {
                const data = await leagueRes.json();
                if (data.state) {
                    const f = data.state.fixtures.find((f: any) => f.id === fixtureId);
                    setFixture(f);

                    // If fixture is already live, go to match
                    if (f?.status === 'live') {
                        router.push(`/match/${code}?fixture=${fixtureId}`);
                        return;
                    }

                    // Find my team in the standings/teams list
                    // Since LeagueState only has standings and fixtures, we need the full squads.
                    // Full squads are currently in the AuctionState.
                    const auctionRes = await fetch(`/api/auction?roomCode=${code}`);
                    if (auctionRes.ok) {
                        const auctionData = await auctionRes.json();
                        const teams = auctionData.state.teams;
                        const t = teams.find((t: any) => t.userId === userId);
                        if (t) setMyTeam(t);
                    }
                }
            }

            // Get selection status for THIS specific match
            // We can reuse /api/selection but we might need a fixtureId parameter?
            // For now, let's assume /api/selection?roomCode=X&fixtureId=Y
            const selRes = await fetch(`/api/selection?roomCode=${code}&fixtureId=${fixtureId}`);
            if (selRes.ok) {
                const selData = await selRes.json();
                if (selData.selections) {
                    if (userId && selData.selections[userId]) {
                        setSelectedIds(new Set(selData.selections[userId]));
                        setIsLocked(true);
                    }
                    // Check if the opponent is locked
                    const opponentUserId = fixture?.homeTeamUserId === userId ? fixture?.awayTeamUserId : fixture?.homeTeamUserId;
                    if (opponentUserId && selData.selections[opponentUserId]) {
                        setOtherTeamLocked(true);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    }, [code, fixtureId, userId, router, fixture?.homeTeamUserId, fixture?.awayTeamUserId]);

    useEffect(() => {
        const init = async () => {
            if (!isLoggedIn) {
                try {
                    const res = await fetch('/api/auth/me');
                    if (res.ok) {
                        const data = await res.json();
                        setUser(data.userId, data.username);
                    } else { router.push('/login'); return; }
                } catch { router.push('/login'); return; }
            }

            const roomRes = await fetch(`/api/rooms/${code}`);
            if (roomRes.ok) {
                const roomData = await roomRes.json();
                setHostId(roomData.room.hostId);
            }

            await fetchData();
            setLoading(false);
        };
        init();

        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [isLoggedIn, code, userId, router, setUser, fetchData]);

    const handleTogglePlayer = (playerId: string) => {
        if (isLocked) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) next.delete(playerId);
            else if (next.size < 11) next.add(playerId);
            return next;
        });
    };

    const handleLock = async () => {
        if (selectedIds.size !== 11) return;
        try {
            const res = await fetch('/api/selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomCode: code,
                    fixtureId: fixtureId,
                    teamId: userId,
                    selectedIds: Array.from(selectedIds)
                })
            });
            if (res.ok) {
                setIsLocked(true);
                fetchData();
            }
        } catch (err) {
            console.error('Lock failed:', err);
        }
    };

    const handleStartMatch = async () => {
        // Host triggers match initialization
        try {
            const matchRes = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'init',
                    roomCode: code,
                    fixtureId: fixtureId,
                    // The API will now pull correct teams based on fixtureId
                }),
            });

            if (matchRes.ok) {
                const matchData = await matchRes.json();
                // Transition fixture to live
                await fetch('/api/league', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'lockPreMatch',
                        roomCode: code,
                        fixtureId: fixtureId,
                        matchId: matchData.state.matchId
                    })
                });
                router.push(`/match/${code}?fixture=${fixtureId}`);
            }
        } catch (err) {
            console.error('Match init failed:', err);
        }
    };

    if (loading || !fixture || !myTeam) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="shimmer w-16 h-16 rounded-2xl" />
            </div>
        );
    }

    const isHost = userId === hostId;
    const canStart = isLocked && otherTeamLocked && isHost;

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold gold-text mb-1">Playing 11 Selection</h1>
                        <p className="text-sm opacity-60">
                            Match {fixture.scheduledOrder}: {fixture.homeTeamName} vs {fixture.awayTeamName}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-widest opacity-40 mb-1">Selection Status</p>
                            <div className="flex gap-2">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${isLocked ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'}`}>
                                    {isLocked ? '✓ READY' : '⏳ SELECTING'}
                                </span>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${otherTeamLocked ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'}`}>
                                    {otherTeamLocked ? '✓ OPPONENT READY' : '⏳ OPPONENT SELECTING'}
                                </span>
                            </div>
                        </div>

                        {isHost ? (
                            <button
                                onClick={handleStartMatch}
                                disabled={!isLocked || !otherTeamLocked}
                                className={`btn-primary px-8 py-3 ${(!isLocked || !otherTeamLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                Start Match →
                            </button>
                        ) : (
                            <button
                                onClick={handleLock}
                                disabled={selectedIds.size !== 11 || isLocked}
                                className="btn-primary px-8 py-3"
                            >
                                {isLocked ? 'Selection Locked' : `Lock Selection (${selectedIds.size}/11)`}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Squad List */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {myTeam.squad.map((s) => (
                                <div
                                    key={s.player.id}
                                    onClick={() => handleTogglePlayer(s.player.id)}
                                    className={`panel cursor-pointer transition-all duration-300 ${selectedIds.has(s.player.id)
                                        ? 'border-[var(--color-gold)] bg-white/5 scale-[1.02]'
                                        : 'border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <PlayerAvatar name={s.player.name} role={s.player.role as any} size="md" />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-bold text-sm">{s.player.name}</h3>
                                                {selectedIds.has(s.player.id) && <span className="text-xs gold-text">✓</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 opacity-60">
                                                    {s.player.role}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 opacity-60 font-mono">
                                                    Bat: {s.player.battingSkill} | Bowl: {s.player.bowlingSkill}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="space-y-4">
                        <div className="panel sticky top-24">
                            <h2 className="text-sm font-bold uppercase tracking-wider mb-4 opacity-60">Your Playing 11</h2>
                            <div className="space-y-2 mb-6">
                                {Array.from(selectedIds).map(id => {
                                    const p = myTeam.squad.find(s => s.player.id === id);
                                    return (
                                        <div key={id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                                            <span>{p?.player.name}</span>
                                            <span className="opacity-40">{p?.player.role[0]}</span>
                                        </div>
                                    );
                                })}
                                {[...Array(11 - selectedIds.size)].map((_, i) => (
                                    <div key={i} className="h-8 border-b border-dashed border-white/5 flex items-center justify-center text-[10px] opacity-20">
                                        Slot {selectedIds.size + i + 1}
                                    </div>
                                ))}
                            </div>

                            {!isHost && (
                                <button
                                    onClick={handleLock}
                                    disabled={selectedIds.size !== 11 || isLocked}
                                    className="btn-primary w-full py-3"
                                >
                                    {isLocked ? 'Selection Locked' : `Lock Selection (${selectedIds.size}/11)`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
