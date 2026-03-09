'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';

type Phase = 'username' | 'pin-verify' | 'pin-set' | 'pin-confirm';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [phase, setPhase] = useState<Phase>('username');
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);
    const router = useRouter();
    const setUser = useUserStore((s) => s.setUser);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (phase === 'username') inputRef.current?.focus();
    }, [phase]);

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    };

    // Step 1: Check if username exists
    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = username.trim();
        if (name.length < 3) { setError('Name must be at least 3 characters'); return; }
        if (name.length > 20) { setError('Name must be 20 characters or less'); return; }

        setLoading(true);
        setError('');

        try {
            // Send without PIN to detect if account exists + has PIN
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: name }),
            });
            const data = await res.json();

            if (res.status === 200 && data.requiresPin) {
                // Returning user with PIN
                setPhase('pin-verify');
            } else if (res.ok && data.userId) {
                // Returning user, no PIN — logged in
                setUser(data.userId, data.username);
                router.push('/dashboard');
            } else if (res.status === 404 || (!res.ok && !data.requiresPin)) {
                // New user — flow: set PIN
                setIsNewUser(true);
                setPhase('pin-set');
            } else {
                setError(data.error || 'Something went wrong');
            }
        } catch {
            setError('Network error. Try again.');
        } finally {
            setLoading(false);
        }
    };

    // PIN pad digit press
    const appendDigit = (d: string, target: 'pin' | 'confirm') => {
        if (target === 'pin' && pin.length < 4) setPin(p => p + d);
        if (target === 'confirm' && pinConfirm.length < 4) setPinConfirm(p => p + d);
    };
    const deleteDigit = (target: 'pin' | 'confirm') => {
        if (target === 'pin') setPin(p => p.slice(0, -1));
        if (target === 'confirm') setPinConfirm(p => p.slice(0, -1));
    };

    // Auto-advance when 4 digits filled
    useEffect(() => {
        if (phase === 'pin-verify' && pin.length === 4) handlePinVerify();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin, phase]);

    useEffect(() => {
        if (phase === 'pin-set' && pin.length === 4) {
            setPhase('pin-confirm');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin, phase]);

    useEffect(() => {
        if (phase === 'pin-confirm' && pinConfirm.length === 4) handlePinConfirm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinConfirm, phase]);

    const handlePinVerify = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), pin }),
            });
            const data = await res.json();
            if (res.ok && data.userId) {
                setUser(data.userId, data.username);
                router.push('/dashboard');
            } else {
                setError(data.error || 'Wrong PIN');
                setPin('');
                triggerShake();
            }
        } catch {
            setError('Network error');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handlePinConfirm = async () => {
        if (pin !== pinConfirm) {
            setError('PINs don\'t match. Try again.');
            setPinConfirm('');
            setPin('');
            setPhase('pin-set');
            triggerShake();
            return;
        }
        // Create account with PIN
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), pin }),
            });
            const data = await res.json();
            if (res.ok && data.userId) {
                setUser(data.userId, data.username);
                router.push('/dashboard');
            } else {
                setError(data.error || 'Failed to create account');
            }
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const skipPin = async () => {
        // Create account without PIN
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.userId) {
                setUser(data.userId, data.username);
                router.push('/dashboard');
            }
        } catch { } finally {
            setLoading(false);
        }
    };

    const currentPinTarget: 'pin' | 'confirm' = phase === 'pin-confirm' ? 'confirm' : 'pin';
    const currentPinValue = phase === 'pin-confirm' ? pinConfirm : pin;

    const PinDots = ({ value }: { value: string }) => (
        <div className={`flex gap-4 justify-center my-8 ${shake ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-4 h-4 rounded-full transition-all duration-200"
                    style={{
                        background: i < value.length ? 'var(--color-gold)' : 'transparent',
                        border: `2px solid ${i < value.length ? 'var(--color-gold)' : 'rgba(255,255,255,0.2)'}`,
                        transform: i < value.length ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: i < value.length ? '0 0 12px rgba(212,175,55,0.5)' : 'none',
                    }} />
            ))}
        </div>
    );

    const PinPad = ({ target }: { target: 'pin' | 'confirm' }) => (
        <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => {
                if (key === '') return <div key={i} />;
                return (
                    <button key={i}
                        onClick={() => key === '⌫' ? deleteDigit(target) : appendDigit(key, target)}
                        disabled={loading}
                        className="h-14 rounded-2xl text-lg font-bold transition-all duration-150 active:scale-95"
                        style={{
                            background: key === '⌫' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: key === '⌫' ? '#EF5350' : 'white',
                        }}>
                        {key}
                    </button>
                );
            })}
        </div>
    );

    return (
        <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
            style={{ background: 'var(--color-bg-primary)' }}>

            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06]"
                    style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(80px)' }} />
                <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)', filter: 'blur(60px)' }} />
            </div>

            <div className="relative z-10 w-full max-w-sm">

                {/* Logo */}
                <div className="text-center mb-10 animate-fadeInUp">
                    <Link href="/">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 cursor-pointer hover:scale-105 transition-transform"
                            style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))', boxShadow: '0 8px 32px rgba(212,175,55,0.25)' }}>
                            <span className="text-3xl font-black" style={{ color: '#0a0a0a' }}>D</span>
                        </div>
                    </Link>
                    <h1 className="text-2xl font-black">
                        {phase === 'username' && <><span className="gold-text">The Dugout</span></>}
                        {phase === 'pin-verify' && 'Enter your PIN'}
                        {phase === 'pin-set' && 'Set a PIN'}
                        {phase === 'pin-confirm' && 'Confirm PIN'}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {phase === 'username' && 'Your IPL management arena awaits'}
                        {phase === 'pin-verify' && `Welcome back, ${username}`}
                        {phase === 'pin-set' && 'Secure your account with a 4-digit PIN'}
                        {phase === 'pin-confirm' && 'Enter your PIN one more time'}
                    </p>
                </div>

                {/* Card */}
                <div className="panel-elevated animate-fadeInUp" style={{ animationDelay: '0.1s' }}>

                    {/* ── Phase: Username ── */}
                    {phase === 'username' && (
                        <form onSubmit={handleUsernameSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                                    Manager Name
                                </label>
                                <input ref={inputRef} id="username-input" type="text"
                                    value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                                    placeholder="Pick your name"
                                    className="input-field text-base" maxLength={20} disabled={loading} />
                            </div>
                            {error && <p className="text-sm text-center py-2 px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
                            <button id="login-button" type="submit" disabled={loading || username.trim().length < 3}
                                className="btn-primary w-full py-3.5 font-bold">
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Checking...
                                    </span>
                                ) : 'Continue →'}
                            </button>
                        </form>
                    )}

                    {/* ── Phase: PIN Verify ── */}
                    {phase === 'pin-verify' && (
                        <div>
                            <PinDots value={pin} />
                            <PinPad target="pin" />
                            {error && <p className="text-sm text-center mt-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>{error}</p>}
                            <button onClick={() => { setPhase('username'); setPin(''); setError(''); }}
                                className="w-full mt-4 text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
                                ← Use a different name
                            </button>
                        </div>
                    )}

                    {/* ── Phase: PIN Set ── */}
                    {phase === 'pin-set' && (
                        <div>
                            <PinDots value={pin} />
                            <PinPad target="pin" />
                            <button onClick={skipPin} disabled={loading}
                                className="w-full mt-5 text-xs text-center py-2 rounded-lg transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}>
                                Skip — enter without a PIN
                            </button>
                        </div>
                    )}

                    {/* ── Phase: PIN Confirm ── */}
                    {phase === 'pin-confirm' && (
                        <div>
                            <PinDots value={pinConfirm} />
                            <PinPad target="confirm" />
                            {error && <p className="text-sm text-center mt-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>{error}</p>}
                        </div>
                    )}
                </div>

                <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                    IPL 2026 · The Dugout
                </p>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-5px); }
                    80% { transform: translateX(5px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </main>
    );
}
