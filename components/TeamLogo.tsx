'use client';

import { useState } from 'react';
import type { IPLTeam } from '@/data/teams';

interface TeamLogoProps {
    team: IPLTeam | { logo: string; emoji: string; shortName: string };
    size?: number;
    className?: string;
}

export default function TeamLogo({ team, size = 40, className = "" }: TeamLogoProps) {
    const [imgError, setImgError] = useState(false);

    if (imgError || !team.logo) {
        return (
            <span 
                className={`flex items-center justify-center font-bold ${className}`} 
                style={{ fontSize: `${size * 0.5}px` }}
            >
                {team.emoji}
            </span>
        );
    }

    return (
        <img
            src={team.logo}
            alt={team.shortName}
            width={size}
            height={size}
            className={`object-contain ${className}`}
            onError={() => setImgError(true)}
        />
    );
}
