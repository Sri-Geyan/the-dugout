'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const features = [
  {
    icon: '🏏',
    title: 'Build Your Squad',
    desc: 'Compete in live auctions with 120 Cr, outbid rivals, use RTM cards, and assemble your dream IPL team.',
  },
  {
    icon: '🏟️',
    title: 'Play Every Venue',
    desc: '10 real IPL stadiums — each with its own pitch character. What works at Wankhede may not at Chepauk.',
  },
  {
    icon: '🤖',
    title: 'Sharp AI Opponents',
    desc: 'AI managers fill the room when friends can\'t. They bid smartly, retain wisely, and pick their XI with intent.',
  },
  {
    icon: '🔄',
    title: 'Retention Phase',
    desc: 'Lock in your core before the auction starts. Retain stars within budget and build your identity around them.',
  },
  {
    icon: '🛡️',
    title: 'RTM Cards',
    desc: 'A sold player doesn\'t have to leave. Use your Right-to-Match to take them back at the final bid.',
  },
  {
    icon: '📱',
    title: 'Live Match Engine',
    desc: 'Ball-by-ball simulation. Pick your XI after the toss, set your order, and watch the numbers unfold.',
  },
];

const marqueeItems = [
  '⚡ LIVE AUCTION',
  '🏏 IPL 2026',
  '🤖 AI MANAGED',
  '🏟️ 10 STADIUMS',
  '🛡️ RTM SYSTEM',
  '🪙 TOSS & PITCH',
  '📊 LEAGUE MODE',
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>

      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-[0.07] animate-pulse"
          style={{ background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-[10%] right-[-10%] w-[35%] h-[35%] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)', filter: 'blur(100px)' }} />
        {/* Subtle cricket pitch grid */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'radial-gradient(circle, var(--color-gold) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      {/* Marquee ticker */}
      <div className="relative z-30 marquee-container bg-[#D4AF37]/5 border-b border-[#D4AF37]/10">
        <div className="marquee-content py-2">
          {[1, 2].map(i => (
            <span key={i} className="marquee-item">
              {marqueeItems.map((item, j) => (
                <span key={j} className="flex items-center gap-6">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase gold-text opacity-70">{item}</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--color-gold)] opacity-30" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center min-h-[calc(100vh-120px)] px-6 pt-32 md:pt-40">
        <div className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

          {/* Season badge */}
          <div className="inline-flex items-center gap-2 mb-14 px-5 py-2.5 rounded-full glass-panel border border-[var(--color-gold)]/15 shadow-lg shadow-[var(--color-gold)]/5 animate-fadeInUp">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-gold)' }} />
            <span className="text-[10px] font-black tracking-[0.35em] uppercase gold-text">
              IPL 2026 SEASON
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[5.5rem] md:text-[9rem] font-black tracking-tighter leading-[0.85] mb-6 select-none">
            <span className="gold-text">THE</span><br />
            <span className="text-white">DUGOUT</span>
          </h1>

          <p className="text-xl md:text-2xl font-light mb-3 text-white/70 italic tracking-tight">
            Your team. Your call. Your season.
          </p>

          <p className="text-sm md:text-base max-w-xl mx-auto mb-12 leading-relaxed text-white/40 font-medium">
            Bid for players, retain your stars, pick your Playing XI after the toss,
            and take your franchise through a full IPL league season.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16 animate-fadeInUp">
            <Link href="/login"
              className="btn-primary px-12 py-4 text-base font-black hover:scale-105 transition-transform duration-300 shadow-lg shadow-[var(--color-gold)]/20">
              Enter The Dugout
            </Link>
            <a href="#how-it-works"
              className="btn-secondary px-10 py-4 text-sm hover:border-[var(--color-gold)] transition-colors duration-300">
              How it works
            </a>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-10 md:gap-16 py-6 border-t border-white/[0.05]">
            {[
              { value: '120Cr', label: 'Auction Purse' },
              { value: '299', label: 'IPL Players' },
              { value: '10', label: 'Teams' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-black gold-text mb-0.5">{s.value}</div>
                <div className="text-[9px] tracking-[0.2em] uppercase font-bold text-white/30">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className={`relative z-10 pb-32 px-6 max-w-6xl mx-auto transition-all duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

        <div className="text-center mb-14">
          <h2 className="text-xs font-black tracking-[0.5em] uppercase gold-text mb-3">How It Works</h2>
          <div className="h-px w-16 mx-auto" style={{ background: 'linear-gradient(to right, transparent, var(--color-gold), transparent)' }} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div key={i}
              onMouseEnter={() => setActiveFeature(i)}
              onMouseLeave={() => setActiveFeature(null)}
              className="rounded-2xl p-7 cursor-default transition-all duration-400"
              style={{
                background: activeFeature === i ? 'rgba(212,175,55,0.04)' : 'rgba(255,255,255,0.01)',
                border: `1px solid ${activeFeature === i ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)'}`,
                transform: activeFeature === i ? 'translateY(-4px)' : 'translateY(0)',
              }}>
              <div className="text-3xl mb-5">{feature.icon}</div>
              <h3 className="text-base font-black text-white mb-2">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-white/40 font-medium">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <Link href="/login"
            className="btn-primary px-16 py-5 text-base font-black inline-block hover:scale-105 transition-transform duration-300">
            Start Your Season →
          </Link>
          <p className="text-xs mt-4 text-white/20">10 players · 120 Cr · One champion</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 pb-8 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 pt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-white/20">
            The Dugout · IPL 2026
          </p>
          <p className="text-[10px] text-white/15">
            Fan-made simulation — not affiliated with BCCI or IPL
          </p>
        </div>
      </footer>
    </main>
  );
}
