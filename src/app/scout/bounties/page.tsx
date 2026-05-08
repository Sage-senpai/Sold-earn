'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import ApplyDialog from '@/components/ApplyDialog';
import { useWallet } from '@/lib/wallet';
import {
  useBounties,
  useScout,
  useScoutApplications,
  useScoutSales,
  useStore,
} from '@/lib/store';
import type { Bounty, ProductKind } from '@/lib/types';
import { APPLICATION_CAP_VALUE } from '@/lib/store';

const KINDS: Array<{ key: ProductKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'digital', label: 'Digital' },
  { key: 'service', label: 'Service' },
  { key: 'physical', label: 'Physical' },
];

export default function BrowseBounties() {
  const { wallet } = useWallet();
  const scout = useScout(wallet?.address);
  const all = useBounties({ activeOnly: true });
  const allBounties = useStore((s) => s.bounties);
  const allSales = useStore((s) => s.sales);

  const [region, setRegion] = useState<'Global' | 'Regional'>('Global');
  const [regionInput, setRegionInput] = useState('');
  const [productKind, setProductKind] = useState<ProductKind | 'all'>('all');
  const [openBounty, setOpenBounty] = useState<Bounty | null>(null);

  const apps = useScoutApplications(wallet?.address);
  const sales = useScoutSales(wallet?.address);
  const verifiedSet = new Set(sales.filter((s) => s.status === 'verified').map((s) => s.bountyId));
  const openCount = apps.filter((a) => a.status !== 'rejected' && !verifiedSet.has(a.bountyId)).length;

  const filtered = useMemo(() => {
    let list = all;
    if (productKind !== 'all') list = list.filter((b) => b.productKind === productKind);
    if (region === 'Regional' && regionInput.trim()) {
      const q = regionInput.trim().toLowerCase();
      list = list.filter((b) => b.region.toLowerCase().includes(q));
    }
    return list;
  }, [all, productKind, region, regionInput]);

  const protocolStats = useMemo(() => {
    const verifiedVolume = allSales
      .filter((s) => s.status === 'verified')
      .reduce((acc, s) => acc + s.payoutAmount, 0);
    const activeCount = allBounties.filter((b) => b.status === 'active').length;
    return { verifiedVolume, activeCount, totalListed: allBounties.length };
  }, [allBounties, allSales]);

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 sm:py-10 appear">
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr,320px]">
          {/* Main column */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <p className="font-mono text-[10px] uppercase text-earn-gray-600">Drive sales</p>
                <h1 className="font-eldritch text-2xl sm:text-3xl md:text-4xl font-bold">Open Bounties</h1>
              </div>
              {scout && (
                <div className="ink-card p-3 text-xs">
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600">Active applications</p>
                  <p className="metric-number font-bold text-lg">
                    {openCount} / {APPLICATION_CAP_VALUE}
                  </p>
                </div>
              )}
            </div>

            {/* Filter pills (Superteam-style) */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setProductKind(k.key)}
                  className={`pill ${productKind === k.key ? 'pill-active' : ''}`}
                >
                  {k.label}
                </button>
              ))}
              <span className="hidden sm:inline-block w-px h-5 bg-earn-gray-300 mx-1" />
              <button
                className={`pill ${region === 'Global' ? 'pill-active' : ''}`}
                onClick={() => setRegion('Global')}
              >
                Global
              </button>
              <button
                className={`pill ${region === 'Regional' ? 'pill-active' : ''}`}
                onClick={() => setRegion('Regional')}
              >
                Regional
              </button>
              {region === 'Regional' && (
                <input
                  className="field-input flex-1 min-w-[160px] !py-2 text-xs"
                  value={regionInput}
                  onChange={(e) => setRegionInput(e.target.value)}
                  placeholder="Lagos, EU, North America…"
                />
              )}
            </div>

            {!scout && (
              <div className="ink-card-accent border-l-4 border-earn-accent bg-earn-accent-soft/30 p-4 mb-5">
                <p className="font-mono text-[10px] uppercase">Heads up</p>
                <p className="text-sm mt-1">
                  You need a minted SBT before you can apply.{' '}
                  <Link href="/scout/signup" className="underline">
                    Sign up as a scout →
                  </Link>
                </p>
              </div>
            )}

            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="ink-card p-8 text-center text-earn-gray-700">
                  No bounties match these filters.
                </div>
              ) : (
                filtered.map((b) => {
                  const myApp = apps.find((a) => a.bountyId === b.id);
                  return <BountyRow key={b.id} bounty={b} myAppSalesId={myApp?.salesId} canApply={!!scout && openCount < APPLICATION_CAP_VALUE} onApply={() => setOpenBounty(b)} />;
                })
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="ink-panel p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-earn-gray-900 bg-earn-accent-soft/40">
                  <span className="font-mono text-xs font-bold">$</span>
                </div>
                <div className="min-w-0">
                  <p className="metric-number text-xl font-bold leading-tight">
                    ${protocolStats.verifiedVolume.toLocaleString()}<span className="font-mono text-[10px] uppercase text-earn-gray-600 ml-1">USD</span>
                  </p>
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600">Total Value Earned</p>
                </div>
              </div>
              <div className="rune-rule my-4" />
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-earn-gray-900 bg-earn-amber/30">
                  <span className="font-mono text-xs font-bold">◆</span>
                </div>
                <div className="min-w-0">
                  <p className="metric-number text-xl font-bold leading-tight">{protocolStats.totalListed}</p>
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600">Opportunities Listed</p>
                </div>
              </div>
            </div>

            <div className="ink-panel p-5">
              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mb-3">How it works</p>
              <ol className="space-y-3">
                <Step n="1" title="Mint your SBT" body="One soulbound identity per scout — non-transferable." />
                <Step n="2" title="Apply to a bounty" body="Receive a Sales ID. Share it on every pitch." />
                <Step n="3" title="Get paid on-chain" body="100% of reward, the moment the chain confirms." />
              </ol>
              {!scout && (
                <Link href="/scout/signup" className="btn-accent text-xs w-full mt-4">
                  Sign up as Scout
                </Link>
              )}
            </div>

            <div className="ink-panel p-5">
              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mb-3">Have something to sell?</p>
              <p className="text-sm text-earn-gray-700 mb-4">
                Hold a bounty, lock escrow, watch a guild of scouts move your product.
              </p>
              <Link href="/vendor/signup" className="btn-secondary text-xs w-full">
                Become a Vendor
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <ApplyDialog open={!!openBounty} onClose={() => setOpenBounty(null)} bounty={openBounty} />
    </main>
  );
}

