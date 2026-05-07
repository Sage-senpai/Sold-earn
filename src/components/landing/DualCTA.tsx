'use client';

import Link from 'next/link';
import { useState } from 'react';

type Side = 'vendor' | 'scout' | null;

export default function DualCTA() {
  const [hover, setHover] = useState<Side>(null);

  return (
    <section id="paths" className="section-shell relative z-10 pb-24 pt-4 appear">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600">Two paths · One protocol</p>
          <h2 className="font-eldritch text-3xl font-bold md:text-5xl">Need sales, or drive them?</h2>
        </div>
        <p className="hidden font-mono text-[10px] uppercase text-earn-gray-600 md:block">
          Choose a side · animated
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card
          side="vendor"
          active={hover === 'vendor'}
          dimmed={hover === 'scout'}
          onEnter={() => setHover('vendor')}
          onLeave={() => setHover(null)}
          eyebrow="Need sales"
          title="Sign up as a Vendor"
          blurb="Hold a bounty, lock escrow, watch a guild of scouts move your product."
          bullets={['Brand profile + multi-bounty dashboard', 'Escrow on-chain — refunded on cancel', 'Live leaderboard of selling scouts']}
          href="/vendor/signup"
          accent
        />
        <Card
          side="scout"
          active={hover === 'scout'}
          dimmed={hover === 'vendor'}
          onEnter={() => setHover('scout')}
          onLeave={() => setHover(null)}
          eyebrow="Drive sales"
          title="Sign up as a Scout"
          blurb="Mint a Soulbound ID. Generate a Sales ID per bounty. Earn the full reward — instantly."
          bullets={['SBT-bound identity, no impersonation', 'Per-bounty performance dashboard', '10-application cap keeps quality high']}
          href="/scout/signup"
        />
      </div>
    </section>
  );
}

function Card({
  side,
  active,
  dimmed,
  onEnter,
  onLeave,
  eyebrow,
  title,
  blurb,
  bullets,
  href,
  accent,
}: {
  side: Side;
  active: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`ink-card group relative block p-7 md:p-9 transition-all duration-300 ${
        active ? 'translate-y-[-6px]' : ''
      } ${dimmed ? 'opacity-60' : ''}`}
      style={{ transitionProperty: 'transform, box-shadow, opacity' }}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`glyph-badge ${accent ? 'glyph-badge-accent' : ''}`}
          style={accent ? {} : { background: '#0b0b0b', color: '#fff' }}
        >
          {eyebrow}
        </span>
        <span className="font-mono text-[10px] uppercase text-earn-gray-500 transition-transform group-hover:translate-x-1">
          → enter
        </span>
      </div>

      <h3 className="font-eldritch mt-6 text-3xl font-bold leading-tight md:text-4xl">{title}</h3>
      <div className="rune-rule my-5" />
      <p className="text-sm text-earn-gray-700 md:text-base">{blurb}</p>

      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 font-mono text-[11px] uppercase text-earn-gray-700">
            <span className={accent ? 'text-earn-accent' : 'text-earn-ink'}>◆</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0,
          background: accent
            ? 'radial-gradient(circle at 30% 20%, rgba(15,110,86,0.16), transparent 60%)'
            : 'radial-gradient(circle at 70% 20%, rgba(226,183,58,0.18), transparent 60%)',
        }}
      />
    </Link>
  );
}
