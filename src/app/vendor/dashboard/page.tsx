'use client';

import Link from 'next/link';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Nav from '@/components/Nav';
import { useWallet } from '@/lib/wallet';
import { useVendor, useVendorBounties } from '@/lib/store';

const HoldBountyDialog = dynamic(() => import('@/components/HoldBountyDialog'), { ssr: false });
const DevnetFundCard = dynamic(() => import('@/components/DevnetFundCard'), { ssr: false });

export default function VendorDashboard() {
  const { wallet } = useWallet();
  const vendor = useVendor(wallet?.address);
  const bounties = useVendorBounties(wallet?.address);
  const [open, setOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 sm:py-10 appear">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Vendor Dashboard</p>
            <h1 className="font-eldritch text-2xl sm:text-3xl md:text-4xl font-bold break-words">{vendor?.brandName ?? 'Your Brand'}</h1>
            <p className="mt-1 text-earn-gray-700 text-sm max-w-xl">{vendor?.bio ?? 'Set up your vendor profile to publish bounties.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vendor/signup" className="btn-secondary text-xs">
              Edit Profile
            </Link>
            <button className="btn-accent text-xs" onClick={() => setOpen(true)}>
              Hold a Bounty
            </button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 mb-8">
          <Stat label="Active Bounties" value={bounties.filter((b) => b.status === 'active').length.toString()} />
          <Stat label="Total Escrow" value={`$${bounties.reduce((a, b) => a + b.escrowDeposited, 0).toLocaleString()}`} />
          <Stat label="Bounties Held" value={bounties.length.toString()} />
        </div>

        {bounties.reduce((a, b) => a + b.escrowDeposited, 0) === 0 && (
          <div className="mb-8">
            <DevnetFundCard />
          </div>
        )}

        <h2 className="font-eldritch text-xl font-bold mb-3">All Bounties</h2>
        {bounties.length === 0 ? (
          <div className="ink-card p-8 text-center">
            <p className="text-earn-gray-700">You haven't held any bounties yet.</p>
            <button className="btn-accent text-xs mt-4" onClick={() => setOpen(true)}>
              Hold your first bounty
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bounties.map((b) => (
              <Link key={b.id} href={`/vendor/dashboard/${b.id}`} className="ink-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-eldritch text-lg font-bold leading-tight">{b.title}</h3>
                  <span className={`glyph-badge ${b.status === 'active' ? 'glyph-badge-accent' : ''}`}>{b.status}</span>
                </div>
                <p className="mt-2 text-sm text-earn-gray-700 line-clamp-2">{b.description}</p>
                <div className="rune-rule my-4" />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Mini label="Reward" value={`${b.rewardAmount} ${b.rewardToken}`} />
                  <Mini label="Target" value={b.targetSales.toString()} />
                  <Mini label="Region" value={b.region} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <HoldBountyDialog open={open} onClose={() => setOpen(false)} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ink-card p-5">
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</p>
      <p className="metric-number mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase text-earn-gray-600">{label}</p>
      <p className="font-mono text-xs font-bold mt-0.5">{value}</p>
    </div>
  );
}
