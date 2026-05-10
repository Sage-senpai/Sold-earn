'use client';

import Link from 'next/link';
import { useState } from 'react';

type Side = 'vendor' | 'scout' | null;

export default function DualCTA() {
  const [hover, setHover] = useState<Side>(null);

  return (
    <section id="paths" className="section-shell relative z-10 pb-16 sm:pb-24 pt-4 appear">
      <div className="mb-6 sm:mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600">Two paths · One protocol</p>
          <h2 className="font-eldritch text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            Off-chain sales for on-chain products and services.
          </h2>
        </div>
        <p className="hidden font-mono text-[10px] uppercase text-earn-gray-600 md:block">
          Open the book · pick a side
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card
          side="vendor"
          active={hover === 'vendor'}
          dimmed={hover === 'scout'}
          onEnter={() => setHover('vendor')}
          onLeave={() => setHover(null)}
          spineSide="right"
          header="Need Sales?"
          eyebrow="Vendor"
          title="Sign up as a Vendor"
          blurb="Sell globally to local audiences, without local middlemen."
          bullets={['Brand profile + multi-bounty dashboard', 'Escrow on-chain — refunded on cancel', 'Live leaderboard of selling drivers']}
          href="/vendor/signup"
          accent
        />
        <Card
          side="scout"
          active={hover === 'scout'}
          dimmed={hover === 'vendor'}
          onEnter={() => setHover('scout')}
          onLeave={() => setHover(null)}
          spineSide="left"
          header="Drive Sales?"
          eyebrow="Sales Driver"
          title="Sign up as a Sales Driver"
          blurb="Sell locally, for global projects and businesses."
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
  header,
  eyebrow,
  title,
  blurb,
  bullets,
  href,
  accent,
  spineSide,
}: {
  side: Side;
  active: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  header: string;
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
  href: string;
  accent?: boolean;
  // Which edge of the card sits against the "spine" of the book. The vendor
  // card's spine is on its right; the driver card's is on its left.
  spineSide: 'left' | 'right';
}) {
  return (
    <Link
      href={href}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`ink-card group relative block p-6 sm:p-7 md:p-9 transition-all duration-300 ${
        active ? 'md:translate-y-[-6px]' : ''
      } ${dimmed ? 'md:opacity-60' : ''}`}
      style={{ transitionProperty: 'transform, box-shadow, opacity' }}
    >
      {/* Big section header — "Need Sales?" / "Drive Sales?" */}
      <h2 className="font-eldritch text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
        {header}
      </h2>
      <div className="rune-rule my-4" />

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

      <h3 className="font-eldritch mt-6 text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
        {title}
      </h3>
      <p className="mt-3 text-sm text-earn-gray-700 md:text-base">{blurb}</p>

      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 font-mono text-[11px] uppercase text-earn-gray-700"
          >
            <span className={accent ? 'text-earn-accent' : 'text-earn-ink'}>◆</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Book-spine: a soft inner shadow + thin rule on the edge that faces
          the centre of the layout, so the two cards read as facing pages. */}
      <div
        aria-hidden
        className={`hidden md:block pointer-events-none absolute inset-y-0 ${
          spineSide === 'right' ? 'right-0' : 'left-0'
        } w-3`}
        style={{
          background:
            spineSide === 'right'
              ? 'linear-gradient(to left, rgba(0,0,0,0.06), transparent)'
              : 'linear-gradient(to right, rgba(0,0,0,0.06), transparent)',
          borderRight: spineSide === 'right' ? '1px solid rgba(0,0,0,0.08)' : undefined,
          borderLeft: spineSide === 'left' ? '1px solid rgba(0,0,0,0.08)' : undefined,
        }}
      />

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
