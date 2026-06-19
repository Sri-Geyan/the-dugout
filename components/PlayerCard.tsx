'use client';

import React from 'react';
import PlayerAvatar from './PlayerAvatar';
import type { CricketPlayer } from '@/lib/playersDb';

interface PlayerCardProps {
    player: CricketPlayer;
    compact?: boolean; // For retention screen or smaller views
    showBasePrice?: boolean;
}

export default function PlayerCard({ player, compact = false, showBasePrice = true }: PlayerCardProps) {
    const roleColors: Record<string, string> = {
        BATSMAN: '#4FC3F7',
        BOWLER: '#EF5350',
        ALL_ROUNDER: '#66BB6A',
        WICKET_KEEPER: '#FFA726',
    };

    const roleLabels: Record<string, string> = {
        BATSMAN: 'Batsman',
        BOWLER: 'Bowler',
        ALL_ROUNDER: 'All-Rounder',
        WICKET_KEEPER: 'Wicket Keeper',
    };

    const roleEmoji: Record<string, string> = {
        BATSMAN: '🏏',
        BOWLER: '🎯',
        ALL_ROUNDER: '⭐',
        WICKET_KEEPER: '🧤',
    };

    const color = roleColors[player.role] || '#fff';

    return (
        <div
            className={`relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${compact ? 'p-4' : 'p-6'}`}
            style={{
                background: `linear-gradient(135deg, ${color}15 0%, rgba(20,20,20,0.8) 100%)`,
                backdropFilter: 'blur(12px)',
                border: `1px solid ${color}30`,
                boxShadow: `0 8px 32px 0 ${color}10`
            }}
        >
            {/* Background Glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: color }} />
            
            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-4 items-center">
                        <PlayerAvatar
                            name={player.name}
                            role={player.role}
                            imageUrl={`/api/player-image?name=${encodeURIComponent(player.name)}&size=${compact ? 100 : 200}`}
                            size={compact ? "lg" : "xl"}
                        />
                        <div>
                            <h3 className={`${compact ? 'text-xl' : 'text-3xl'} font-black tracking-tight text-white drop-shadow-md`}>
                                {player.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                                    background: `${color}25`,
                                    color: color,
                                    border: `1px solid ${color}40`
                                }}>
                                    {roleEmoji[player.role]} {roleLabels[player.role] || player.role}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{
                                    background: player.nationality === 'Indian' ? 'rgba(255, 153, 51, 0.15)' : 'rgba(79, 195, 247, 0.15)',
                                    color: player.nationality === 'Indian' ? '#FF9933' : '#4FC3F7',
                                    border: `1px solid ${player.nationality === 'Indian' ? '#FF993340' : '#4FC3F740'}`,
                                }}>
                                    {player.nationality === 'Indian' ? '🇮🇳 IND' : '🌍 OVS'}
                                </span>
                            </div>
                        </div>
                    </div>
                    {showBasePrice && (
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Base Price</p>
                            <p className="text-2xl font-black gold-text drop-shadow-md">₹{player.basePrice} <span className="text-sm">Cr</span></p>
                        </div>
                    )}
                </div>

                {/* Stats Section */}
                <div className={`grid gap-4 mt-6 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    
                    {/* Batting Stats */}
                    {player.battingStats && (player.role === 'BATSMAN' || player.role === 'WICKET_KEEPER' || player.role === 'ALL_ROUNDER') && (
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <h4 className="text-[10px] uppercase font-black tracking-widest mb-3 flex items-center gap-2 text-white/70">
                                <span className="text-[#4FC3F7]">🏏</span> Batting Record
                            </h4>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Mat</p>
                                    <p className="text-sm font-bold text-white">{player.battingStats.matches}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Runs</p>
                                    <p className="text-sm font-bold text-[#4FC3F7]">{player.battingStats.runs}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Avg</p>
                                    <p className="text-sm font-bold text-white">{player.battingStats.average}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">SR</p>
                                    <p className="text-sm font-bold text-[#4FC3F7]">{player.battingStats.strikeRate}</p>
                                </div>
                            </div>
                            {!compact && (
                                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5 text-center">
                                    <div>
                                        <p className="text-[9px] text-white/40 uppercase mb-0.5">HS</p>
                                        <p className="text-xs font-bold text-white/80">{player.battingStats.highestScore || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-white/40 uppercase mb-0.5">4s</p>
                                        <p className="text-xs font-bold text-white/80">{player.battingStats.fours}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-white/40 uppercase mb-0.5">6s</p>
                                        <p className="text-xs font-bold text-white/80">{player.battingStats.sixes}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bowling Stats */}
                    {player.bowlingStats && (player.role === 'BOWLER' || player.role === 'ALL_ROUNDER') && (
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <h4 className="text-[10px] uppercase font-black tracking-widest mb-3 flex items-center gap-2 text-white/70">
                                <span className="text-[#EF5350]">🎯</span> Bowling Record
                            </h4>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Mat</p>
                                    <p className="text-sm font-bold text-white">{player.bowlingStats.matches}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Wkts</p>
                                    <p className="text-sm font-bold text-[#EF5350]">{player.bowlingStats.wickets}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Econ</p>
                                    <p className="text-sm font-bold text-white">{player.bowlingStats.economy}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase mb-0.5">Avg</p>
                                    <p className="text-sm font-bold text-[#EF5350]">{player.bowlingStats.average}</p>
                                </div>
                            </div>
                            {!compact && (
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/5 text-center">
                                    <div>
                                        <p className="text-[9px] text-white/40 uppercase mb-0.5">Best Bowling</p>
                                        <p className="text-xs font-bold text-white/80">{player.bowlingStats.bestWickets}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-white/40 uppercase mb-0.5">Overs</p>
                                        <p className="text-xs font-bold text-white/80">{player.bowlingStats.overs}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Legacy Skills (Fallback or small footprint) */}
                <div className="flex gap-4 mt-4 text-[10px] uppercase font-black tracking-widest text-white/30 justify-center">
                    {(player.role === 'BATSMAN' || player.role === 'WICKET_KEEPER' || player.role === 'ALL_ROUNDER') && (
                        <span>Base BAT: {player.battingSkill}</span>
                    )}
                    {player.role === 'ALL_ROUNDER' && <span>•</span>}
                    {(player.role === 'BOWLER' || player.role === 'ALL_ROUNDER') && (
                        <span>Base BOWL: {player.bowlingSkill}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
