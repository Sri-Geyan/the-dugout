'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import { IPL_TEAMS } from '@/data/teams';
import { getSocket } from '@/lib/socket';
import TeamLogo from '@/components/TeamLogo';
import Link from 'next/link';

function FixtureCard({ fixture, userId, code, router, isHost, onSkip, onViewScorecard }: { fixture: FixtureEntry, userId: string | null, code: string, router: any, isHost: boolean, onSkip: (id: string) => void, onViewScorecard: (id: string) => void }) {
    const [skipping, setSkipping] = useState(false);

    const handleSkip = async () => {
        if (skipping) return;
        setSkipping(true);
        await onSkip(fixture.id);
        setSkipping(false);
    };

    const getTeamInfo = (teamName: string) => IPL_TEAMS.find(t => t.name === teamName || t.shortName === teamName || t.id === teamName);
    
    const homeTeam = getTeamInfo(fixture.homeTeamName);
    const awayTeam = getTeamInfo(fixture.awayTeamName);
    const homeColor = homeTeam?.color || 'var(--color-gold)';
    const awayColor = awayTeam?.color || 'var(--color-gold)';

    const getFixtureLabel = (fixture: FixtureEntry) => {
        if (fixture.isKnockout) {
            if (fixture.knockoutType === 'Q1') return 'Qualifier 1';
            if (fixture.knockoutType === 'ELIM') return 'Eliminator';
            if (fixture.knockoutType === 'Q2') return 'Qualifier 2';
            if (fixture.knockoutType === 'FINAL') return 'Final';
        }
        return `Match ${fixture.scheduledOrder}`;
    };

    return (
        <div key={fixture.id} className="panel" style={{
            borderColor: fixture.status === 'live' ? 'var(--color-success)' :
                fixture.status === 'pre_match' ? 'var(--color-gold)' :
                    fixture.status === 'completed' ? 'var(--color-border)' : 'var(--color-border)',
            opacity: fixture.status === 'completed' ? 0.7 : 1,
            background: fixture.isKnockout ? 'rgba(212, 175, 55, 0.03)' : 'var(--color-bg-panel)',
        }}>
            <div className="flex items-center justify-between">
                {/* Match Number + Status */}
                <div className="flex items-center gap-2 mb-3 w-full justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: fixture.isKnockout ? 'var(--color-gold)' : 'var(--color-text-muted)' }}>
                        {getFixtureLabel(fixture)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fixture.status === 'live' ? 'bg-green-500/20 text-green-400' :
                        fixture.status === 'pre_match' ? 'bg-amber-500/20 text-amber-400' :
                            fixture.status === 'completed' ? 'bg-white/5 text-white/40' :
                                'bg-white/5 text-white/30'
                        }`}>
                        {fixture.status === 'live' ? '● LIVE' :
                            fixture.status === 'pre_match' ? '⚡ SELECTION' :
                                fixture.status === 'pending' && fixture.isKnockout && !fixture.homeTeamUserId ? 'TBD' :
                                fixture.status.toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between">
                {/* Home Team */}
                <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center border border-white/5"
                        style={{ background: homeTeam ? `${homeColor}15` : 'rgba(255,255,255,0.02)' }}>
                        <TeamLogo team={homeTeam || { logo: '', emoji: '❔', shortName: '?' }} size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold" style={{ color: homeTeam ? homeColor : 'var(--color-text-muted)' }}>
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
                    <span className="text-[10px] font-black opacity-20 tracking-tighter">VS</span>
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-2 flex-1 justify-end text-right">
                    <div>
                        <p className="text-sm font-bold" style={{ color: awayTeam ? awayColor : 'var(--color-text-muted)' }}>
                            {awayTeam?.shortName || fixture.awayTeamName}
                        </p>
                        {fixture.status === 'completed' && (
                            <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                {fixture.awayScore}/{fixture.awayWickets} ({fixture.awayOvers})
                            </p>
                        )}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center border border-white/5"
                        style={{ background: awayTeam ? `${awayColor}15` : 'rgba(255,255,255,0.02)' }}>
                        <TeamLogo team={awayTeam || { logo: '', emoji: '❔', shortName: '?' }} size={24} />
                    </div>
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
                {fixture.status === 'completed' && (
                    <button
                        onClick={() => onViewScorecard(fixture.matchId!)}
                        className="btn-secondary w-full text-[10px] py-2 border-amber-500/50 text-amber-400 group-hover:border-amber-400 transition-all"
                    >
                        📝 View Scorecard
                    </button>
                )}

                {/* Host Skip Button */}
                {isHost && fixture.status !== 'completed' && (
                    <button
                        onClick={handleSkip}
                        disabled={skipping}
                        className="btn-secondary px-3 text-[10px] py-2 border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all flex items-center gap-1"
                        title="Simulate Match to Completion"
                    >
                        {skipping ? '⏳...' : '⏭️ Skip'}
                    </button>
                )}
            </div>
        </div>
    );
}

interface FixtureEntry {
    id: string;
    homeTeamUserId: string;
    homeTeamName: string;
    awayTeamUserId: string;
    awayTeamName: string;
    scheduledOrder: number;
    status: 'pending' | 'live' | 'completed' | 'pre_match';
    isKnockout?: boolean;
    knockoutType?: 'Q1' | 'ELIM' | 'Q2' | 'FINAL';
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

interface PlayerStats {
    playerId: string;
    playerName: string;
    teamName: string;
    teamId?: string;
    matches: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    wickets: number;
    oversBowled: number; // in balls
    runsConceded: number;
    catches: number;
    highestScore: number;
    centuries: number;
    halfCenturies: number;
    bestBowlingWickets: number;
    bestBowlingRuns: number;
    impactScore: number;
}

interface LeagueState {
    roomCode: string;
    status: 'active' | 'completed';
    phase: 'league' | 'playoffs';
    fixtures: FixtureEntry[];
    standings: TeamStanding[];
    playerStats: PlayerStats[];
    currentMatchIndex: number;
    totalMatches: number;
    orangeCap: { playerId: string; playerName: string; teamName: string; runs: number } | null;
    purpleCap: { playerId: string; playerName: string; teamName: string; wickets: number } | null;
    mvp: { playerId: string; playerName: string; teamName: string; impactScore: number } | null;
    teams: any[];
}

interface LeaderboardData {
    orangeCap: any[];
    purpleCap: any[];
    mvp: any[];
    highestScores: any[];
    boundaries: any[];
    sixes: any[];
    catches: any[];
    bestBowling: any[];
    economy: any[];
    strikeRate: any[];
    centuries: any[];
    halfCenturies: any[];
}

type Tab = 'standings' | 'fixtures' | 'awards' | 'squads';

function StatTable({ title, data, valueKey, label, color, limit, formatValue }: any) {
    return (
        <div className="panel flex flex-col h-full" style={{ borderLeft: `3px solid ${color}` }}>
            <h3 className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color }}>{title}</h3>
            {data.length > 0 ? (
                <div className="space-y-3 flex-1">
                    {data.slice(0, limit).map((ps: any, i: number) => (
                        <div key={ps.playerId} className="flex items-center justify-between gap-2 group">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono opacity-30 w-3">{i + 1}</span>
                                <div className="truncate">
                                    <p className="text-xs font-bold leading-none truncate group-hover:text-gold transition-colors">{ps.playerName}</p>
                                    <p className="text-[9px] opacity-40 truncate">{ps.teamName}</p>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs font-black font-mono" style={{ color }}>
                                    {formatValue ? formatValue(ps) : ps[valueKey]}
                                </p>
                                <p className="text-[8px] font-bold opacity-30 tracking-tighter">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center opacity-20 italic text-[10px]">
                    No data available
                </div>
            )}
        </div>
    );
}

function SquadCategory({ title, players, playerStats, color }: any) {
    if (players.length === 0) return null;
    return (
        <div>
            <h3 className="text-xs font-bold tracking-widest uppercase mb-4 px-2" style={{ color }}>{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((s: any) => {
                    const stats = playerStats?.find((ps: any) => ps.playerId === s.player.id);
                    return <PlayerCard key={s.player.id} player={s.player} stats={stats} color={color} />;
                })}
            </div>
        </div>
    );
}

function PlayerCard({ player, stats, color }: any) {
    const renderStats = () => {
        if (!stats || stats.matches === 0) {
            return (
                <div className="flex flex-col items-end">
                    <div className="text-[10px] font-black font-mono leading-none opacity-20">
                        0 / 0.00
                    </div>
                    <div className="text-[8px] font-bold opacity-10 uppercase tracking-tighter mt-1">No Stats</div>
                </div>
            );
        }

        if (player.role === 'BATSMAN' || player.role === 'WICKET_KEEPER') {
            const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(2) : '0.00';
            return (
                <div className="flex flex-col items-end text-right">
                    <div className="text-[11px] font-black font-mono leading-none text-white">
                        {stats.runs} <span style={{ color }} className="opacity-80">R</span>
                    </div>
                    <div className="text-[9px] font-bold opacity-40 uppercase tracking-tighter mt-1">
                        {sr} <span className="opacity-60">SR</span>
                    </div>
                </div>
            );
        }

        if (player.role === 'BOWLER') {
            const econ = stats.oversBowled > 0 ? ((stats.runsConceded / stats.oversBowled) * 6).toFixed(2) : '0.00';
            return (
                <div className="flex flex-col items-end text-right">
                    <div className="text-[11px] font-black font-mono leading-none text-white">
                        {stats.wickets} <span style={{ color }} className="opacity-80">W</span>
                    </div>
                    <div className="text-[9px] font-bold opacity-40 uppercase tracking-tighter mt-1">
                        {econ} <span className="opacity-60">ECO</span>
                    </div>
                </div>
            );
        }

        if (player.role === 'ALL_ROUNDER') {
            return (
                <div className="flex flex-col items-end text-right">
                    <div className="text-[11px] font-black font-mono leading-none text-white">
                        {stats.runs} <span className="opacity-80" style={{ color: '#FF6B00' }}>R</span>
                    </div>
                    <div className="text-[9px] font-bold text-white leading-none mt-1">
                        {stats.wickets} <span className="opacity-80" style={{ color: '#8B5CF6' }}>W</span>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="panel group flex items-center justify-between gap-4 p-4 hover:bg-white/[0.02] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-gold/30 transition-colors">
                    <span className="text-xl opacity-80 group-hover:opacity-100">{player.role === 'BATSMAN' ? '🏏' : player.role === 'BOWLER' ? '🎯' : player.role === 'ALL_ROUNDER' ? '🌟' : '🧤'}</span>
                </div>
                <div className="min-w-0">
                    <h4 className="text-sm font-bold group-hover:text-gold transition-colors truncate">{player.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] opacity-40 uppercase font-bold tracking-tighter">{player.nationality || 'Indian'}</span>
                        {player.retained && (
                            <span className="text-[8px] font-black bg-gold/20 text-gold px-1.5 py-0.5 rounded border border-gold/30 tracking-widest uppercase">
                                Retained
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Performance Stats */}
                {renderStats()}

                {/* Vertical Divider */}
                <div className="w-[1px] h-8 bg-white/5" />

                {/* Base Skills */}
                <div className="text-right flex-shrink-0">
                    <div className="text-[10px] font-black font-mono leading-none opacity-40">
                        {player.battingSkill}/{player.bowlingSkill}
                    </div>
                    <div className="text-[8px] font-bold opacity-10 uppercase tracking-tighter mt-1">S/K</div>
                </div>
            </div>
        </div>
    );
}

function ScorecardModal({ matchId, onClose }: { matchId: string, onClose: () => void }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScorecard = async () => {
            try {
                const res = await fetch(`/api/match/${matchId}/scorecard`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error('Failed to fetch scorecard:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchScorecard();
    }, [matchId]);

    if (loading) return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="shimmer w-16 h-16 rounded-2xl" />
        </div>
    );

    if (!data) return null;

    const { match, scorecard } = data;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8">
            <div className="panel w-full max-w-4xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-300">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                    ✕
                </button>

                <div className="mb-8">
                    <h2 className="text-xl font-bold mb-2">Match Scorecard</h2>
                    <p className="text-xs gold-text font-mono uppercase tracking-widest">{match.result}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <InningsTable 
                        teamName={match.homeTeam.name}
                        score={`${match.homeScore}/${match.homeWickets}`}
                        overs={match.homeOvers}
                        batting={scorecard.homeBatting}
                        bowling={scorecard.awayBowling}
                    />
                    <InningsTable 
                        teamName={match.awayTeam.name}
                        score={`${match.awayScore}/${match.awayWickets}`}
                        overs={match.awayOvers}
                        batting={scorecard.awayBatting}
                        bowling={scorecard.homeBowling}
                    />
                </div>
            </div>
        </div>
    );
}

function InningsTable({ teamName, score, overs, batting, bowling }: any) {
    const didBat = batting.filter((s: any) => s.balls > 0 || s.isOut);
    const didNotBat = batting.filter((s: any) => s.balls === 0 && !s.isOut);
    const activeBowling = bowling.filter((s: any) => s.overs > 0 || (s.balls && s.balls > 0));

    return (
        <div className="panel bg-white/[0.02]">
            <h3 className="text-sm font-bold mb-4 flex items-center justify-between">
                <span>{teamName}</span>
                <span className="font-mono">{score} ({overs})</span>
            </h3>
            
            <div className="space-y-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="border-b border-white/5 opacity-40">
                                <th className="pb-2">Batter</th>
                                <th className="pb-2 text-right">R</th>
                                <th className="pb-2 text-right">B</th>
                                <th className="pb-2 text-right">4s</th>
                                <th className="pb-2 text-right">6s</th>
                                <th className="pb-2 text-right">SR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {didBat.map((s: any) => (
                                <tr key={s.id} className="border-b border-white/5">
                                    <td className="py-2">
                                        <p className="font-bold">{s.player.name}{s.isCaptain && ' (c)'}{s.isWicketKeeper && ' (wk)'}</p>
                                        <p className="opacity-40 italic text-[9px]">{s.isOut ? s.dismissal : 'not out'}</p>
                                    </td>
                                    <td className="py-2 text-right font-mono font-bold">{s.runs}</td>
                                    <td className="py-2 text-right font-mono opacity-60">{s.balls}</td>
                                    <td className="py-2 text-right font-mono opacity-60">{s.fours}</td>
                                    <td className="py-2 text-right font-mono opacity-60">{s.sixes}</td>
                                    <td className="py-2 text-right font-mono text-gold">
                                        {s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {didNotBat.length > 0 && (
                    <div className="mt-2 py-2 border-t border-white/5">
                        <p className="text-[10px] opacity-40 mb-1">Did not bat</p>
                        <p className="text-[10px] font-medium opacity-60">
                            {didNotBat.map((s: any) => `${s.player.name}${s.isCaptain ? ' (c)' : ''}${s.isWicketKeeper ? ' (wk)' : ''}`).join(', ')}
                        </p>
                    </div>
                )}

                <div className="overflow-x-auto mt-6">
                    <table className="w-full text-left text-[11px]">
                        <thead>
                            <tr className="border-b border-white/5 opacity-40">
                                <th className="pb-2">Bowler</th>
                                <th className="pb-2 text-right">O</th>
                                <th className="pb-2 text-right">M</th>
                                <th className="pb-2 text-right">R</th>
                                <th className="pb-2 text-right">W</th>
                                <th className="pb-2 text-right">EC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeBowling.map((s: any) => (
                                <tr key={s.id} className="border-b border-white/5">
                                    <td className="py-2 font-bold">{s.player.name}{s.isCaptain && ' (c)'}{s.isWicketKeeper && ' (wk)'}</td>
                                    <td className="py-2 text-right font-mono">
                                        {typeof s.overs === 'number' ? s.overs.toFixed(1) : s.overs}
                                    </td>
                                    <td className="py-2 text-right font-mono">{s.maidens}</td>
                                    <td className="py-2 text-right font-mono">{s.runs}</td>
                                    <td className="py-2 text-right font-mono font-bold text-purple-400">{s.wickets}</td>
                                    <td className="py-2 text-right font-mono text-cyan-400">
                                        {s.overs > 0 ? (s.runs / s.overs).toFixed(2) : '0.00'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

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
    const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
    const [fetchingLeaderboard, setFetchingLeaderboard] = useState(false);
    const [selectedSquadTeamId, setSelectedSquadTeamId] = useState<string | null>(null);
    const [showScorecardId, setShowScorecardId] = useState<string | null>(null);

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

    const fetchLeaderboard = useCallback(async () => {
        if (fetchingLeaderboard) return;
        setFetchingLeaderboard(true);
        try {
            const res = await fetch(`/api/league/leaderboard?roomCode=${code}`);
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data);
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setFetchingLeaderboard(false);
        }
    }, [code, fetchingLeaderboard]);

    useEffect(() => {
        if (activeTab === 'awards' && !leaderboard) {
            fetchLeaderboard();
        }
    }, [activeTab, leaderboard, fetchLeaderboard]);

    useEffect(() => {
        if (league?.teams && !selectedSquadTeamId) {
            setSelectedSquadTeamId(league.teams[0].userId);
        }
    }, [league, selectedSquadTeamId]);

    const selectedTeam = league?.teams?.find(t => t.userId === selectedSquadTeamId);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        
        const onConnect = () => {
            console.log('[Socket] LeaguePage connected, joining room:', code);
            socket.emit('join-room', code);
        };

        if (socket.connected) onConnect();
        socket.on('connect', onConnect);

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

    const handleSkipMatch = async (fixtureId: string) => {
        try {
            const res = await fetch('/api/league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'simulateMatch',
                    roomCode: code,
                    fixtureId,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.state) setLeague(data.state);
            }
        } catch (err) {
            console.error('Skip match failed:', err);
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
                    {(['standings', 'fixtures', 'awards', 'squads'] as Tab[]).map(tab => (
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
                            {tab === 'squads' && '👥 '}
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
                                    <th className="py-3 px-2 text-[10px] font-semibold tracking-wider uppercase text-right" style={{ color: 'var(--color-text-muted)' }}>Action</th>
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
                                                            <TeamLogo team={iplTeam} size={22} />
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
                                                    color: team.nrr > 0 ? "var(--color-success)" : team.nrr < 0 ? "var(--color-danger)" : "var(--color-text-muted)"
                                                }}>
                                                    {team.nrr > 0 ? "+" : ""}{team.nrr.toFixed(3)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-2 text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedSquadTeamId(team.userId);
                                                        setActiveTab('squads');
                                                    }}
                                                    className="text-[10px] font-bold py-1 px-3 rounded-md transition-all hover:scale-105"
                                                    style={{ 
                                                        background: `${teamColor}15`, 
                                                        color: teamColor,
                                                        border: `1px solid ${teamColor}30`
                                                    }}
                                                >
                                                    View Squad
                                                </button>
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
                    <div className="space-y-6">
                        {/* Playoffs Section */}
                        {league.fixtures.some(f => f.isKnockout) && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold tracking-widest uppercase text-gold px-1">🏆 Playoffs</h3>
                                {league.fixtures.filter(f => f.isKnockout).map(fixture => (
                                    <FixtureCard 
                                        key={fixture.id} 
                                        fixture={fixture} 
                                        userId={userId} 
                                        code={code} 
                                        router={router} 
                                        isHost={isHost}
                                        onSkip={handleSkipMatch}
                                        onViewScorecard={(id) => setShowScorecardId(id)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* League Matches Section */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold tracking-widest uppercase opacity-40 px-1">📅 League Matches</h3>
                            {league.fixtures.filter(f => !f.isKnockout).map(fixture => (
                                <FixtureCard 
                                    key={fixture.id} 
                                    fixture={fixture} 
                                    userId={userId} 
                                    code={code} 
                                    router={router} 
                                    isHost={isHost}
                                    onSkip={handleSkipMatch}
                                    onViewScorecard={(id) => setShowScorecardId(id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── AWARDS TAB ─── */}
                {activeTab === 'awards' && (
                    <div className="space-y-8">
                        {/* Primary Caps (Horizontal Scroll or Grid) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <StatTable 
                                title="🧢 Orange Cap (Most Runs)"
                                data={leaderboard?.orangeCap || []}
                                valueKey="runs"
                                label="RUNS"
                                color="#FF6B00"
                                limit={10}
                            />
                            <StatTable 
                                title="🧢 Purple Cap (Most Wickets)"
                                data={leaderboard?.purpleCap || []}
                                valueKey="wickets"
                                label="WICKETS"
                                color="#8B5CF6"
                                limit={10}
                            />
                            <StatTable 
                                title="⭐ Most Valuable Player"
                                data={leaderboard?.mvp || []}
                                valueKey="impactScore"
                                label="IMPACT"
                                color="var(--color-gold)"
                                limit={10}
                            />
                        </div>

                        {/* Secondary Stat Grids (Top 5s) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatTable 
                                title="🔥 Highest Scores"
                                data={leaderboard?.highestScores || []}
                                valueKey="highestScore"
                                label="RUNS"
                                color="#EC4899"
                                limit={5}
                            />
                            <StatTable 
                                title="🏏 Boundaries (4s)"
                                data={leaderboard?.boundaries || []}
                                valueKey="fours"
                                label="FOURS"
                                color="#10B981"
                                limit={5}
                            />
                            <StatTable 
                                title="🚀 Sixes (6s)"
                                data={leaderboard?.sixes || []}
                                valueKey="sixes"
                                label="SIXES"
                                color="#3B82F6"
                                limit={5}
                            />
                            <StatTable 
                                title="🧤 Most Catches"
                                data={leaderboard?.catches || []}
                                valueKey="catches"
                                label="CATCHES"
                                color="#F59E0B"
                                limit={5}
                            />
                        </div>

                        {/* Bowling & Rate Grids */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatTable 
                                title="🎯 Best Bowling"
                                data={leaderboard?.bestBowling || []}
                                valueKey="bestBowling"
                                label="FIG"
                                color="#F43F5E"
                                limit={5}
                                formatValue={(ps: any) => `${ps.bestBowlingWickets}/${ps.bestBowlingRuns}`}
                            />
                            <StatTable 
                                title="📉 Best Economy"
                                data={leaderboard?.economy || []}
                                valueKey="economy"
                                label="ECON"
                                color="#A855F7"
                                limit={5}
                                formatValue={(ps: any) => ((ps.runsConceded / ps.oversBowled) * 6).toFixed(2)}
                            />
                            <StatTable 
                                title="⚡ Strike Rate"
                                data={leaderboard?.strikeRate || []}
                                valueKey="strikeRate"
                                label="S/R"
                                color="#0EA5E9"
                                limit={5}
                                formatValue={(ps: any) => ((ps.runs / ps.balls) * 100).toFixed(2)}
                            />
                            <div className="space-y-4">
                                <StatTable 
                                    title="💯 Centuries (100s)"
                                    data={leaderboard?.centuries || []}
                                    valueKey="centuries"
                                    label="100s"
                                    color="#FFD700"
                                    limit={3}
                                />
                                <StatTable 
                                    title="半 Half-Centuries (50s)"
                                    data={leaderboard?.halfCenturies || []}
                                    valueKey="halfCenturies"
                                    label="50s"
                                    color="#C0C0C0"
                                    limit={3}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SQUADS TAB ─── */}
                {activeTab === 'squads' && (
                    <div className="space-y-8">
                        {/* Team Selector */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {league.teams.map(team => {
                                const iplTeam = getTeamInfo(team.teamName);
                                const isSelected = selectedSquadTeamId === team.userId;
                                return (
                                    <button
                                        key={team.userId}
                                        onClick={() => setSelectedSquadTeamId(team.userId)}
                                        className="panel flex-shrink-0 flex items-center gap-3 py-3 px-6 transition-all hover:scale-105"
                                        style={{
                                            borderColor: isSelected ? (iplTeam?.color || 'var(--color-gold)') : 'var(--color-border)',
                                            background: isSelected ? `${iplTeam?.color}10` : 'var(--color-bg-panel)',
                                            borderWidth: isSelected ? '2px' : '1px',
                                        }}
                                    >
                                        <TeamLogo team={iplTeam || { logo: '', emoji: '🏏', shortName: team.teamName }} size={24} />
                                        <div className="text-left">
                                            <p className="text-xs font-bold leading-tight" style={{ color: isSelected ? (iplTeam?.color || 'white') : 'white' }}>
                                                {iplTeam?.shortName || team.teamName}
                                            </p>
                                            <p className="text-[10px] opacity-40 uppercase tracking-tighter">
                                                {team.squad.length} Players
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Squad Display */}
                        {selectedTeam && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <SquadCategory 
                                    title="⚡ Batters" 
                                    players={selectedTeam.squad.filter((s: any) => s.player.role === 'BATSMAN')} 
                                    playerStats={league.playerStats}
                                    color="#FF6B00"
                                />
                                <SquadCategory 
                                    title="🧤 Wicketkeepers" 
                                    players={selectedTeam.squad.filter((s: any) => s.player.role === 'WICKET_KEEPER')} 
                                    playerStats={league.playerStats}
                                    color="#3B82F6"
                                />
                                <SquadCategory 
                                    title="🌟 All-rounders" 
                                    players={selectedTeam.squad.filter((s: any) => s.player.role === 'ALL_ROUNDER')} 
                                    playerStats={league.playerStats}
                                    color="var(--color-gold)"
                                />
                                <SquadCategory 
                                    title="🎯 Bowlers" 
                                    players={selectedTeam.squad.filter((s: any) => s.player.role === 'BOWLER')} 
                                    playerStats={league.playerStats}
                                    color="#8B5CF6"
                                />
                            </div>
                        )}
                    </div>
                )}
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
            {showScorecardId && (
                <ScorecardModal 
                    matchId={showScorecardId} 
                    onClose={() => setShowScorecardId(null)} 
                />
            )}
        </div >
    );
}
