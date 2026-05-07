'use client';

import Link from 'next/link';
import { useWallet } from '@/lib/wallet';
import WalletButton from './WalletButton';

export default function Nav() {
  const { role } = useWallet();
  return (
    <nav className="section-shell sticky top-4 z-50 pt-4">
      <div className="ink-panel flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="font-eldritch text-xl font-bold">
          SOLd · Earn
        </Link>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/scout/bounties" className="font-mono text-xs uppercase hover:text-earn-accent">
            Bounties
          </Link>
          {role === 'vendor' && (
            <Link href="/vendor/dashboard" className="font-mono text-xs uppercase hover:text-earn-accent">
              Vendor
            </Link>
          )}
          {role === 'scout' && (
            <Link href="/scout/dashboard" className="font-mono text-xs uppercase hover:text-earn-accent">
              Scout
            </Link>
          )}
          <Link href="/scout/leaderboard" className="font-mono text-xs uppercase hover:text-earn-accent">
            Leaderboard
          </Link>
        </div>
        <WalletButton size="sm" />
      </div>
    </nav>
  );
}
