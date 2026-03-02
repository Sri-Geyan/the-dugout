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
        <nav className="fixed top-0 left-0 right-0 z-50 border-b" style={{
            background: 'rgba(11, 11, 14, 0.85)',
            backdropFilter: 'blur(20px)',
            borderColor: 'var(--color-border)',
        }}>
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                        background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))',
                    }}>
                        <span className="text-sm font-black" style={{ color: 'var(--color-bg-primary)' }}>D</span>
                    </div>
                    <div>
                        <h1 className="text-base font-bold tracking-tight gold-text">THE DUGOUT</h1>
                        <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                            Where decisions win matches
                        </p>
                    </div>
                </Link>

                <div className="flex items-center gap-4">
                    {isLoggedIn ? (
                        <>
                            <Link href="/dashboard" className="text-sm font-medium hover:text-[var(--color-gold)] transition-colors"
                                style={{ color: 'var(--color-text-secondary)' }}>
                                Dashboard
                            </Link>
                            <div className="flex items-center gap-3 pl-4 border-l" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ background: 'rgba(212, 175, 55, 0.15)', color: 'var(--color-gold)' }}>
                                    {username?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{username}</span>
                                <button onClick={handleLogout} className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                                    style={{ color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)' }}>
                                    Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        <Link href="/login" className="btn-primary text-xs px-4 py-2">
                            Enter
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
