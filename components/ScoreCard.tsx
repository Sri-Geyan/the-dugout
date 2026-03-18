import TeamLogo from './TeamLogo';

interface ScoreCardProps {
    teamName: string;
    teamLogo?: string;
    teamEmoji?: string;
    score: number;
    wickets: number;
    overs: number;
    balls: number;
    runRate: number;
    isCurrentBatting: boolean;
    target?: number | null;
    runsRequired?: number;
    ballsRemaining?: number;
    requiredRunRate?: number;
    showFullScorecard?: boolean;
}

export default function ScoreCard({
    teamName,
    teamLogo,
    teamEmoji,
    score,
    wickets,
    overs,
    balls,
    runRate,
    isCurrentBatting,
    target,
}: ScoreCardProps) {
    const oversDisplay = `${overs}.${balls}`;

    return (
        <div className={`rounded-xl p-5 transition-all duration-300 ${isCurrentBatting ? 'panel-gold' : 'panel'} relative`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <TeamLogo team={{ logo: teamLogo || '', emoji: teamEmoji || '🏏', shortName: teamName }} size={24} />
                    <h3 className="text-sm font-bold truncate">{teamName}</h3>
                </div>
                {isCurrentBatting && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)',
                    }}>BATTING</span>
                )}
            </div>

            <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black">{score}</span>
                <span className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>/{wickets}</span>
            </div>

            <div className="flex items-center gap-4">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    ({oversDisplay} ov)
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    RR: <span className="font-semibold" style={{ color: 'var(--color-gold)' }}>{runRate}</span>
                </span>
            </div>

            {target && (
                <div className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Target: <span className="font-bold gold-text">{target}</span>
                    <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>
                        Need: {Math.max(0, target - score)} runs
                    </span>
                </div>
            )}
        </div>
    );
}
