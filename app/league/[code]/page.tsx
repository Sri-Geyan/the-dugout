'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import { IPL_TEAMS } from '@/data/teams';
import { getSocket } from '@/lib/socket';
import PlayerAvatar from '@/components/PlayerAvatar';
import Link from 'next/link';

interface FixtureEntry {
    id: string;
    homeTeamUserId: string;
    homeTeamName: string;
    awayTeamUserId: string;
    awayTeamName: string;
    scheduledOrder: number;
    status: 'pending' | 'live' | 'completed' | 'pre_match';
    matchId?: string;
    homeScore?: number;
    homeWickets?: number;
    homeOvers?: number;
    awayScore?: number;
    awayWickets?: number;
    awayOvers?: number;
    result?: string;
}

interface TeamStanding {
    userId: string;
    teamName: string;
    teamId?: string;
    matches: number;
    wins: number;
    losses: number;
    ties: number;
    points: number;
    nrr: number;
}

interface LeagueState {
    roomCode: string;
    status: 'active' | 'completed';
    fixtures: FixtureEntry[];
    standings: TeamStanding[];
    currentMatchIndex: number;
    totalMatches: number;
    orangeCap: { playerId: string; playerName: string; teamName: string; runs: number } | null;
    purpleCap: { playerId: string; playerName: string; teamName: string; wickets: number } | null;
    mvp: { playerId: string; playerName: string; teamName: string; impactScore: number } | null;
}

type Tab = 'standings' | 'fixtures' | 'awards';

