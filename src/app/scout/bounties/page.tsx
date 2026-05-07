'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import ApplyDialog from '@/components/ApplyDialog';
import { useWallet } from '@/lib/wallet';
import { useBounties, useScout, useScoutApplications, useScoutSales } from '@/lib/store';
import type { Bounty, ProductKind } from '@/lib/types';
import { APPLICATION_CAP_VALUE } from '@/lib/store';

export default function BrowseBounties() {
  const { wallet } = useWallet();
  const scout = useScout(wallet?.address);
  const all = useBounties({ activeOnly: true });
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

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-10 appear">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Drive sales</p>
            <h1 className="font-eldritch text-3xl font-bold md:text-4xl">Open Bounties</h1>
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

        <div className="ink-panel p-4 mb-6 grid gap-3 md:grid-cols-[auto,1fr,auto] items-end">
          <div className="flex gap-2">
            <button
              className={region === 'Global' ? 'btn-accent text-xs' : 'btn-secondary text-xs'}
              onClick={() => setRegion('Global')}
            >
              Global
            </button>
            <button
              className={region === 'Regional' ? 'btn-accent text-xs' : 'btn-secondary text-xs'}
              onClick={() => setRegion('Regional')}
            >
              Regional
            </button>
          </div>
          {region === 'Regional' ? (
            <input
              className="field-input"
              value={regionInput}
              onChange={(e) => setRegionInput(e.target.value)}
              placeholder="Lagos, EU, North America…"
            />
          ) : (
            <div />
          )}
          <select
            className="field-input"
            value={productKind}
            onChange={(e) => setProductKind(e.target.value as ProductKind | 'all')}
          >
            <option value="all">All product types</option>
            <option value="digital">Digital</option>
            <option value="service">Service</option>
            <option value="physical">Physical</option>
          </select>
        </div>

        {!scout && (
          <div className="ink-card-accent border-l-4 border-earn-accent bg-earn-accent-soft/30 p-4 mb-6">
            <p className="font-mono text-[10px] uppercase">Heads up</p>
            <p className="text-sm mt-1">
              You need a minted SBT before you can apply.{' '}
              <Link href="/scout/signup" className="underline">
                Sign up as a scout →
              </Link>
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((b) => {
            const myApp = apps.find((a) => a.bountyId === b.id);
            return (
              <div key={b.id} className="ink-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-eldritch text-lg font-bold leading-tight">{b.title}</h3>
                    <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1">{b.region} · {b.productKind}</p>
                  </div>
                  <span className="glyph-badge glyph-badge-accent">{b.rewardAmount} {b.rewardToken}</span>
                </div>
                <p className="text-sm text-earn-gray-700 mt-3 line-clamp-3">{b.description}</p>
                <div className="rune-rule my-4" />
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600">
                    Target {b.targetSales} · Escrow ${b.escrowDeposited.toLocaleString()}
                  </p>
                  {myApp ? (
                    <span className="font-mono text-[10px] uppercase text-earn-accent">Sales ID: {myApp.salesId}</span>
                  ) : (
                    <button
                      className="btn-accent text-xs"
                      onClick={() => setOpenBounty(b)}
                      disabled={!scout || openCount >= APPLICATION_CAP_VALUE}
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ApplyDialog open={!!openBounty} onClose={() => setOpenBounty(null)} bounty={openBounty} />
    </main>
  );
}
