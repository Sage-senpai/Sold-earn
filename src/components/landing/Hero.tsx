'use client';

import { useEffect, useRef, useState } from 'react';

// easeOutCubic — fast at the start, settling into the target. Cheap and
// reads as "snappy" without overshoot.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function useCountUp(target: number, durationMs = 1500): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export default function Hero() {
  return (
    <section className="section-shell relative z-10 flex min-h-[calc(100vh-7rem)] items-center pt-8 sm:pt-12 pb-10 sm:pb-12 appear">
      <div className="grid w-full gap-8 lg:gap-10 md:grid-cols-[1.1fr,0.9fr] items-center">
        <div>
          <div className="glyph-badge mb-5 sm:mb-6">Decentralized Sales Guild · Solana</div>
          <h1 className="shadow-word font-eldritch text-[2.5rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl font-bold">
            Sales,
            <br />
            <span className="text-earn-accent">on-chain.</span>
          </h1>
          <div className="rune-rule my-6 sm:my-8" />
          <p className="max-w-xl text-sm sm:text-base md:text-lg text-earn-gray-700">
            Vendors hold bounties in escrow. Scouts mint a soulbound identity, generate a Sales ID, and earn 100% of the
            reward on every verified sale — paid the moment the chain confirms.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#paths" className="btn-accent">
              Pick Your Path
            </a>
            <a href="/scout/bounties" className="btn-secondary">
              Browse Bounties
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="ink-panel p-5 sm:p-6 md:p-8">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase text-earn-gray-600">Snapshot</p>
              <span
                className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-amber-400 bg-amber-50 text-amber-800"
                title="Sample figures shown for layout — not pulled from the live protocol"
              >
                mock · for demo
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat k="Verified Volume" target={214830} prefix="$" />
              <Stat k="Active Bounties" target={42} />
              <Stat k="Scouts (SBT)" target={1317} />
              <Stat k="Avg. Payout" target={48} prefix="$" />
            </div>
            <div className="rune-rule my-5 sm:my-6" />
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Latest Sales ID</p>
            <p className="metric-number mt-2 text-base sm:text-lg font-bold break-all">SE-9MQ4F2-7K3X-9Q4</p>
          </div>
          <div
            className="hidden md:block absolute -bottom-3 -left-3 h-full w-full -z-10 border border-earn-ink"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  k,
  target,
  prefix = '',
  suffix = '',
}: {
  k: string;
  target: number;
  prefix?: string;
  suffix?: string;
}) {
  const v = useCountUp(target);
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{k}</p>
      <p
        className="metric-number mt-1 text-xl sm:text-2xl font-bold tabular-nums"
        aria-label={`${k}: ${prefix}${target.toLocaleString()}${suffix}`}
      >
        {prefix}
        {Math.round(v).toLocaleString()}
        {suffix}
      </p>
    </div>
  );
}
