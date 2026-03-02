'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import AuctionPanel from '@/components/AuctionPanel';
import { IPL_TEAMS } from '@/data/teams';

interface AuctionSetInfo {
    id: string;
    name: string;
    shortName: string;
    description: string;
    emoji: string;
    color: string;
    players: { id: string; name: string }[];
}

interface AuctionState {
    roomCode: string;
    status: string;
    currentPlayer: { name: string; role: string; basePrice: number; battingSkill: number; bowlingSkill: number; nationality?: string } | null;
    currentBid: number;
    currentBidder: { userId: string; username: string; teamName: string } | null;
    timerEnd: number | null;
    teams: { userId: string; username: string; teamName: string; teamId?: string; purse: number; squad: { player: { name: string }; soldPrice: number }[] }[];
    soldPlayers: { player: { name: string; role: string }; soldTo: { username: string; teamName: string }; soldPrice: number }[];
    currentPlayerIndex: number;
    remainingPlayers: unknown[];
    // Slot-based fields
    auctionSets: AuctionSetInfo[];
    currentSetIndex: number;
    currentSetPlayerIndex: number;
    totalPlayers: number;
}

export default function AuctionPage() {
    const params = useParams();
    const code = params.code as string;
    const router = useRouter();
    const { userId, isLoggedIn, setUser } = useUserStore();
    const [auction, setAuction] = useState<AuctionState | null>(null);
    const [loading, setLoading] = useState(true);
    const [hostId, setHostId] = useState<string | null>(null);

    const fetchAuction = useCallback(async () => {
        try {
            const res = await fetch(`/api/auction?roomCode=${code}`);
            if (res.ok) {
                const data = await res.json();
                if (data.state) setAuction(data.state);
            }
        } catch (err) {
            console.error('Failed to fetch auction:', err);
        }
    }, [code]);

    useEffect(() => {
        const init = async () => {
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

            // Get room to check host
            const roomRes = await fetch(`/api/rooms/${code}`);
            if (roomRes.ok) {
                const roomData = await roomRes.json();
                setHostId(roomData.room.hostId);
            }

            await fetchAuction();
            setLoading(false);
        };
        init();
        const interval = setInterval(fetchAuction, 2000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleBid = async (amount: number) => {
        try {
            const res = await fetch('/api/auction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'bid', roomCode: code, amount }),
            });
            const data = await res.json();
            if (data.state) setAuction(data.state);
        } catch (err) {
            console.error('Bid failed:', err);
        }
    };

    const handleNext = async () => {
        try {
            const res = await fetch('/api/auction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'next', roomCode: code }),
            });
            const data = await res.json();
            if (data.state) setAuction(data.state);
        } catch (err) {
            console.error('Next player failed:', err);
        }
    };

    const handleSell = async () => {
        try {
            const res = await fetch('/api/auction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sell', roomCode: code }),
            });
            const data = await res.json();
            if (data.state) setAuction(data.state);
        } catch (err) {
            console.error('Sell failed:', err);
        }
    };

    const isHost = hostId === userId;
    const userTeam = auction?.teams.find(t => t.userId === userId);
    const canBid = auction?.status === 'bidding' && auction?.currentBidder?.userId !== userId;

    // Get current set info
    const currentSet = auction?.auctionSets?.[auction.currentSetIndex];

    useEffect(() => {
        // Auto-sell when timer expires (host only)
        if (isHost && auction?.timerEnd && auction.status === 'bidding') {
            const remaining = auction.timerEnd - Date.now();
            if (remaining <= 0) {
                handleSell();
            } else {
                const timeout = setTimeout(handleSell, remaining);
                return () => clearTimeout(timeout);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auction?.timerEnd, isHost, auction?.status]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="shimmer w-16 h-16 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Live Auction</h1>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Room: <span className="font-mono gold-text">{code}</span>
                            {auction && ` • Player ${auction.currentPlayerIndex} of ${auction.totalPlayers || 250}`}
                        </p>
                    </div>
                    {auction?.status === 'completed' && isHost && (
                        <button
                            onClick={async () => {
                                await fetch(`/api/rooms/${code}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'match' }),
                                });
                                router.push(`/match/${code}`);
                            }}
                            className="btn-primary"
                        >
                            Start Matches →
                        </button>
                    )}
                </div>

                {/* ── Auction Set Tracker ── */}
                {auction?.auctionSets && auction.auctionSets.length > 0 && (
                    <div className="mb-6 rounded-xl p-4" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                        {/* Current Set Banner */}
                        {currentSet && (
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-2xl">{currentSet.emoji}</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold" style={{ color: currentSet.color }}>
                                            {currentSet.name}
                                        </h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                                            background: `${currentSet.color}20`,
                                            color: currentSet.color,
                                        }}>
                                            SET {auction.currentSetIndex + 1}/{auction.auctionSets.length}
                                        </span>
                                    </div>
                                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                        {currentSet.description} • {auction.remainingPlayers.length} players remaining in set
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Set Progress Pills */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {auction.auctionSets.map((set, idx) => {
                                const isCurrent = idx === auction.currentSetIndex;
                                const isDone = idx < auction.currentSetIndex;
                                return (
                                    <div
                                        key={set.id}
                                        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                                        style={{
                                            background: isCurrent ? `${set.color}20` : isDone ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                            color: isCurrent ? set.color : isDone ? 'var(--color-text-muted)' : 'var(--color-text-muted)',
                                            border: isCurrent ? `1px solid ${set.color}40` : '1px solid transparent',
                                            opacity: isDone ? 0.5 : 1,
                                        }}
                                    >
                                        <span>{set.emoji}</span>
                                        <span>{set.shortName}</span>
                                        {isDone && <span>✓</span>}
                                        {isCurrent && (
                                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: set.color }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Auction Panel */}
                    <div className="lg:col-span-2">
                        <AuctionPanel
                            currentPlayer={auction?.currentPlayer || null}
                            currentBid={auction?.currentBid || 0}
                            currentBidder={auction?.currentBidder || null}
                            timerEnd={auction?.timerEnd || null}
                            userPurse={userTeam?.purse || 0}
                            onBid={handleBid}
                            canBid={canBid || false}
                            status={auction?.status || 'idle'}
                            isHost={isHost}
                            onNext={handleNext}
                            onSell={handleSell}
                        />

                        {/* Recent Sales */}
                        {auction && auction.soldPlayers.length > 0 && (
                            <div className="panel mt-6">
                                <h3 className="text-sm font-semibold tracking-wider uppercase mb-4" style={{ color: 'var(--color-text-muted)' }}>
                                    Recent Sales
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {auction.soldPlayers.slice().reverse().slice(0, 10).map((sale, i) => (
                                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg"
                                            style={{ background: 'var(--color-bg-primary)' }}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-semibold">{sale.player.name}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                                                    background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)',
                                                }}>{sale.player.role}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold gold-text">₹{sale.soldPrice} Cr</span>
                                                <span className="text-[10px] ml-2" style={{ color: 'var(--color-text-muted)' }}>→ {sale.soldTo.teamName}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Teams Sidebar */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                            Teams
                        </h3>
                        {auction?.teams.map((team) => {
                            const iplTeam = IPL_TEAMS.find(t => t.name === team.teamName || t.id === team.teamId);
                            const teamColor = iplTeam?.color || 'var(--color-gold)';
                            return (
                                <div key={team.userId} className={`panel transition-all`} style={{
                                    borderColor: team.userId === userId ? `${teamColor}80` : undefined,
                                }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {iplTeam && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{
                                                    background: `${teamColor}15`,
                                                }}>
                                                    <img
                                                        src={iplTeam.logo}
                                                        alt={iplTeam.shortName}
                                                        width={28}
                                                        height={28}
                                                        className="object-contain"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.textContent = iplTeam.emoji;
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: teamColor }}>{iplTeam?.shortName || team.teamName}</p>
                                                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{team.username}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold" style={{ color: teamColor }}>₹{team.purse} Cr</p>
                                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                                {team.squad.length}/25 players
                                            </p>
                                        </div>
                                    </div>
                                    {/* Purse bar */}
                                    <div className="h-1 rounded-full" style={{ background: 'var(--color-border)' }}>
                                        <div className="h-full rounded-full transition-all duration-300" style={{
                                            width: `${(team.purse / 100) * 100}%`,
                                            background: team.purse < 10 ? 'var(--color-danger)' : teamColor,
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
