'use client';

import Link from 'next/link';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function Navbar() {
    const { username, isLoggedIn, logout } = useUserStore();
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        logout();
        router.push('/');
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05]" style={{
            background: 'rgba(8, 8, 10, 0.8)',
            backdropFilter: 'blur(20px)',
        }}>
            <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300" style={{
                        background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))',
                    }}>
                        <span className="text-lg font-black relative z-10" style={{ color: 'var(--color-bg-primary)' }}>D</span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-lg font-black tracking-tighter gold-text leading-none mb-1">THE DUGOUT</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-gold)] animate-pulse" />
                            <p className="text-[9px] tracking-[0.3em] font-black uppercase text-[var(--color-text-muted)]">
                                Season 2026 Edition
                            </p>
                        </div>
                    </div>
                </Link>

                <div className="flex items-center gap-6">
                    {isLoggedIn && (
                        <>
                            <Link href="/dashboard" className="text-[11px] font-black tracking-widest uppercase text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors">
                                Dashboard
                            </Link>
                            <div className="flex items-center gap-4 pl-6 border-l border-white/5">
                                <div className="flex flex-col items-end hidden md:block">
                                    <span className="text-[11px] font-black uppercase text-white leading-none">{username}</span>
                                    <span className="text-[9px] font-bold text-[var(--color-gold)] uppercase tracking-tighter">Pro Member</span>
                                </div>
                                <div className="w-9 h-9 rounded-full gold-glow flex items-center justify-center text-sm font-black border-2 border-[var(--color-gold)]/20"
                                    style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--color-gold)' }}>
                                    {username?.charAt(0).toUpperCase()}
                                </div>
                                <button onClick={handleLogout} className="text-[10px] font-black tracking-widest uppercase px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition-all">
                                    Exit
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
