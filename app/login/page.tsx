'use client';

import { useState, useEffect } from 'react';
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

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    };

    // ── Step 1: Check if username exists ──────────────────────────────────────
    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = username.trim();
        if (name.length < 3) { setError('Name must be at least 3 characters'); return; }
        if (name.length > 20) { setError('Name must be 20 characters or less'); return; }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: name }),
            });
            const data = await res.json();

            if (res.status === 200 && data.requiresPin) {
                setPhase('pin-verify');
            } else if (res.ok && data.userId) {
                setIsNewUser(false);
                setPhase('pin-set');
            } else if (res.status === 404 || (!res.ok && !data.requiresPin)) {
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

    // ── PIN pad helpers ───────────────────────────────────────────────────────
    const appendDigit = (d: string, target: 'pin' | 'confirm') => {
        if (target === 'pin' && pin.length < 6) setPin(p => p + d);
        if (target === 'confirm' && pinConfirm.length < 6) setPinConfirm(p => p + d);
    };
    const deleteDigit = (target: 'pin' | 'confirm') => {
        if (target === 'pin') setPin(p => p.slice(0, -1));
        if (target === 'confirm') setPinConfirm(p => p.slice(0, -1));
    };

    // ── Auto-advance when 6 digits filled ────────────────────────────────────
    useEffect(() => {
        if (phase === 'pin-verify' && pin.length === 6) handlePinVerify();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin, phase]);

    useEffect(() => {
        if (phase === 'pin-set' && pin.length === 6) {
            setTimeout(() => setPhase('pin-confirm'), 120);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin, phase]);

    useEffect(() => {
        if (phase === 'pin-confirm' && pinConfirm.length === 6) handlePinConfirm();
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

    const currentPinValue = phase === 'pin-confirm' ? pinConfirm : pin;
    const currentTarget: 'pin' | 'confirm' = phase === 'pin-confirm' ? 'confirm' : 'pin';

    // ── Sub-components ────────────────────────────────────────────────────────
    const PinDots = ({ value }: { value: string }) => (
        <div className={`flex gap-4 justify-center my-8 ${shake ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3, 4, 5].map(i => {
                const filled = i < value.length;
                return (
                    <div
                        key={i}
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                            background: filled ? 'var(--color-gold)' : 'transparent',
                            border: `2px solid ${filled ? 'var(--color-gold)' : 'rgba(255,255,255,0.18)'}`,
                            transform: filled ? 'scale(1.25)' : 'scale(1)',
                            boxShadow: filled ? '0 0 12px rgba(212,175,55,0.55)' : 'none',
                        }}
                    />
                );
            })}
        </div>
    );

    const BackspaceIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" />
            <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
    );

    /* 
      Numpad layout:
        1  2  3
        4  5  6
        7  8  9
           0  ⌫
    */
    const PinPad = ({ target }: { target: 'pin' | 'confirm' }) => (
        <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key => (
                <button
                    key={key}
                    onClick={() => appendDigit(key, target)}
                    disabled={loading}
                    className="h-14 rounded-2xl text-lg font-bold transition-all duration-150 active:scale-90"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'white',
                    }}
                >
                    {key}
                </button>
            ))}

            {/* Empty left slot */}
            <div />

            {/* 0 — centred */}
            <button
                onClick={() => appendDigit('0', target)}
                disabled={loading}
                className="h-14 rounded-2xl text-lg font-bold transition-all duration-150 active:scale-90"
                style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white',
                }}
            >
                0
            </button>

            {/* Backspace */}
            <button
                onClick={() => deleteDigit(target)}
                disabled={loading}
                className="h-14 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-90"
                style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    color: '#EF5350',
                }}
            >
                <BackspaceIcon />
            </button>
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <main
            className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
            style={{ background: 'var(--color-bg-primary)' }}
        >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06]"
                    style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(80px)' }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)', filter: 'blur(60px)' }}
                />
            </div>

            <div className="relative z-10 w-full max-w-sm">

                {/* Logo + heading */}
                <div className="text-center mb-10 animate-fadeInUp">
                    <Link href="/">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 cursor-pointer hover:scale-105 transition-transform"
                            style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))', boxShadow: '0 8px 32px rgba(212,175,55,0.25)' }}
                        >
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
                        {phase === 'pin-set' && 'Secure your account with a 6-digit PIN'}
                        {phase === 'pin-confirm' && 'Enter your PIN one more time'}
                    </p>
                </div>

                {/* Card */}
                <div className="panel-elevated animate-fadeInUp relative" style={{ animationDelay: '0.1s' }}>

                    {/* Loading overlay for PIN phases */}
                    {loading && phase !== 'username' && (
                        <div className="absolute inset-0 rounded-2xl flex items-center justify-center z-20"
                            style={{ background: 'rgba(10,10,10,0.65)', backdropFilter: 'blur(4px)' }}>
                            <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" style={{ color: 'var(--color-gold)' }}>
                                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                    )}

                    {/* ── Username ── */}
                    {phase === 'username' && (
                        <form onSubmit={handleUsernameSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                                    Manager Name
                                </label>
                                <input
                                    id="username-input"
                                    autoFocus
                                    type="text"
                                    value={username}
                                    onChange={e => { setUsername(e.target.value); setError(''); }}
                                    placeholder="Pick your name"
                                    className="input-field text-base"
                                    maxLength={20}
                                    disabled={loading}
                                />
                            </div>
                            {error && (
                                <p className="text-sm text-center py-2 px-3 rounded-lg"
                                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    {error}
                                </p>
                            )}
                            <button
                                id="login-button"
                                type="submit"
                                disabled={loading || username.trim().length < 3}
                                className="btn-primary w-full py-3.5 font-bold"
                            >
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

                    {/* ── PIN Verify ── */}
                    {phase === 'pin-verify' && (
                        <div>
                            <PinDots value={pin} />
                            <PinPad target="pin" />
                            {error && (
                                <p className="text-sm text-center mt-4 py-2 rounded-lg"
                                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    {error}
                                </p>
                            )}
                            <button
                                onClick={() => { setPhase('username'); setPin(''); setError(''); }}
                                className="w-full mt-4 text-xs text-center py-2"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                ← Use a different name
                            </button>
                        </div>
                    )}

                    {/* ── PIN Set ── */}
                    {phase === 'pin-set' && (
                        <div>
                            <PinDots value={pin} />
                            <PinPad target="pin" />
                            <button
                                onClick={skipPin}
                                disabled={loading}
                                className="w-full mt-5 text-xs text-center py-2 rounded-lg transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                Skip — enter without a PIN
                            </button>
                        </div>
                    )}

                    {/* ── PIN Confirm ── */}
                    {phase === 'pin-confirm' && (
                        <div>
                            <PinDots value={pinConfirm} />
                            <PinPad target="confirm" />
                            {error && (
                                <p className="text-sm text-center mt-4 py-2 rounded-lg"
                                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    {error}
                                </p>
                            )}
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
                    20%  { transform: translateX(-8px); }
                    40%  { transform: translateX(8px); }
                    60%  { transform: translateX(-5px); }
                    80%  { transform: translateX(5px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </main>
    );
}
