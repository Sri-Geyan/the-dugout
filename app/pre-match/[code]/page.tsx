'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getPitchProfile, PITCH_TYPES, PitchProfile } from '@/lib/pitchData';
import { getTeamByName } from '@/data/teams';
import TeamLogo from '@/components/TeamLogo';
import { getSocket } from '@/lib/socket';

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

interface TossResult {
    winnerId: string;
    winnerName: string;
    decision: 'bat' | 'bowl' | null;
    coinSide: 'heads' | 'tails';
}

const roleColors: Record<string, string> = {
    BATSMAN: '#4FC3F7',
    BOWLER: '#EF5350',
    ALL_ROUNDER: '#66BB6A',
    WICKET_KEEPER: '#FFA726',
};
const roleEmoji: Record<string, string> = {
    BATSMAN: '🏏',
    BOWLER: '🎯',
    ALL_ROUNDER: '⭐',
    WICKET_KEEPER: '🧤',
};

function RatingBar({ value, color }: { value: number; color: string }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-5 h-1.5 rounded-full"
                    style={{ background: i <= value ? color : 'rgba(255,255,255,0.1)' }} />
            ))}
        </div>
    );
}

export default function PreMatchSelectionPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const code = params.code as string;
    const fixtureId = searchParams.get('fixtureId');
    const router = useRouter();
    const { userId, isLoggedIn, setUser } = useUserStore();

    const [myTeam, setMyTeam] = useState<TeamData | null>(null);
    const [opponentTeam, setOpponentTeam] = useState<TeamData | null>(null);
    const [homeTeamName, setHomeTeamName] = useState<string>('');
    const [tossResult, setTossResult] = useState<TossResult | null>(null);
    const [tossDecisionPending, setTossDecisionPending] = useState(false);
    const [tossLoading, setTossLoading] = useState(false);
    const [matchId, setMatchId] = useState('');

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [battingOrder, setBattingOrder] = useState<string[]>([]);
    const [captainId, setCaptainId] = useState<string>('');
    const [wkId, setWkId] = useState<string>('');
    const [openingBowlerId, setOpeningBowlerId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [locked, setLocked] = useState(false);
    const [opponentLocked, setOpponentLocked] = useState(false);
    const [error, setError] = useState('');
    const [pitchProfile, setPitchProfile] = useState<PitchProfile | null>(null);
    const [isHost, setIsHost] = useState(false);

    // Phase: 'toss' | 'decision' | 'selection' | 'waiting'
    const [phase, setPhase] = useState<'toss' | 'decision' | 'selection' | 'waiting'>('toss');

    useEffect(() => {
        const init = async () => {
            try {
                let currentUserId = userId;
                if (!isLoggedIn) {
                    try {
                        const res = await fetch('/api/auth/me');
                        if (res.ok) {
                            const data = await res.json();
                            setUser(data.userId, data.username);
                            currentUserId = data.userId;
                        } else { router.push('/login'); return; }
                    } catch { router.push('/login'); return; }
                }

                if (!currentUserId) return;

                const auctionRes = await fetch(`/api/auction?roomCode=${code}`);
                if (!auctionRes.ok) throw new Error(`Auction API failed: ${auctionRes.status}`);
                const auctionData = await auctionRes.json();
                const auction = auctionData.state;
                if (!auction) throw new Error("No auction state found");

                let resolvedMyTeam = null;

                if (fixtureId) {
                    const leagueRes = await fetch(`/api/league?roomCode=${code}`);
                    if (leagueRes.ok) {
                        const leagueData = await leagueRes.json();
                        if (leagueData.hostId === currentUserId) setIsHost(true);
                        
                        const fixture = leagueData.state?.fixtures?.find((f: any) => String(f.id) === String(fixtureId));
                        if (fixture) {
                            const h = auction.teams.find((t: TeamData) => t.userId === fixture.homeTeamUserId) ?? null;
                            const a = auction.teams.find((t: TeamData) => t.userId === fixture.awayTeamUserId) ?? null;

                            if (h?.userId === currentUserId) { setMyTeam(h); setOpponentTeam(a); resolvedMyTeam = h; }
                            else if (a?.userId === currentUserId) { setMyTeam(a); setOpponentTeam(h); resolvedMyTeam = a; }
                            else {
                                setMyTeam(h);
                                setOpponentTeam(a);
                                resolvedMyTeam = h;
                            }

                            setHomeTeamName(h?.teamName ?? '');
                            setPitchProfile(getPitchProfile(h?.teamName ?? ''));
                        }
                    }
                }

                if (!fixtureId) {
                    const myT = auction.teams.find((t: TeamData) => t.userId === currentUserId);
                    if (myT) {
                        setMyTeam(myT);
                        resolvedMyTeam = myT;
                        setHomeTeamName(myT.teamName);
                        setPitchProfile(getPitchProfile(myT.teamName));
                    }
                }

                // Check if toss already happened
                if (fixtureId) {
                    const tossRes = await fetch(`/api/match?action=getToss&roomCode=${code}&fixtureId=${fixtureId}`);
                    if (tossRes.ok) {
                        const tossData = await tossRes.json();
                        if (tossData.toss) {
                            setTossResult(tossData.toss);
                            setMatchId(tossData.matchId || '');
                            if (tossData.toss.decision) {
                                const selRes = await fetch(`/api/selection?roomCode=${code}&fixtureId=${fixtureId}&teamId=${currentUserId}`);
                                if (selRes.ok) {
                                    const selData = await selRes.json();
                                    if (selData.selectedIds?.length === 11) {
                                        setSelectedIds(selData.selectedIds);
                                        setBattingOrder(selData.battingOrder || selData.selectedIds);
                                        setCaptainId(selData.captainId || '');
                                        setWkId(selData.wkId || '');
                                        setOpeningBowlerId(selData.openingBowlerId || '');
                                        setLocked(true);
                                        setPhase('waiting');
                                    } else {
                                        setPhase('selection');
                                    }
                                } else {
                                    setPhase('selection');
                                }
                            } else if (tossData.toss.winnerId === currentUserId || (resolvedMyTeam && tossData.toss.winnerName === (resolvedMyTeam as any).teamName)) {
                                setTossDecisionPending(true);
                                setPhase('decision');
                            } else {
                                setPhase('decision');
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Selection init error:", err);
                setError("Failed to initialize selection page.");
            } finally {
                setLoading(false);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll for toss result and opponent lock
    useEffect(() => {
        if (loading) return;
        
        // --- 1. Polling Logic (Fallback) ---
        const interval = setInterval(async () => {
            // A. Poll for toss/decision if not complete
            if (!tossResult || !tossResult.decision) {
                const res = await fetch(`/api/match?action=getToss&roomCode=${code}&fixtureId=${fixtureId}`);
                if (res.ok) {
                    const d = await res.json();
                    if (d.toss) {
                        setTossResult(d.toss);
                        setMatchId(d.matchId || '');
                        
                        if (d.toss.decision) {
                            if (phase !== 'selection' && phase !== 'waiting') setPhase('selection');
                        } else if (d.toss.winnerId) {
                            if (phase !== 'decision') {
                                if (d.toss.winnerId === userId || (myTeam && d.toss.winnerName === myTeam.teamName)) setTossDecisionPending(true);
                                setPhase('decision');
                            }
                        }
                    }
                }
            }

            // B. Poll for opponent lock if I am waiting
            if (phase === 'waiting' && opponentTeam) {
                const res = await fetch(`/api/selection?roomCode=${code}${fixtureId ? `&fixtureId=${fixtureId}` : ''}&teamId=${opponentTeam.userId}`);
                if (res.ok) {
                    const d = await res.json();
                    if (d.selectedIds?.length === 11) setOpponentLocked(true);
                }
            }

            // C. Poll for fixture status (redirection fallback)
            const leagueRes = await fetch(`/api/league?roomCode=${code}`);
            if (leagueRes.ok) {
                const d = await leagueRes.json();
                const f = d.state?.fixtures?.find((fx: any) => String(fx.id) === String(fixtureId));
                if (f && (f.status === 'live' || f.status === 'completed')) {
                    router.push(`/match/${code}?fixtureId=${fixtureId}`);
                }
            }
        }, 2500);

        // --- 2. Socket Logic (Real-time) ---
        const socket = getSocket();
        
        socket.emit('join_room', code);

        const handleMatchUpdate = (data: any) => {
            if (data.toss) {
                setTossResult(data.toss);
                if (data.matchId) setMatchId(data.matchId);
                
                if (data.toss.decision) {
                    setPhase('selection');
                } else if (data.toss.winnerId) {
                    if (data.toss.winnerId === userId || (myTeam && data.toss.winnerName === myTeam.teamName)) setTossDecisionPending(true);
                    setPhase('decision');
                }
            }
        };

        const handleLeagueUpdate = (data: any) => {
            // Reload fixture info if league updates (e.g. status changes)
            if (data.state?.fixtures) {
                const f = data.state.fixtures.find((fx: any) => String(fx.id) === String(fixtureId));
                if (f) {
                    if (f.matchId && f.matchId !== matchId) setMatchId(f.matchId);
                    if (f.status === 'live' || f.status === 'completed') {
                        router.push(`/match/${code}?fixtureId=${fixtureId}`);
                    }
                }
            }
        };

        socket.on('match_update', handleMatchUpdate);
        socket.on('selection_update', () => {
            if (phase === 'waiting' && opponentTeam) {
                // Trigger a quick poll for opponent status
                fetch(`/api/selection?roomCode=${code}${fixtureId ? `&fixtureId=${fixtureId}` : ''}&teamId=${opponentTeam.userId}`)
                    .then(res => res.json())
                    .then(d => {
                        if (d.selectedIds?.length === 11) setOpponentLocked(true);
                    });
            }
        });
        socket.on('league_update', handleLeagueUpdate);

        return () => {
            clearInterval(interval);
            socket.off('match_update', handleMatchUpdate);
            socket.off('selection_update');
            socket.off('league_update', handleLeagueUpdate);
        };
    }, [loading, phase, tossResult, opponentTeam, userId, code, fixtureId, matchId]);

    const handleToss = async () => {
        setTossLoading(true);
        try {
            const res = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toss',
                    roomCode: code,
                    fixtureId,
                    homeTeam: { userId: myTeam?.userId, name: myTeam?.teamName },
                    awayTeam: { userId: opponentTeam?.userId, name: opponentTeam?.teamName },
                    pitchType: pitchProfile?.pitchType || 'BALANCED',
                }),
            });
            if (res.ok) {
                const d = await res.json();
                setTossResult(d.toss);
                setMatchId(d.matchId || '');
                if (d.toss.decision) setPhase('selection');
                else if (d.toss.winnerId === userId) { setTossDecisionPending(true); setPhase('decision'); }
                else setPhase('decision');
            }
        } finally {
            setTossLoading(false);
        }
    };

    const handleTossDecision = async (decision: 'bat' | 'bowl') => {
        try {
            const res = await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'tossDecision', roomCode: code, matchId, decision }),
            });
            if (res.ok) {
                const d = await res.json();
                setTossResult(d.toss);
                setPhase('selection');
            }
        } catch (err) { console.error(err); }
    };

    const handleTogglePlayer = (playerId: string) => {
        if (locked) return;
        const willRemove = selectedIds.includes(playerId);
        if (willRemove) {
            setSelectedIds(prev => prev.filter(id => id !== playerId));
            setBattingOrder(prev => prev.filter(id => id !== playerId));
            if (captainId === playerId) setCaptainId('');
            if (wkId === playerId) setWkId('');
            if (openingBowlerId === playerId) setOpeningBowlerId('');
        } else if (selectedIds.length < 11) {
            setSelectedIds(prev => [...prev, playerId]);
            setBattingOrder(prev => [...prev, playerId]);
            
            // Auto-assign roles if first of their kind
            const p = myTeam?.squad.find(s => s.player.id === playerId);
            if (p) {
                if (!captainId) setCaptainId(playerId);
                if (!wkId && p.player.role === 'WICKET_KEEPER') setWkId(playerId);
                if (!openingBowlerId && (p.player.role === 'BOWLER' || p.player.role === 'ALL_ROUNDER')) setOpeningBowlerId(playerId);
            }
        }
    };

    const handleMoveUp = (playerId: string) => {
        setBattingOrder(prev => {
            const idx = prev.indexOf(playerId);
            if (idx <= 0) return prev;
            const n = [...prev];
            [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
            return n;
        });
    };
    const handleMoveDown = (playerId: string) => {
        setBattingOrder(prev => {
            const idx = prev.indexOf(playerId);
            if (idx < 0 || idx >= prev.length - 1) return prev;
            const n = [...prev];
            [n[idx + 1], n[idx]] = [n[idx], n[idx + 1]];
            return n;
        });
    };

    const handleLock = async () => {
        if (selectedIds.length !== 11) { setError('Select exactly 11 players'); return; }
        if (!captainId) { setError('Please select a Captain'); return; }
        if (!wkId) { setError('Please select a Wicket Keeper'); return; }
        if (!openingBowlerId) { setError('Please select an Opening Bowler'); return; }
        try {
            const res = await fetch('/api/selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode: code, teamId: userId, selectedIds, battingOrder, captainId, wkId, openingBowlerId, fixtureId: fixtureId || undefined }),
            });
            if (res.ok) { setLocked(true); setError(''); setPhase('waiting'); }
        } catch { }
    };

    const handleStartMatch = async () => {
        try {
            await fetch('/api/league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lockPreMatch', roomCode: code, fixtureId, matchId: matchId || fixtureId }),
            });
            router.push(`/match/${code}?fixtureId=${fixtureId || ''}`);
        } catch { }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="shimmer w-16 h-16 rounded-2xl" />
        </div>
    );

    const pitchType = pitchProfile ? PITCH_TYPES[pitchProfile.pitchType] : null;
    const iAmTossWinner = tossResult?.winnerId === userId || (myTeam && tossResult?.winnerName === myTeam.teamName);
    const canMakeDecision = iAmTossWinner || isHost;
    const battingFirst = tossResult?.decision === 'bat' ? iAmTossWinner : !iAmTossWinner;
    const iAmParticipant = myTeam?.userId === userId || opponentTeam?.userId === userId;

    return (
        <div className="min-h-screen pb-24" style={{ background: 'var(--color-bg-primary)' }}>
            <Navbar />
            <main className="max-w-5xl mx-auto px-4 pt-24">
                {/* ── Status Badges ── */}
                <div className="flex gap-3 mb-4">
                    {isHost && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700/50 font-black tracking-widest uppercase animate-pulse">
                            🛡️ Room Host (Override Mode)
                        </span>
                    )}
                    {(!iAmParticipant) && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/50 font-black tracking-widest uppercase">
                            👁️ Spectator Mode
                        </span>
                    )}
                </div>

                {/* ── Pitch & Stadium Info Banner ── */}
                {pitchProfile && (
                    <div className="panel mb-6 overflow-hidden" style={{ borderColor: pitchType?.color + '40' }}>
                        <div className="flex items-start gap-5 flex-wrap">
                            {/* Stadium identity */}
                            <div className="flex-1 min-w-[220px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-2xl">{pitchProfile.emoji}</span>
                                    <div>
                                        <p className="font-black text-white text-sm leading-none">{pitchProfile.stadiumName}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{pitchProfile.city}</p>
                                    </div>
                                    <span className="ml-auto text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: (pitchType?.color ?? '#888') + '20', color: pitchType?.color }}>
                                        {pitchType?.emoji} {pitchType?.label}
                                    </span>
                                </div>
                                {/* Rating bars */}
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-[10px]">
                                    <div>
                                        <div className="flex justify-between mb-0.5"><span style={{ color: 'var(--color-text-muted)' }}>Bounce</span><span className="font-bold">{pitchProfile.bounceRating}/5</span></div>
                                        <RatingBar value={pitchProfile.bounceRating} color="#EF5350" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-0.5"><span style={{ color: 'var(--color-text-muted)' }}>Turn</span><span className="font-bold">{pitchProfile.turnRating}/5</span></div>
                                        <RatingBar value={pitchProfile.turnRating} color="#CE93D8" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-0.5"><span style={{ color: 'var(--color-text-muted)' }}>Bat-Friendly</span><span className="font-bold">{pitchProfile.battingFriendly}/5</span></div>
                                        <RatingBar value={pitchProfile.battingFriendly} color="#66BB6A" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Dew Factor</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${pitchProfile.dewFactor ? 'bg-blue-900/30 text-blue-400' : 'bg-white/5 text-white/30'}`}>
                                            {pitchProfile.dewFactor ? '💧 YES' : '🚫 NO'}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                    Avg 1st Innings: <strong className="text-white">{pitchProfile.avgFirstInnings}</strong> · Avg 2nd: <strong className="text-white">{pitchProfile.avgSecondInnings}</strong>
                                </p>
                            </div>

                            {/* Key Insights */}
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-[10px] font-bold tracking-wider uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Key Insights</p>
                                <ul className="space-y-1.5">
                                    {pitchProfile.keyInsights.map((tip, i) => (
                                        <li key={i} className="text-[11px] text-white/80 leading-tight">{tip}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Toss & batting tips */}
                            <div className="flex-1 min-w-[180px] space-y-2">
                                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
                                    <p className="text-[10px] font-bold gold-text mb-1">🎲 Toss Insight</p>
                                    <p className="text-[10px] text-white/70 leading-snug">{pitchProfile.tossInsight}</p>
                                </div>
                                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(239,83,80,0.06)', border: '1px solid rgba(239,83,80,0.2)' }}>
                                    <p className="text-[10px] font-bold text-red-400 mb-1">⚡ Pace Tip</p>
                                    <p className="text-[10px] text-white/70 leading-snug">{pitchProfile.paceBowlerAdvantage}</p>
                                </div>
                                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(206,147,216,0.06)', border: '1px solid rgba(206,147,216,0.2)' }}>
                                    <p className="text-[10px] font-bold text-purple-400 mb-1">🌀 Spin Tip</p>
                                    <p className="text-[10px] text-white/70 leading-snug">{pitchProfile.spinBowlerAdvantage}</p>
                                </div>
                                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(102,187,106,0.06)', border: '1px solid rgba(102,187,106,0.2)' }}>
                                    <p className="text-[10px] font-bold text-green-400 mb-1">🏏 Batting Tip</p>
                                    <p className="text-[10px] text-white/70 leading-snug">{pitchProfile.battingTip}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Toss Phase ── */}
                {phase === 'toss' && (
                    <div className="panel text-center py-12 max-w-lg mx-auto">
                        <div className="text-6xl mb-4">🪙</div>
                        <h2 className="text-2xl font-black text-white mb-2">Toss Time!</h2>
                        <div className="flex items-center justify-center gap-4 mb-8">
                            <div className="flex flex-col items-center gap-2">
                                <TeamLogo team={getTeamByName(myTeam?.teamName || '') || { logo: '', emoji: '🏏', shortName: '?' }} size={48} />
                                <span className="text-xs font-bold">{myTeam?.teamName}</span>
                            </div>
                            <span className="text-xl font-black text-white/20">VS</span>
                            <div className="flex flex-col items-center gap-2">
                                <TeamLogo team={getTeamByName(opponentTeam?.teamName || '') || { logo: '', emoji: '🏏', shortName: '?' }} size={48} />
                                <span className="text-xs font-bold">{opponentTeam?.teamName || 'Opponent'}</span>
                            </div>
                        </div>
                        {iAmParticipant ? (
                            <button onClick={handleToss} disabled={tossLoading} className="btn-primary px-10 py-4 text-base font-black">
                                {tossLoading ? '🪙 Flipping...' : '🪙 Flip The Coin'}
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-gold)' }} />
                                Waiting for teams to flip the coin...
                            </div>
                        )}
                    </div>
                )}

                {/* ── Decision Phase (toss winner chooses) ── */}
                {phase === 'decision' && tossResult && (
                    <div className="panel text-center py-10 max-w-lg mx-auto">
                        <div className="text-5xl mb-3">{tossResult.coinSide === 'heads' ? '🟡' : '⚪'}</div>
                        <h2 className="font-black text-xl text-white mb-1">
                            {tossResult.coinSide === 'heads' ? 'Heads!' : 'Tails!'} — {iAmTossWinner ? 'You Won' : `${tossResult.winnerName} Won`} the Toss
                        </h2>
                        <p className="text-xs mb-6" style={{ color: 'var(--color-text-muted)' }}>
                            💡 {pitchProfile?.tossInsight}
                        </p>
                        {canMakeDecision ? (
                            <div className="flex gap-4 justify-center flex-wrap">
                                <button onClick={() => handleTossDecision('bat')}
                                    className="px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                                    style={{ background: 'rgba(102,187,106,0.15)', border: '2px solid #66BB6A' }}>
                                    🏏 Elect to Bat
                                </button>
                                <button onClick={() => handleTossDecision('bowl')}
                                    className="px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                                    style={{ background: 'rgba(239,83,80,0.15)', border: '2px solid #EF5350' }}>
                                    🎯 Elect to Bowl
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-gold)' }} />
                                Waiting for {tossResult.winnerName} to make the decision...
                            </div>
                        )}
                    </div>
                )}

                {/* ── Playing 11 Selection Phase ── */}
                {(phase === 'selection' || phase === 'waiting') && (
                    <>
                        {/* Toss result strip */}
                        {tossResult && (
                            <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{
                                background: 'rgba(212,175,55,0.06)',
                                border: '1px solid rgba(212,175,55,0.2)',
                            }}>
                                <div className="text-xs">
                                    <span className="font-bold gold-text">🪙 {iAmTossWinner ? 'You' : tossResult.winnerName}</span>
                                    <span style={{ color: 'var(--color-text-muted)' }}> won the toss and elected to </span>
                                    <span className="font-bold text-white">{tossResult.decision === 'bat' ? (iAmTossWinner ? 'bat first' : 'bowl first') : (iAmTossWinner ? 'bowl first' : 'bat first')}</span>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${battingFirst ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                    {battingFirst ? '🏏 You Bat First' : '🎯 You Bowl First'}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-xl font-black text-white">Playing 11 Selection</h1>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Choose your XI · Set batting order · Assign roles
                                </p>
                            </div>
                            <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${selectedIds.length === 11 ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                {selectedIds.length}/11 Selected
                            </span>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <div className="grid lg:grid-cols-5 gap-6">
                            {/* Squad Selection */}
                            <div className="lg:col-span-3">
                                <div className="panel">
                                    <div className="flex items-center gap-3 mb-4">
                                        <TeamLogo team={getTeamByName(myTeam?.teamName || '') || { logo: '', emoji: '🏏', shortName: '?' }} size={24} />
                                        <h3 className="text-sm font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                                            {myTeam?.teamName} — Full Squad ({myTeam?.squad.length} players)
                                        </h3>
                                    </div>
                                    <div className="space-y-1.5">
                                        {myTeam?.squad.map(({ player, soldPrice }) => {
                                            const isSelected = selectedIds.includes(player.id);
                                            const roleScore = player.role === 'BOWLER' || player.role === 'ALL_ROUNDER' ? player.bowlingSkill : player.battingSkill;
                                            const highlighted = pitchProfile && (
                                                (pitchProfile.pitchType === 'PACE' && player.role === 'BOWLER' && player.bowlingSkill >= 75) ||
                                                (pitchProfile.pitchType === 'SPIN' && player.role === 'BOWLER' && player.bowlingSkill >= 70) ||
                                                (pitchProfile.pitchType === 'BATTING' && player.battingSkill >= 80)
                                            );
                                            return (
                                                <div key={player.id}
                                                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${locked ? 'pointer-events-none opacity-60' : 'hover:bg-white/5'}`}
                                                    style={{
                                                        background: isSelected ? 'rgba(34,197,94,0.08)' : highlighted ? 'rgba(212,175,55,0.04)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px solid ${isSelected ? 'rgba(34,197,94,0.3)' : highlighted ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                                    }}>
                                                    {/* Selection / Order Number */}
                                                    <div 
                                                        onClick={(e) => { e.stopPropagation(); handleTogglePlayer(player.id); }}
                                                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all font-black text-xs ${
                                                            isSelected 
                                                                ? 'bg-green-500 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' 
                                                                : 'border-white/10 text-white/20 hover:border-white/30'
                                                        }`}>
                                                        {isSelected ? `#${battingOrder.indexOf(player.id) + 1}` : ''}
                                                    </div>

                                                    <PlayerAvatar name={player.name} size={32} />
                                                    <div className="flex-1 min-w-0" onClick={() => handleTogglePlayer(player.id)}>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-semibold text-sm truncate">{player.name}</p>
                                                            {highlighted && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: 'rgba(212,175,55,0.2)', color: 'var(--color-gold)' }}>★ PITCH FIT</span>}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${roleColors[player.role]}15`, color: roleColors[player.role] }}>
                                                                {roleEmoji[player.role]} {player.role.replace('_', ' ')}
                                                            </span>
                                                            {player.nationality === 'Overseas' && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">🌍 OS</span>
                                                            )}
                                                            {/* Quick Role Tags */}
                                                            {isSelected && (
                                                                <div className="flex gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                                                                    <button 
                                                                        onClick={() => setCaptainId(captainId === player.id ? '' : player.id)}
                                                                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border transition-all ${captainId === player.id ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-white/5 border-white/10 text-white/30 hover:text-white'}`}
                                                                        title="Set as Captain"
                                                                    >C</button>
                                                                    <button 
                                                                        onClick={() => setWkId(wkId === player.id ? '' : player.id)}
                                                                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border transition-all ${wkId === player.id ? 'bg-orange-500 border-orange-400 text-black' : 'bg-white/5 border-white/10 text-white/30 hover:text-white'}`}
                                                                        title="Set as Wicket Keeper"
                                                                    >WK</button>
                                                                    {(player.role === 'BOWLER' || player.role === 'ALL_ROUNDER') && (
                                                                        <button 
                                                                            onClick={() => setOpeningBowlerId(openingBowlerId === player.id ? '' : player.id)}
                                                                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border transition-all ${openingBowlerId === player.id ? 'bg-red-500 border-red-400 text-black' : 'bg-white/5 border-white/10 text-white/30 hover:text-white'}`}
                                                                            title="Set as Opening Bowler"
                                                                        >OB</button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0" onClick={() => handleTogglePlayer(player.id)}>
                                                        <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                                                            BAT {player.battingSkill} | BWL {player.bowlingSkill}
                                                        </p>
                                                        <p className="text-[10px] gold-text">₹{soldPrice} Cr</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right panel */}
                            <div className="lg:col-span-2 space-y-4">
                                {/* Role Assignment */}
                                {selectedIds.length === 11 && !locked && (
                                    <div className="panel">
                                        <h3 className="text-sm font-semibold tracking-wider uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>Assign Key Roles</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-semibold mb-1 block" style={{ color: '#FFD700' }}>🏏 Captain (C)</label>
                                                <select value={captainId} onChange={e => setCaptainId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm">
                                                    <option value="">Select Captain...</option>
                                                    {selectedIds.map(id => { const p = myTeam?.squad.find(s => s.player.id === id); return p ? <option key={id} value={id}>{p.player.name}</option> : null; })}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold mb-1 block" style={{ color: '#FFA726' }}>🧤 Wicket Keeper (WK)</label>
                                                <select value={wkId} onChange={e => setWkId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm">
                                                    <option value="">Select WK...</option>
                                                    {selectedIds.map(id => { const p = myTeam?.squad.find(s => s.player.id === id); return p ? <option key={id} value={id}>{p.player.name}</option> : null; })}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold mb-1 block" style={{ color: '#EF5350' }}>🎯 Opening Bowler</label>
                                                <select value={openingBowlerId} onChange={e => setOpeningBowlerId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm">
                                                    <option value="">Select Bowler...</option>
                                                    {selectedIds.filter(id => { const p = myTeam?.squad.find(s => s.player.id === id); return p && (p.player.role === 'BOWLER' || p.player.role === 'ALL_ROUNDER'); }).map(id => { const p = myTeam?.squad.find(s => s.player.id === id); return p ? <option key={id} value={id}>{p.player.name}</option> : null; })}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Batting Order */}
                                {selectedIds.length > 0 && (
                                    <div className="panel">
                                        <h3 className="text-sm font-semibold tracking-wider uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>Batting Order</h3>
                                        <div className="space-y-1">
                                            {battingOrder.map((id, idx) => {
                                                const p = myTeam?.squad.find(s => s.player.id === id);
                                                if (!p) return null;
                                                return (
                                                    <div key={id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--color-gold)' }}>#{idx + 1}</span>
                                                        <span className="flex-1 text-xs font-medium truncate">
                                                            {p.player.name}
                                                            {p.player.id === captainId && <span className="ml-1 text-[9px] text-yellow-400">(C)</span>}
                                                            {p.player.id === wkId && <span className="ml-1 text-[9px] text-orange-400">(WK)</span>}
                                                        </span>
                                                        <span className="text-[10px]" style={{ color: roleColors[p.player.role] }}>{roleEmoji[p.player.role]}</span>
                                                        {!locked && (
                                                            <div className="flex flex-col gap-0.5">
                                                                <button onClick={e => { e.stopPropagation(); handleMoveUp(id); }} className="text-[9px] w-4 h-3.5 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">▲</button>
                                                                <button onClick={e => { e.stopPropagation(); handleMoveDown(id); }} className="text-[9px] w-4 h-3.5 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">▼</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="space-y-3">
                                    {phase === 'selection' && !locked && (
                                        <button onClick={handleLock} disabled={selectedIds.length !== 11} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed py-3">
                                            🔒 Lock Playing 11
                                        </button>
                                    )}
                                    {phase === 'waiting' && locked && (
                                        <>
                                            <div className="text-center text-sm p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--color-success)' }}>
                                                ✅ Playing 11 Locked
                                            </div>
                                            {opponentTeam && !opponentLocked && (
                                                <div className="text-center text-xs p-2 rounded-lg" style={{ background: 'rgba(255,193,7,0.1)', color: 'var(--color-gold)' }}>
                                                    ⏳ Waiting for {opponentTeam.teamName}...
                                                </div>
                                            )}
                                            {(!opponentTeam || opponentLocked) ? (
                                                <button onClick={handleStartMatch} className="btn-primary w-full py-4 text-base font-black" style={{ animation: 'pulse 2s infinite' }}>
                                                    🏏 Start Match →
                                                </button>
                                            ) : (
                                                <div className="text-center text-xs p-3 rounded-xl opacity-60" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-muted)' }}>
                                                    ⏳ All teams must lock to start...
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
