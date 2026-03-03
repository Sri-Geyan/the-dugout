'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
    runsRequired?: number;
    ballsRemaining?: number;
    requiredRunRate?: number;
    striker: { player: { id: string; name: string }; runs: number; balls: number; fours: number; sixes: number; isOut: boolean } | null;
    nonStriker: { player: { id: string; name: string }; runs: number; balls: number; fours: number; sixes: number; isOut: boolean } | null;
    currentBowler: { player: { id: string; name: string }; overs: number; balls: number; runs: number; wickets: number; economy: number } | null;
    battingOrder: { player: { id: string; name: string }; runs: number; balls: number; fours: number; sixes: number; isOut: boolean }[];
    bowlingOrder: { player: { id: string; name: string }; overs: number; balls: number; runs: number; wickets: number; economy: number }[];
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
    const [leagueReported, setLeagueReported] = useState(false);
    const searchParams = useSearchParams();
    const fixtureId = searchParams.get('fixture');
    const reportedRef = useRef(false);

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
            // If we have a fixture ID (UUID), we let the server handle initialization
            if (fixtureId) {
                // Get league phase to check if this fixture already has a matchId
                const leagueRes = await fetch(`/api/league?roomCode=${code}`);
                if (leagueRes.ok) {
                    const leagueData = await leagueRes.json();
                    const fixture = leagueData.state.fixtures.find((f: any) => f.id === fixtureId);

                    if (fixture && fixture.matchId) {
                        // Match already exists, just fetch it
                        await fetchMatch(fixture.matchId);
                        setLoading(false);
                        return;
                    }

                    // Otherwise, initialize a new match for this fixture
                    const matchRes = await fetch('/api/match', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'init',
                            roomCode: code,
                            fixtureId: fixtureId
                        }),
                    });

                    if (matchRes.ok) {
                        const matchData = await matchRes.json();
                        setMatch(matchData.state);
                        // We also need to lock the pre-match in the league API if not already done
                        // Though this should ideally be done by the host in the pre-match screen.
                    }
                }
                setLoading(false);
                return;
            }

            // Fallback for non-fixture matches (initial quick start)
            const auctionRes = await fetch(`/api/auction?roomCode=${code}`);
            const auctionData = await auctionRes.json();

            if (!auctionData.state || auctionData.state.teams.length < 2) {
                setLoading(false);
                return;
            }

            // ... redundant old logic removed for brevity or kept as fallback ...
            const teams = auctionData.state.teams;
            const matchRes = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'init',
                    roomCode: code,
                    homeTeam: {
                        teamId: teams[0].userId,
                        name: teams[0].teamName,
                        userId: teams[0].userId,
                        players: teams[0].squad.slice(0, 11).map((s: any) => ({
                            id: s.player.id,
                            name: s.player.name,
                            role: s.player.role,
                            battingSkill: s.player.battingSkill,
                            bowlingSkill: s.player.bowlingSkill,
                        }))
                    },
                    awayTeam: {
                        teamId: teams[1].userId,
                        name: teams[1].teamName,
                        userId: teams[1].userId,
                        players: teams[1].squad.slice(0, 11).map((s: any) => ({
                            id: s.player.id,
                            name: s.player.name,
                            role: s.player.role,
                            battingSkill: s.player.battingSkill,
                            bowlingSkill: s.player.bowlingSkill,
                        }))
                    }
                }),
            });

            if (matchRes.ok) {
                const matchData = await matchRes.json();
                setMatch(matchData.state);
            }
            setLoading(false);
        } catch (err) {
            console.error('Failed to init match:', err);
            setLoading(false);
        }
    }, [code, fixtureId, fetchMatch]);

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

    // Report match result to league when completed
    useEffect(() => {
        if (match?.status === 'completed' && !reportedRef.current && userId === hostId) {
            reportedRef.current = true;
            setLeagueReported(false);
            const reportToLeague = async () => {
                try {
                    // Build batting stats from both innings
                    const battingStats = (match.battingOrder || []).map(b => ({
                        playerId: b.player.id || b.player.name,
                        playerName: b.player.name,
                        teamName: match.currentBatting === 'home' ? match.awayTeam.name : match.homeTeam.name,
                        runs: b.runs,
                        balls: b.balls,
                        fours: b.fours,
                        sixes: b.sixes,
                        isOut: b.isOut,
                    }));

                    const bowlingStats = (match.bowlingOrder || []).map(b => ({
                        playerId: b.player.id || b.player.name,
                        playerName: b.player.name,
                        teamName: match.currentBatting === 'home' ? match.homeTeam.name : match.awayTeam.name,
                        overs: b.overs,
                        balls: b.balls || 0,
                        runs: b.runs,
                        wickets: b.wickets,
                    }));

                    // Determine winner
                    let winnerUserId: string | null = null;
                    if (match.homeTeam.score > match.awayTeam.score) winnerUserId = match.homeTeam.userId;
                    else if (match.awayTeam.score > match.homeTeam.score) winnerUserId = match.awayTeam.userId;

                    await fetch('/api/league', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'completeMatch',
                            roomCode: code,
                            matchId: match.matchId,
                            matchResult: {
                                homeUserId: match.homeTeam.userId,
                                awayUserId: match.awayTeam.userId,
                                homeScore: match.homeTeam.score,
                                homeWickets: match.homeTeam.wickets,
                                homeOvers: match.homeTeam.overs,
                                homeBalls: match.homeTeam.balls,
                                awayScore: match.awayTeam.score,
                                awayWickets: match.awayTeam.wickets,
                                awayOvers: match.awayTeam.overs,
                                awayBalls: match.awayTeam.balls,
                                result: match.result,
                                winnerUserId,
                                battingStats,
                                bowlingStats,
                            },
                        }),
                    });
                    setLeagueReported(true);
                } catch (err) {
                    console.error('Failed to report to league:', err);
                }
            };
            reportToLeague();
        }
    }, [match?.status, userId, hostId, match, code]);

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
                        <div className="flex-1 min-w-[300px]">
                            <ScoreCard
                                teamName={match?.awayTeam.name || 'Away Team'}
                                score={match?.awayTeam.score || 0}
                                wickets={match?.awayTeam.wickets || 0}
                                overs={Math.floor(match?.awayTeam.overs || 0)}
                                balls={match?.awayTeam.balls || 0}
                                runRate={(match?.awayTeam.overs || 0) > 0 || (match?.awayTeam.balls || 0) > 0 ? (match!.awayTeam.score) / ((Math.floor(match!.awayTeam.overs) * 6 + match!.awayTeam.balls) / 6) : 0}
                                isCurrentBatting={match?.currentBatting === match?.awayTeam.userId}
                                target={match?.target}
                                runsRequired={match?.runsRequired}
                                ballsRemaining={match?.ballsRemaining}
                                requiredRunRate={match?.requiredRunRate}
                            />
                        </div>
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
                                onClick={() => router.push(`/league/${code}`)}
                                className="btn-primary w-full"
                            >
                                Back to League Dashboard →
                            </button>
                        )}
                        {match?.status === 'completed' && leagueReported && (
                            <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-success)' }}>
                                ✓ Results saved to league
                            </p>
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
