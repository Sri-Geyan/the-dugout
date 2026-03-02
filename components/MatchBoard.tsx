'use client';

interface BatterInfo {
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
}

interface BowlerInfo {
    name: string;
    overs: number;
    runs: number;
    wickets: number;
    economy: number;
}

interface MatchBoardProps {
    striker: BatterInfo | null;
    nonStriker: BatterInfo | null;
    bowler: BowlerInfo | null;
    commentary: string[];
    matchPhase: string;
    innings: number;
    result: string | null;
}

export default function MatchBoard({
    striker,
    nonStriker,
    bowler,
    commentary,
    matchPhase,
    innings,
    result,
}: MatchBoardProps) {
    const phaseColors: Record<string, string> = {
        powerplay: '#4FC3F7',
        middle: '#66BB6A',
        death: '#EF5350',
    };

    return (
        <div className="space-y-4">
            {/* Match Phase & Innings */}
            <div className="flex items-center gap-3">
                <span className="badge badge-gold text-[10px]">INNINGS {innings}</span>
                <span className="text-[10px] font-semibold px-3 py-1 rounded-full" style={{
                    background: `${phaseColors[matchPhase] || '#fff'}15`,
                    color: phaseColors[matchPhase] || '#fff',
                    border: `1px solid ${phaseColors[matchPhase] || '#fff'}30`,
                }}>
                    {matchPhase.toUpperCase()} OVERS
                </span>
            </div>

            {/* Result Banner */}
            {result && (
                <div className="panel-gold text-center py-6 animate-fadeInUp">
                    <span className="text-3xl mb-2 block">🏆</span>
                    <p className="text-lg font-bold gold-text">{result}</p>
                </div>
            )}

            {/* Batters */}
            <div className="panel">
                <h4 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    At The Crease
                </h4>
                <div className="space-y-2">
                    {striker && (
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                                <span className="text-sm font-semibold">{striker.name} *</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="font-bold">{striker.runs}<span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>({striker.balls})</span></span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{striker.fours}×4 {striker.sixes}×6</span>
                                <span className="font-semibold gold-text">
                                    SR {striker.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(1) : '0.0'}
                                </span>
                            </div>
                        </div>
                    )}
                    {nonStriker && (
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-border)' }} />
                                <span className="text-sm">{nonStriker.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                <span className="font-semibold">{nonStriker.runs}<span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>({nonStriker.balls})</span></span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bowler */}
            {bowler && (
                <div className="panel">
                    <h4 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        Bowling
                    </h4>
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                        <span className="text-sm font-semibold">{bowler.name}</span>
                        <div className="flex items-center gap-4 text-xs">
                            <span>{bowler.overs} ov</span>
                            <span>{bowler.runs} runs</span>
                            <span className="font-bold" style={{ color: 'var(--color-danger)' }}>{bowler.wickets} wkt</span>
                            <span className="font-semibold gold-text">Econ {bowler.economy}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Commentary */}
            <div className="panel">
                <h4 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    Commentary
                </h4>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {commentary.slice(0, 20).map((line, i) => (
                        <div key={i} className={`text-xs py-1.5 px-2 rounded ${i === 0 ? 'animate-slideIn' : ''}`}
                            style={{
                                color: i === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                background: i === 0 ? 'rgba(212, 175, 55, 0.05)' : 'transparent',
                                fontWeight: i === 0 ? 600 : 400,
                            }}>
                            {line}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