function BountyRow({
  bounty,
  myAppSalesId,
  canApply,
  onApply,
}: {
  bounty: Bounty;
  myAppSalesId?: string;
  canApply: boolean;
  onApply: () => void;
}) {
  const initial = bounty.title.charAt(0).toUpperCase();
  return (
    <div className="ink-card p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center border border-earn-gray-900 bg-earn-accent-soft/30 font-eldritch text-xl font-bold"
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-eldritch text-base sm:text-lg font-bold leading-tight break-words">{bounty.title}</h3>
              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1">
                {bounty.productName} · {bounty.region}
              </p>
            </div>
            <span className="glyph-badge glyph-badge-accent shrink-0">
              {bounty.rewardAmount} {bounty.rewardToken}
            </span>
          </div>
          <p className="text-sm text-earn-gray-700 mt-2 line-clamp-2">{bounty.description}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">
              ◆ {bounty.productKind} · Target {bounty.targetSales} · Escrow ${bounty.escrowDeposited.toLocaleString()}
            </p>
            {myAppSalesId ? (
              <span className="font-mono text-[10px] uppercase text-earn-accent break-all">
                Sales ID: {myAppSalesId}
              </span>
            ) : (
              <button
                className="btn-accent text-xs"
                onClick={onApply}
                disabled={!canApply}
              >
                Apply
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-earn-gray-900 bg-white font-mono text-[10px] font-bold">
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-eldritch text-sm font-bold leading-tight">{title}</p>
        <p className="text-xs text-earn-gray-700 mt-0.5">{body}</p>
      </div>
    </li>
  );
}
