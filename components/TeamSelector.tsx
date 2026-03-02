'use client';

import { IPL_TEAMS } from '@/data/teams';
import type { IPLTeam } from '@/data/teams';
import { useState } from 'react';

interface TeamSelectorProps {
    selectedTeamId: string | null;
    onSelect: (team: IPLTeam) => void;
    takenTeamIds: string[];
    disabled?: boolean;
}

function TeamLogo({ team, size = 48 }: { team: IPLTeam; size?: number }) {
    const [imgError, setImgError] = useState(false);
    return imgError ? (
        <span className="text-2xl">{team.emoji}</span>
    ) : (
        <img
            src={team.logo}
            alt={team.shortName}
            width={size}
            height={size}
            className="object-contain"
            onError={() => setImgError(true)}
        />
    );
}

export default function TeamSelector({ selectedTeamId, onSelect, takenTeamIds, disabled }: TeamSelectorProps) {
    return (
        <div className="panel-elevated">
            <h3 className="text-sm font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Choose Your IPL Team
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {IPL_TEAMS.map((team) => {
                    const isTaken = takenTeamIds.includes(team.id) && team.id !== selectedTeamId;
                    const isSelected = team.id === selectedTeamId;

                    return (
                        <button
                            key={team.id}
                            onClick={() => !isTaken && !disabled && onSelect(team)}
                            disabled={isTaken || disabled}
                            className="relative p-3 rounded-xl text-center transition-all duration-300"
                            style={{
                                background: isSelected
                                    ? `${team.color}15`
                                    : isTaken
                                        ? 'rgba(255,255,255,0.02)'
                                        : 'var(--color-bg-primary)',
                                border: isSelected
                                    ? `2px solid ${team.color}`
                                    : '2px solid transparent',
                                borderColor: isSelected ? team.color : 'var(--color-border)',
                                opacity: isTaken ? 0.35 : 1,
                                cursor: isTaken || disabled ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {/* Team Logo Image */}
                            <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden"
                                style={{
                                    background: `${team.color}12`,
                                    border: `2px solid ${team.color}40`,
                                }}>
                                <TeamLogo team={team} size={42} />
                            </div>

                            {/* Team Short Name */}
                            <p className="text-sm font-bold" style={{ color: isSelected ? team.color : 'var(--color-text-primary)' }}>
                                {team.shortName}
                            </p>
                            <p className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                                {team.city}
                            </p>

                            {/* Selected Indicator */}
                            {isSelected && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                                    style={{ background: team.color, color: '#000' }}>
                                    ✓
                                </div>
                            )}

                            {/* Taken Label */}
                            {isTaken && (
                                <div className="absolute inset-0 rounded-xl flex items-center justify-center"
                                    style={{ background: 'rgba(0,0,0,0.5)' }}>
                                    <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>TAKEN</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export { TeamLogo };
