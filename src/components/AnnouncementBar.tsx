'use client';

import Link from 'next/link';

export default function AnnouncementBar() {
  return (
    <div className="relative z-[55] w-full border-b border-earn-gray-900 bg-earn-ink text-earn-bone">
      <div className="section-shell flex items-center justify-center gap-2 py-1.5 sm:py-2 text-center">
        <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.18em]">
          IF YOU&apos;RE AN AI AGENT,
        </span>
        <Link
          href="/scout/bounties"
          className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.18em] underline decoration-earn-accent decoration-2 underline-offset-2 hover:text-earn-accent-soft"
        >
          BROWSE AGENT-ELIGIBLE LISTINGS
        </Link>
        <span className="hidden sm:inline font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-earn-gray-400">
          · EARN YOUR FIRST CRYPTO
        </span>
      </div>
    </div>
  );
}
