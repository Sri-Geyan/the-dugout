'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(212,175,55,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full" style={{
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-gold)' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-gold)' }}>
              Season 2026 • Live Now
            </span>
          </div>

          {/* Title */}
          <h1 className="text-7xl md:text-8xl font-black tracking-tight mb-4">
            <span className="gold-text">THE</span>{' '}
            <span className="text-white">DUGOUT</span>
          </h1>

          <p className="text-xl md:text-2xl font-light mb-2 tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
            Where decisions win matches.
          </p>

          <p className="text-sm max-w-xl mx-auto mb-12 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Build your dream squad in live auctions. Outsmart rivals with strategic team composition.
            Watch your decisions play out ball-by-ball in real-time simulated IPL matches.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/login" className="btn-primary text-base px-8 py-4 rounded-xl">
              Enter The Dugout
            </Link>
            <Link href="#features" className="btn-secondary px-8 py-4 rounded-xl text-sm">
              How It Works
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
            {[
              { value: '10', label: 'Players Per Room' },
              { value: '60+', label: 'Cricket Stars' },
              { value: '20', label: 'Over Matches' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="stat-value gold-text">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className={`mt-32 max-w-6xl mx-auto w-full transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-center text-sm font-semibold tracking-[0.3em] uppercase mb-12" style={{ color: 'var(--color-gold)' }}>
            THE EXPERIENCE
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🏏',
                title: 'Live Auction',
                desc: 'Bid against real players in real-time. Strategic purse management. Timer-based bidding.',
              },
              {
                icon: '⚡',
                title: 'Ball-by-Ball Simulation',
                desc: 'Every delivery matters. Skills, pitch conditions, and match phase affect outcomes.',
              },
              {
                icon: '🏆',
                title: 'League System',
                desc: 'Points table, NRR, Orange & Purple Caps. Full tournament experience.',
              },
            ].map((feature, i) => (
              <div key={i} className="panel-gold group hover:border-[var(--color-gold)] transition-all duration-300"
                style={{ animationDelay: `${i * 100}ms` }}>
                <span className="text-3xl mb-4 block">{feature.icon}</span>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-32 pb-8 text-center">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            © 2026 The Dugout — A Cricket Management Simulator
          </p>
        </footer>
      </div>
    </main>
  );
}