export default function LeaguePage() {
    const params = useParams();
    const code = params.code as string;
    const router = useRouter();
    const { userId, isLoggedIn, setUser } = useUserStore();

    const [league, setLeague] = useState<LeagueState | null>(null);
    const [loading, setLoading] = useState(true);
    const [hostId, setHostId] = useState<string | null>(null);
    const [startingMatch, setStartingMatch] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('standings');
    const [liveMatchNotification, setLiveMatchNotification] = useState<{
        fixtureId: string;
        homeTeam: string;
        awayTeam: string;
        isUserPlaying: boolean;
    } | null>(null);

    const fetchLeague = useCallback(async () => {
        try {
            const res = await fetch(`/api/league?roomCode=${code}`);
            if (res.ok) {
                const data = await res.json();
                if (data.state) setLeague(data.state);
            }
        } catch (err) {
            console.error('Failed to fetch league:', err);
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

            await fetchLeague();
            setLoading(false);
        };
        init();
    }, [isLoggedIn, code, router, setUser, fetchLeague]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        socket.emit('join-room', code);

        socket.on('league_update', (data: any) => {
            if (data.state) setLeague(data.state);
        });

        socket.on('match_started', (data: any) => {
            const { fixture, homeTeamUserId, awayTeamUserId } = data;
            const isUserPlaying = userId === homeTeamUserId || userId === awayTeamUserId;
            
            setLiveMatchNotification({
                fixtureId: fixture.id,
                homeTeam: fixture.homeTeamName,
                awayTeam: fixture.awayTeamName,
                isUserPlaying
            });

            if (isUserPlaying) {
                // Auto-redirect players after a short delay
                setTimeout(() => {
                    router.push(`/match/${code}?fixtureId=${fixture.id}`);
                }, 3000);
            }
        });

        return () => {
            socket.off('league_update');
            socket.off('match_started');
        };
    }, [code, userId, router]);

    const handleStartMatch = async () => {
        if (!league || startingMatch) return;
        setStartingMatch(true);
        try {
            const res = await fetch('/api/league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'startMatch',
                    roomCode: code,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.fixture) {
                    // Navigate to match page with fixture context
                    router.push(`/match/${code}?fixtureId=${data.fixture.id}`);
                }
            }
        } catch (err) {
            console.error('Start match failed:', err);
        } finally {
            setStartingMatch(false);
        }
    };

    const isHost = hostId === userId;
    const nextFixture = league?.fixtures.find(f => f.status === 'pending');
    const completedMatches = league?.fixtures.filter(f => f.status === 'completed').length || 0;

    const getTeamInfo = (teamName: string) => {
        return IPL_TEAMS.find(t => t.name === teamName);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="shimmer w-16 h-16 rounded-2xl" />
            </div>
        );
    }

    if (!league) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="panel text-center py-12">
                    <p style={{ color: 'var(--color-text-muted)' }}>League not found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-8" style={{ background: 'var(--color-bg-primary)' }}>
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 pt-24">
                {/* League Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">
                            {league.status === 'completed' ? '🏆 League Complete' : '⚡ League Dashboard'}
                        </h1>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Room: <span className="font-mono gold-text">{code}</span>
                            {' · '}Matches: <span className="font-semibold">{completedMatches}/{league.totalMatches}</span>
                        </p>
                    </div>

                    {isHost && league.status === 'active' && nextFixture && (
                        <button
                            onClick={handleStartMatch}
                            disabled={startingMatch}
                            className="btn-primary"
                        >
                            {startingMatch ? 'Starting...' : `Start Match ${nextFixture.scheduledOrder} →`}
                        </button>
                    )}
                </div>

                {/* Caps Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Orange Cap */}
                    <div className="panel" style={{ borderLeft: '4px solid #FF6B00' }}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🧢</span>
                            <div className="flex-1">
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#FF6B00' }}>Orange Cap</p>
                                {league.orangeCap ? (
                                    <>
                                        <p className="text-sm font-bold text-white">{league.orangeCap.playerName}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                            {league.orangeCap.teamName} · {league.orangeCap.runs} runs
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No matches yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Purple Cap */}
                    <div className="panel" style={{ borderLeft: '4px solid #8B5CF6' }}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🧢</span>
                            <div className="flex-1">
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#8B5CF6' }}>Purple Cap</p>
                                {league.purpleCap ? (
                                    <>
                                        <p className="text-sm font-bold text-white">{league.purpleCap.playerName}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                            {league.purpleCap.teamName} · {league.purpleCap.wickets} wickets
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No matches yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MVP */}
                    <div className="panel" style={{ borderLeft: '4px solid var(--color-gold)' }}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⭐</span>
                            <div className="flex-1">
                                <p className="text-[10px] font-semibold tracking-wider uppercase gold-text">MVP</p>
                                {league.mvp ? (
                                    <>
                                        <p className="text-sm font-bold text-white">{league.mvp.playerName}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                            {league.mvp.teamName} · Impact: {league.mvp.impactScore}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No matches yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}>
                    {(['standings', 'fixtures', 'awards'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all capitalize"
                            style={{
                                background: activeTab === tab ? 'var(--color-bg-panel)' : 'transparent',
                                color: activeTab === tab ? 'var(--color-gold)' : 'var(--color-text-muted)',
                                boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                            }}
                        >
                            {tab === 'standings' && '📊 '}
                            {tab === 'fixtures' && '📅 '}
                            {tab === 'awards' && '🏅 '}
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ─── STANDINGS TAB ─── */}
                {activeTab === 'standings' && (
                    <div className="panel overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>#</th>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>Team</th>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase text-center" style={{ color: 'var(--color-text-muted)' }}>M</th>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase text-center" style={{ color: 'var(--color-text-muted)' }}>W</th>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase text-center" style={{ color: 'var(--color-text-muted)' }}>L</th>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase text-center" style={{ color: 'var(--color-text-muted)' }}>PTS</th>
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase text-right" style={{ color: 'var(--color-text-muted)' }}>NRR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {league.standings.map((team, idx) => {
                                    const iplTeam = getTeamInfo(team.teamName);
                                    const teamColor = iplTeam?.color || 'var(--color-gold)';
                                    const isQualified = idx < 4;
                                    return (
                                        <tr key={team.userId}
                                            className="border-b transition-colors"
                                            style={{
                                                borderColor: 'var(--color-border)',
                                                background: isQualified ? 'rgba(34, 197, 94, 0.03)' : 'transparent',
                                            }}
                                        >
                                            <td className="py-3.5 px-2">
                                                <span className="text-xs font-bold" style={{
                                                    color: isQualified ? 'var(--color-success)' : 'var(--color-text-muted)'
                                                }}>{idx + 1}</span>
                                            </td>
                                            <td className="py-3.5 px-2">
                                                <div className="flex items-center gap-2.5">
                                                    {iplTeam && (
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                                            style={{ background: `${teamColor}15` }}>
                                                            <img
                                                                src={iplTeam.logo}
                                                                alt={iplTeam.shortName}
                                                                width={22} height={22}
                                                                className="object-contain"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    (e.target as HTMLImageElement).parentElement!.textContent = iplTeam.emoji;
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-bold" style={{ color: teamColor }}>
                                                        {iplTeam?.shortName || team.teamName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-2 text-center text-xs font-mono">{team.matches}</td>
                                            <td className="py-3.5 px-2 text-center text-xs font-mono" style={{ color: 'var(--color-success)' }}>{team.wins}</td>
                                            <td className="py-3.5 px-2 text-center text-xs font-mono" style={{ color: team.losses > 0 ? 'var(--color-danger)' : undefined }}>{team.losses}</td>
                                            <td className="py-3.5 px-2 text-center">
                                                <span className="text-sm font-bold gold-text">{team.points}</span>
                                            </td>
                                            <td className="py-3.5 px-2 text-right">
                                                <span className="text-xs font-mono" style={{
                                                    color: team.nrr > 0 ? 'var(--color-success)' : team.nrr < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'
                                                }}>
                                                    {team.nrr > 0 ? '+' : ''}{team.nrr.toFixed(3)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="mt-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                            <span style={{ color: 'var(--color-success)' }}>●</span> Top 4 qualify for playoffs
                        </div>
                    </div>
                )}

                {/* ─── FIXTURES TAB ─── */}
                {activeTab === 'fixtures' && (
                    <div className="space-y-3">
                        {league.fixtures.map(fixture => {
                            const homeTeam = getTeamInfo(fixture.homeTeamName);
                            const awayTeam = getTeamInfo(fixture.awayTeamName);
                            const homeColor = homeTeam?.color || 'var(--color-gold)';
                            const awayColor = awayTeam?.color || 'var(--color-gold)';

                            return (
                                <div key={fixture.id} className="panel" style={{
                                    borderColor: fixture.status === 'live' ? 'var(--color-success)' :
                                        fixture.status === 'pre_match' ? 'var(--color-gold)' :
                                            fixture.status === 'completed' ? 'var(--color-border)' : 'var(--color-border)',
                                    opacity: fixture.status === 'completed' ? 0.7 : 1,
                                }}>
                                    <div className="flex items-center justify-between">
                                        {/* Match Number + Status */}
                                        <div className="flex items-center gap-2 mb-3 w-full justify-between">
                                            <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                                Match {fixture.scheduledOrder}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fixture.status === 'live' ? 'bg-green-500/20 text-green-400' :
                                                fixture.status === 'pre_match' ? 'bg-amber-500/20 text-amber-400' :
                                                    fixture.status === 'completed' ? 'bg-white/5 text-white/40' :
                                                        'bg-white/5 text-white/30'
                                                }`}>
                                                {fixture.status === 'live' ? '● LIVE' :
                                                    fixture.status === 'pre_match' ? '⚡ SELECTION' :
                                                        fixture.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        {/* Home Team */}
                                        <div className="flex items-center gap-2 flex-1">
                                            {homeTeam && (
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                                                    style={{ background: `${homeColor}15` }}>
                                                    <span className="text-sm">{homeTeam.emoji}</span>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: homeColor }}>
                                                    {homeTeam?.shortName || fixture.homeTeamName}
                                                </p>
                                                {fixture.status === 'completed' && (
                                                    <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                                        {fixture.homeScore}/{fixture.homeWickets} ({fixture.homeOvers})
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* VS */}
                                        <div className="px-4">
                                            <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>VS</span>
                                        </div>

                                        {/* Away Team */}
                                        <div className="flex items-center gap-2 flex-1 justify-end text-right">
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: awayColor }}>
                                                    {awayTeam?.shortName || fixture.awayTeamName}
                                                </p>
                                                {fixture.status === 'completed' && (
                                                    <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                                        {fixture.awayScore}/{fixture.awayWickets} ({fixture.awayOvers})
                                                    </p>
                                                )}
                                            </div>
                                            {awayTeam && (
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                                                    style={{ background: `${awayColor}15` }}>
                                                    <span className="text-sm">{awayTeam.emoji}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Result */}
                                    {fixture.result && (
                                        <p className="text-[10px] text-center mt-3 pt-2 border-t" style={{
                                            color: 'var(--color-text-muted)',
                                            borderColor: 'var(--color-border)',
                                        }}>
                                            {fixture.result}
                                        </p>
                                    )}

                                    {/* Actions */}
                                    <div className="mt-4 flex gap-2">
                                        {fixture.status === 'pre_match' && (
                                            (userId === fixture.homeTeamUserId || userId === fixture.awayTeamUserId) ? (
                                                <button
                                                    onClick={() => router.push(`/pre-match/${code}?fixtureId=${fixture.id}`)}
                                                    className="btn-primary w-full text-[10px] py-2"
                                                >
                                                    🏟️ Join Selection
                                                </button>
                                            ) : (
                                                <div className="w-full text-center py-2 text-[10px] font-medium opacity-50 border border-white/5 rounded-lg">
                                                    ⏳ Teams Selecting...
                                                </div>
                                            )
                                        )}
                                        {fixture.status === 'live' && (
                                            <button
                                                onClick={() => router.push(`/match/${code}?fixtureId=${fixture.id}`)}
                                                className="btn-secondary w-full text-[10px] py-2 border-green-500/50 text-green-400"
                                            >
                                                ▶️ Watch Live
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
                }

                {/* ─── AWARDS TAB ─── */}
                {
                    activeTab === 'awards' && (
                        <div className="space-y-6">
                            {/* Orange Cap Detail */}
                            <div className="panel-gold">
                                <h3 className="text-sm font-semibold tracking-wider uppercase mb-4" style={{ color: '#FF6B00' }}>
                                    🧢 Orange Cap — Most Runs
                                </h3>
                                {league.orangeCap ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: '#FF6B0015' }}>
                                                🏏
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-white">{league.orangeCap.playerName}</p>
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{league.orangeCap.teamName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold" style={{ color: '#FF6B00' }}>{league.orangeCap.runs}</p>
                                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>RUNS</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No matches played yet</p>
                                )}
                            </div>

                            {/* Purple Cap Detail */}
                            <div className="panel" style={{ border: '1px solid rgba(139, 92, 246, 0.2)', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), transparent)' }}>
                                <h3 className="text-sm font-semibold tracking-wider uppercase mb-4" style={{ color: '#8B5CF6' }}>
                                    🧢 Purple Cap — Most Wickets
                                </h3>
                                {league.purpleCap ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: '#8B5CF615' }}>
                                                🎯
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-white">{league.purpleCap.playerName}</p>
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{league.purpleCap.teamName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{league.purpleCap.wickets}</p>
                                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>WICKETS</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No matches played yet</p>
                                )}
                            </div>

                            {/* MVP Detail */}
                            <div className="panel-gold">
                                <h3 className="text-sm font-semibold tracking-wider uppercase mb-4 gold-text">
                                    ⭐ Most Valuable Player
                                </h3>
                                {league.mvp ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-gold/10">
                                                🌟
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-white">{league.mvp.playerName}</p>
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{league.mvp.teamName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold gold-text">{league.mvp.impactScore}</p>
                                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>IMPACT</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No matches played yet</p>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* League Complete Banner */}
                {
                    league.status === 'completed' && (
                        <div className="panel-gold mt-8 text-center">
                            <h2 className="text-xl font-bold gold-text mb-2">🏆 League Season Complete!</h2>
                            <p className="text-sm mb-1 text-white">
                                Champion: <span className="font-bold gold-text">{league.standings[0]?.teamName}</span>
                            </p>
                            <p className="text-xs mb-6" style={{ color: 'var(--color-text-muted)' }}>
                                {league.totalMatches} matches played
                            </p>
                            <button onClick={() => router.push('/dashboard')} className="btn-secondary">
                                Back to Dashboard
                            </button>
                        </div>
                    )
                }
            </main >

            {/* Live Match Notification Overlay */}
            {liveMatchNotification && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="panel relative overflow-hidden p-6 shadow-2xl border-2" style={{ 
                        background: 'var(--color-bg-elevated)',
                        borderColor: 'var(--color-gold)',
                    }}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50" />
                        
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                                <span className="text-[10px] font-black gold-text uppercase tracking-widest">Live Now</span>
                            </div>
                            <button 
                                onClick={() => setLiveMatchNotification(null)}
                                className="text-white/30 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-6 mb-6">
                            <div className="text-center flex-1">
                                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-2 border border-white/10">
                                    <span className="text-xl">🏏</span>
                                </div>
                                <p className="text-xs font-bold truncate">{liveMatchNotification.homeTeam}</p>
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-black opacity-20 italic">VS</span>
                            </div>
                            <div className="text-center flex-1">
                                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-2 border border-white/10">
                                    <span className="text-xl">🎯</span>
                                </div>
                                <p className="text-xs font-bold truncate">{liveMatchNotification.awayTeam}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {liveMatchNotification.isUserPlaying ? (
                                <div className="text-center">
                                    <p className="text-[10px] mb-3 animate-pulse" style={{ color: 'var(--color-text-muted)' }}>
                                        Redirecting you to the match in 3 seconds...
                                    </p>
                                    <button 
                                        onClick={() => router.push(`/match/${code}?fixtureId=${liveMatchNotification.fixtureId}`)}
                                        className="btn-primary w-full py-3 text-sm"
                                    >
                                        🏟️ Enter Stadium Now
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => router.push(`/match/${code}?fixtureId=${liveMatchNotification.fixtureId}`)}
                                    className="btn-secondary w-full py-3 text-sm border-gold/30 gold-text hover:bg-gold/10"
                                >
                                    👁️ Spectate Match
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
