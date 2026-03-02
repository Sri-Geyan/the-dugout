'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const setUser = useUserStore((s) => s.setUser);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) {
            setError('Please enter a username');
            return;
        }
        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (username.length > 20) {
            setError('Username must be 20 characters or less');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login failed');
                return;
            }

            setUser(data.userId, data.username);
            router.push('/dashboard');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
            style={{ background: 'var(--color-bg-primary)' }}>
            {/* Background effects */}
            <div className="absolute inset-0">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-5"
                    style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(100px)' }} />
            </div>

            <div className="relative z-10 w-full max-w-md animate-fadeInUp">
                {/* Logo */}
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{
                            background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))',
                            boxShadow: '0 8px 32px rgba(212, 175, 55, 0.3)',
                        }}>
                            <span className="text-2xl font-black" style={{ color: 'var(--color-bg-primary)' }}>D</span>
                        </div>
                    </Link>
                    <h1 className="text-2xl font-bold mb-1">Welcome to <span className="gold-text">The Dugout</span></h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Enter your name to begin your journey
                    </p>
                </div>

                {/* Login Card */}
                <div className="panel-elevated">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                Manager Name
                            </label>
                            <input
                                id="username-input"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="input-field"
                                maxLength={20}
                                autoFocus
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="text-sm px-3 py-2 rounded-lg" style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--color-danger)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            id="login-button"
                            type="submit"
                            disabled={loading || !username.trim()}
                            className="btn-primary w-full py-3.5"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Entering...
                                </span>
                            ) : (
                                'Enter The Dugout'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                            No account needed. Just pick a name and start playing.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
