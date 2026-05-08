'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import BarChart from '@/components/charts/BarChart';
import { useWallet } from '@/lib/wallet';
import {
  APPLICATION_CAP_VALUE,
  recordSale,
  useBounty,
  useScout,
  useScoutApplications,
  useScoutSales,
} from '@/lib/store';
import { useToast } from '@/lib/toast';

export default function ScoutDashboard() {
  const { wallet } = useWallet();
  const scout = useScout(wallet?.address);
  const apps = useScoutApplications(wallet?.address);
  const sales = useScoutSales(wallet?.address);
  const { toast } = useToast();

  const [activeAppId, setActiveAppId] = useState<string | null>(apps[0]?.id ?? null);
  const activeApp = useMemo(() => apps.find((a) => a.id === activeAppId) ?? apps[0], [apps, activeAppId]);
  const activeBounty = useBounty(activeApp?.bountyId);

  const verifiedSet = new Set(sales.filter((s) => s.status === 'verified').map((s) => s.bountyId));
  const openCount = apps.filter((a) => a.status !== 'rejected' && !verifiedSet.has(a.bountyId)).length;

  const perBountyData = apps.map((a) => ({
    label: a.bountyTitle.split(' ')[0],
    value: sales.filter((s) => s.bountyId === a.bountyId && s.status === 'verified').length,
  }));

  const onLogSale = () => {
    if (!activeApp) return;
    const note = window.prompt('Buyer / merchant note (e.g. "Alpha Books, Lagos")');
    if (!note) return;
    const tx = `mock_sale_${Math.random().toString(36).slice(2, 8)}`;
    recordSale({
      application: activeApp,
      buyerNote: note,
      txHash: tx,
      payoutAmount: activeBounty?.rewardAmount ?? 0,
    });
    toast('Sale submitted — awaiting vendor verify', 'success');
  };

  if (!scout) {
    return (
      <main className="min-h-screen">
        <Nav />
        <div className="section-shell pt-16 text-center">
          <p>Mint your scout identity first.</p>
          <Link href="/scout/signup" className="btn-accent text-xs mt-4 inline-flex">
            Sign up as Scout
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 sm:py-10 appear">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Scout Dashboard</p>
            <h1 className="font-eldritch text-2xl sm:text-3xl md:text-4xl font-bold break-words">{scout.displayName}</h1>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-1 break-all">SBT · {scout.sbtMint}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/scout/bounties" className="btn-secondary text-xs">
              Browse bounties
            </Link>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
          <Stat label="Total Earned" value={`${scout.totalEarned.toLocaleString()} USDC`} />
          <Stat label="Verified Sales" value={sales.filter((s) => s.status === 'verified').length.toString()} />
          <Stat label="Active Apps" value={`${openCount} / ${APPLICATION_CAP_VALUE}`} />
          <Stat label="Reputation" value={`${scout.reputation} / 100`} />
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
          <div className="ink-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-eldritch text-xl font-bold">My Bounties</h2>
              {apps.length > 1 && (
                <select
                  className="field-input text-xs max-w-[60%] truncate"
                  value={activeApp?.id}
                  onChange={(e) => setActiveAppId(e.target.value)}
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bountyTitle}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="rune-rule my-4" />

            {!activeApp ? (
              <p className="text-sm text-earn-gray-600">
                No applications yet.{' '}
                <Link href="/scout/bounties" className="underline">
                  Browse bounties →
                </Link>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <Mini label="Bounty" value={activeApp.bountyTitle} />
                  <Mini label="Sales ID" value={activeApp.salesId} mono />
                  <Mini label="Reward" value={`${activeBounty?.rewardAmount ?? '?'} ${activeBounty?.rewardToken ?? ''}`} />
                  <Mini label="Sales Link" value={`/sale/${activeApp.salesId}`} mono />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-accent text-xs" onClick={onLogSale}>
                    Log a sale
                  </button>
                  <Link href={`/sale/${activeApp.salesId}`} className="btn-secondary text-xs">
                    Open sales link
                  </Link>
                </div>

                <div className="mt-6">
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600 mb-2">Verified sales per bounty</p>
                  <BarChart data={perBountyData} />
                </div>
              </>
            )}
          </div>

          <div className="ink-panel p-6">
            <h2 className="font-eldritch text-xl font-bold">Recent Sales</h2>
            <div className="rune-rule my-4" />
            {sales.length === 0 ? (
              <p className="text-sm text-earn-gray-600">No sales recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {sales.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border border-earn-gray-200 p-2">
                    <div>
                      <p className="font-mono text-xs font-bold">{s.salesId}</p>
                      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{s.buyerNote}</p>
                    </div>
                    <span
                      className={
                        s.status === 'verified'
                          ? 'glyph-badge glyph-badge-accent'
                          : s.status === 'rejected'
                            ? 'glyph-badge'
                            : 'glyph-badge glyph-badge-amber'
                      }
                    >
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
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

function Mini({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-earn-gray-200 p-2">
      <p className="font-mono text-[9px] uppercase text-earn-gray-600">{label}</p>
      <p className={`mt-1 text-xs font-bold ${mono ? 'font-mono break-all' : ''}`}>{value}</p>
    </div>
  );
}
