'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { useVendorPendingCount } from '@/lib/store';
import { chainLabel } from '@/lib/chain-config';
import LoginButton from './LoginButton';
import WalletButton from './WalletButton';

export default function Nav() {
  const { role, wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const pendingCount = useVendorPendingCount(role === 'vendor' ? wallet?.address : undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav className="section-shell sticky top-3 sm:top-4 z-[60] pt-3 sm:pt-4">
      <div className="ink-panel flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3 md:px-6">
        <Link href="/" aria-label="SOL'D — home" className="flex items-center whitespace-nowrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wordmark.svg"
            alt="SOL'D"
            width={144}
            height={44}
            className="h-7 sm:h-8 md:h-9 w-auto"
          />
        </Link>

        <div className="hidden lg:flex items-center gap-5">
          <NavLink href="/scout/bounties">Bounties</NavLink>
          {role === 'vendor' && (
            <>
              <NavLink href="/vendor/dashboard">Vendor</NavLink>
              <NavLink href="/vendor/inbox">
                Inbox
                {pendingCount > 0 && (
                  <span
                    className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-earn-accent text-white text-[10px] font-bold rounded-full"
                    aria-label={`${pendingCount} pending sales to verify`}
                  >
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            </>
          )}
          {role === 'scout' && <NavLink href="/scout/dashboard">Scout</NavLink>}
          <NavLink href="/scout/leaderboard">Leaderboard</NavLink>
        </div>

        <div className="flex items-center gap-2">
          <ChainStatusPill />
          <LoginButton />
          <div className="hidden sm:block">
            <WalletButton size="sm" />
          </div>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 border border-earn-gray-900 bg-white/80 hover:bg-white"
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {open ? (
                <path d="M3 3 L15 15 M15 3 L3 15" stroke="currentColor" strokeWidth="1.6" />
              ) : (
                <path d="M2 5 H16 M2 9 H16 M2 13 H16" stroke="currentColor" strokeWidth="1.6" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden mt-2 ink-panel p-4 flex flex-col gap-2 fade-in">
          {!wallet && (
            <div className="pb-2 mb-2 border-b border-earn-gray-300">
              <LoginButton variant="inline" />
            </div>
          )}
          <MobileLink href="/scout/bounties" onClick={() => setOpen(false)}>Bounties</MobileLink>
          {role === 'vendor' && (
            <>
              <MobileLink href="/vendor/dashboard" onClick={() => setOpen(false)}>Vendor Dashboard</MobileLink>
              <MobileLink href="/vendor/inbox" onClick={() => setOpen(false)}>
                Inbox{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </MobileLink>
            </>
          )}
          {role === 'scout' && (
            <MobileLink href="/scout/dashboard" onClick={() => setOpen(false)}>Scout Dashboard</MobileLink>
          )}
          <MobileLink href="/scout/leaderboard" onClick={() => setOpen(false)}>Leaderboard</MobileLink>
          <MobileLink href="/vendor/signup" onClick={() => setOpen(false)}>Become a Vendor</MobileLink>
          <MobileLink href="/scout/signup" onClick={() => setOpen(false)}>Become a Scout</MobileLink>
          <div className="pt-2 sm:hidden">
            <WalletButton size="sm" />
          </div>
        </div>
      )}
    </nav>
  );
}

function ChainStatusPill() {
  const label = chainLabel();
  const isMock = label === 'Mock';
  return (
    <span
      title={
        isMock
          ? 'On-chain escrow not yet deployed. Vendor flows run in mock mode. Set NEXT_PUBLIC_ESCROW_PROGRAM_ID to enable.'
          : 'Escrow program is live on-chain.'
      }
      className={`hidden md:inline-flex items-center gap-1 border border-earn-gray-900 px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${
        isMock ? 'bg-earn-amber/30' : 'bg-earn-accent-soft/40'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isMock ? 'bg-earn-amber' : 'bg-earn-accent'}`}
        aria-hidden="true"
      />
      {isMock ? 'Mock mode' : `${label} · live`}
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-[11px] uppercase tracking-wider hover:text-earn-accent transition-colors"
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block border-l-2 border-transparent hover:border-earn-accent pl-3 py-2 font-mono text-xs uppercase tracking-wider hover:text-earn-accent"
    >
      {children}
    </Link>
  );
}
