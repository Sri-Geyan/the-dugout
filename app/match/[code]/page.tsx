'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import ScoreCard from '@/components/ScoreCard';
import MatchBoard from '@/components/MatchBoard';

interface MatchState {
    matchId: string;
    roomCode: string;
    homeTeam: { teamId: string; name: string; userId: string; score: number; wickets: number; overs: number; balls: number; runRate: number; extras: number };
    awayTeam: { teamId: string; name: string; userId: string; score: number; wickets: number; overs: number; balls: number; runRate: number; extras: number };
    innings: number;
    status: string;
    currentBatting: string;
    target: number | null;
    striker: { player: { name: string }; runs: number; balls: number; fours: number; sixes: number } | null;
    nonStriker: { player: { name: string }; runs: number; balls: number; fours: number; sixes: number } | null;
    currentBowler: { player: { name: string }; overs: number; runs: number; wickets: number; economy: number } | null;
    commentary: string[];
    result: string | null;
    matchPhase: string;
}

export default function MatchPage() {
    const params = useParams();
    const code = params.code as string;
    const router = useRouter();
    const { userId, isLoggedIn, setUser } = useUserStore();
    const [match, setMatch] = useState<MatchState | null>(null);
    const [loading, setLoading] = useState(true);
    const [simulating, setSimulating] = useState(false);
    const [hostId, setHostId] = useState<string | null>(null);
    const [autoPlay, setAutoPlay] = useState(false);

    const fetchMatch = useCallback(async (matchId: string) => {
        try {
            const res = await fetch(`/api/match?matchId=${matchId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.state) setMatch(data.state);
            }
        } catch (err) {
            console.error('Failed to fetch match:', err);
        }
    }, []);

    const initMatch = useCallback(async () => {
        try {
            // Get auction state to build teams
            const auctionRes = await fetch(`/api/auction?roomCode=${code}`);
            const auctionData = await auctionRes.json();

            if (!auctionData.state || auctionData.state.teams.length < 2) {
                return;
            }

            const teams = auctionData.state.teams;
            const homeTeam = {
                teamId: teams[0].userId,
                name: teams[0].teamName,
                userId: teams[0].userId,
                score: 0, wickets: 0, overs: 0, balls: 0, extras: 0, runRate: 0,
                players: teams[0].squad.length > 0
                    ? teams[0].squad.map((s: { player: { id: string; name: string; role: string; battingSkill: number; bowlingSkill: number } }) => ({
                        id: s.player.id || Math.random().toString(),
                        name: s.player.name,
                        role: s.player.role || 'BATSMAN',
                        battingSkill: s.player.battingSkill || 50,
                        bowlingSkill: s.player.bowlingSkill || 30,
                    }))
                    : generateDefaultPlayers(teams[0].teamName),
            };

            const awayTeam = {
                teamId: teams[1].userId,
                name: teams[1].teamName,
                userId: teams[1].userId,
                score: 0, wickets: 0, overs: 0, balls: 0, extras: 0, runRate: 0,
                players: teams[1].squad.length > 0
                    ? teams[1].squad.map((s: { player: { id: string; name: string; role: string; battingSkill: number; bowlingSkill: number } }) => ({
                        id: s.player.id || Math.random().toString(),
                        name: s.player.name,
                        role: s.player.role || 'BATSMAN',
                        battingSkill: s.player.battingSkill || 50,
                        bowlingSkill: s.player.bowlingSkill || 30,
                    }))
                    : generateDefaultPlayers(teams[1].teamName),
            };

            const res = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'init',
                    roomCode: code,
                    homeTeam,
                    awayTeam,
                    pitchType: 'BALANCED',
                }),
            });

            const data = await res.json();
            if (data.state) setMatch(data.state);
        } catch (err) {
            console.error('Failed to init match:', err);
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
                    } else { router.push('/login'); return; }
                } catch { router.push('/login'); return; }
            }

            const roomRes = await fetch(`/api/rooms/${code}`);
            if (roomRes.ok) {
                const roomData = await roomRes.json();
                setHostId(roomData.room.hostId);
            }

            // Check existing match or init
            const matchRes = await fetch(`/api/match?matchId=${code}`);
            if (matchRes.ok) {
                const matchData = await matchRes.json();
                if (matchData.state) {
                    setMatch(matchData.state);
                    setLoading(false);
                    return;
                }
            }

            await initMatch();
            setLoading(false);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Polling for non-host users
    useEffect(() => {
        if (match?.matchId && userId !== hostId) {
            const interval = setInterval(() => fetchMatch(match.matchId), 2000);
            return () => clearInterval(interval);
        }
    }, [match?.matchId, userId, hostId, fetchMatch]);

    const simulateBall = async () => {
        if (!match || simulating) return;
        setSimulating(true);
        try {
            const res = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ball', matchId: match.matchId }),
            });
            const data = await res.json();
            if (data.state) setMatch(data.state);
        } catch (err) {
            console.error('Ball simulation failed:', err);
        } finally {
            setSimulating(false);
        }
    };

    // Auto-play
    useEffect(() => {
        if (autoPlay && match && match.status !== 'completed' && userId === hostId) {
            const timeout = setTimeout(simulateBall, 800);
            return () => clearTimeout(timeout);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoPlay, match, userId, hostId]);

    const isHost = hostId === userId;

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
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {match?.status === 'completed' ? '🏆 Match Complete' : '⚡ Live Match'}
                        </h1>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Room: <span className="font-mono gold-text">{code}</span>
                        </p>
                    </div>

                    {isHost && match?.status !== 'completed' && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAutoPlay(!autoPlay)}
                                className={autoPlay ? 'btn-danger' : 'btn-secondary'}
                            >
                                {autoPlay ? '⏸ Pause' : '▶ Auto Play'}
                            </button>
                            <button
                                onClick={simulateBall}
                                disabled={simulating || autoPlay}
                                className="btn-primary"
                            >
                                {simulating ? 'Bowling...' : 'Next Ball →'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Scorecards */}
                    <div className="lg:col-span-3 grid md:grid-cols-2 gap-4">
                        <ScoreCard
                            teamName={match?.homeTeam.name || 'Home Team'}
                            score={match?.homeTeam.score || 0}
                            wickets={match?.homeTeam.wickets || 0}
                            overs={match?.homeTeam.overs || 0}
                            balls={match?.homeTeam.balls || 0}
                            runRate={match?.homeTeam.runRate || 0}
                            isCurrentBatting={match?.currentBatting === 'home'}
                            target={match?.currentBatting === 'home' ? match?.target : null}
                        />
                        <ScoreCard
                            teamName={match?.awayTeam.name || 'Away Team'}
                            score={match?.awayTeam.score || 0}
                            wickets={match?.awayTeam.wickets || 0}
                            overs={match?.awayTeam.overs || 0}
                            balls={match?.awayTeam.balls || 0}
                            runRate={match?.awayTeam.runRate || 0}
                            isCurrentBatting={match?.currentBatting === 'away'}
                            target={match?.currentBatting === 'away' ? match?.target : null}
                        />
                    </div>

                    {/* Match Board */}
                    <div className="lg:col-span-2">
                        <MatchBoard
                            striker={match?.striker ? {
                                name: match.striker.player.name,
                                runs: match.striker.runs,
                                balls: match.striker.balls,
                                fours: match.striker.fours,
                                sixes: match.striker.sixes,
                            } : null}
                            nonStriker={match?.nonStriker ? {
                                name: match.nonStriker.player.name,
                                runs: match.nonStriker.runs,
                                balls: match.nonStriker.balls,
                                fours: match.nonStriker.fours || 0,
                                sixes: match.nonStriker.sixes || 0,
                            } : null}
                            bowler={match?.currentBowler ? {
                                name: match.currentBowler.player.name,
                                overs: match.currentBowler.overs,
                                runs: match.currentBowler.runs,
                                wickets: match.currentBowler.wickets,
                                economy: match.currentBowler.economy,
                            } : null}
                            commentary={match?.commentary || []}
                            matchPhase={match?.matchPhase || 'powerplay'}
                            innings={match?.innings || 1}
                            result={match?.result || null}
                        />
                    </div>

                    {/* Match Info */}
                    <div className="space-y-4">
                        <div className="panel">
                            <h4 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
                                Match Info
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
                                    <span className="font-semibold"
                                        style={{ color: match?.status === 'live' ? 'var(--color-success)' : match?.status === 'completed' ? 'var(--color-gold)' : 'var(--color-text-secondary)' }}>
                                        {match?.status?.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--color-text-muted)' }}>Innings</span>
                                    <span className="font-semibold">{match?.innings || 1} of 2</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--color-text-muted)' }}>Phase</span>
                                    <span className="font-semibold capitalize">{match?.matchPhase}</span>
                                </div>
                                {match?.target && (
                                    <div className="flex justify-between text-xs">
                                        <span style={{ color: 'var(--color-text-muted)' }}>Target</span>
                                        <span className="font-bold gold-text">{match.target}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {match?.status === 'completed' && (
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="btn-secondary w-full"
                            >
                                Back to Dashboard
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function generateDefaultPlayers(teamName: string) {
    const prefix = teamName.split(' ')[0];
    return Array.from({ length: 11 }, (_, i) => ({
        id: `${prefix}-${i}`,
        name: `${prefix} Player ${i + 1}`,
        role: i < 4 ? 'BATSMAN' : i < 7 ? 'ALL_ROUNDER' : i < 10 ? 'BOWLER' : 'WICKET_KEEPER',
        battingSkill: 50 + Math.floor(Math.random() * 40),
        bowlingSkill: 30 + Math.floor(Math.random() * 50),
    }));
}
