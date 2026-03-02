'use client';

interface RoomCardProps {
    code: string;
    status: string;
    playerCount: number;
    maxPlayers: number;
    players: string[];
    hostId: string;
    currentUserId: string;
    onJoin: (code: string) => void;
}

export default function RoomCard({ code, status, playerCount, maxPlayers, players, hostId, currentUserId, onJoin }: RoomCardProps) {
    const statusColors: Record<string, string> = {
        waiting: 'badge-gold',
        auction: 'badge-success',
        match: 'badge-success',
        completed: 'badge-danger',
    };

    const isHost = hostId === currentUserId;

    return (
        <div className="panel group hover:border-[var(--color-gold-dark)] transition-all duration-300 cursor-pointer"
            onClick={() => onJoin(code)}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-bold tracking-wider gold-text">{code}</span>
                    {isHost && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                            background: 'rgba(212, 175, 55, 0.1)', color: 'var(--color-gold)',
                        }}>HOST</span>
                    )}
                </div>
                <span className={`badge ${statusColors[status] || 'badge-gold'} text-[10px] uppercase`}>
                    {status}
                </span>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                    {players.slice(0, 5).map((p, i) => (
                        <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
                            style={{
                                background: 'var(--color-bg-elevated)',
                                borderColor: 'var(--color-bg-panel)',
                                color: 'var(--color-text-secondary)',
                            }}>
                            {p.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {players.length > 5 && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border-2"
                            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-bg-panel)', color: 'var(--color-text-muted)' }}>
                            +{players.length - 5}
                        </div>
                    )}
                </div>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {playerCount}/{maxPlayers} players
                </span>
            </div>
        </div>
    );
}
