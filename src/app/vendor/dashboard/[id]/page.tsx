'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import {
  pauseBounty,
  reviewSale,
  useBounty,
  useBountyApplications,
  useBountySales,
  useScoutLeaderboardForBounty,
} from '@/lib/store';
import { useToast } from '@/lib/toast';

export default function VendorBountyDetail() {
  const params = useParams<{ id: string }>();
  const bounty = useBounty(params.id);
  const applications = useBountyApplications(params.id);
  const sales = useBountySales(params.id);
  const board = useScoutLeaderboardForBounty(params.id);
  const { toast } = useToast();

  if (!bounty) {
    return (
      <main className="min-h-screen">
        <Nav />
        <div className="section-shell pt-16 text-center">
          <p>Bounty not found.</p>
          <Link href="/vendor/dashboard" className="btn-secondary text-xs mt-4 inline-flex">
            Back
          </Link>
        </div>
      </main>
    );
  }

  const verified = sales.filter((s) => s.status === 'verified').length;

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-10 appear">
        <Link href="/vendor/dashboard" className="font-mono text-[10px] uppercase text-earn-gray-600 hover:text-earn-accent">
          ← All bounties
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-eldritch text-3xl font-bold md:text-4xl">{bounty.title}</h1>
            <p className="mt-2 max-w-2xl text-earn-gray-700">{bounty.description}</p>
          </div>
          <button
            className="btn-secondary text-xs"
            onClick={() => {
              pauseBounty(bounty.id);
              toast(`Bounty ${bounty.status === 'active' ? 'paused' : 'resumed'}`, 'info');
            }}
          >
            {bounty.status === 'active' ? 'Pause' : 'Resume'}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4 my-8">
          <Stat label="Reward / Sale" value={`${bounty.rewardAmount} ${bounty.rewardToken}`} />
          <Stat label="Target" value={bounty.targetSales.toString()} />
          <Stat label="Verified" value={`${verified} / ${bounty.targetSales}`} />
          <Stat label="Escrow" value={`$${bounty.escrowDeposited.toLocaleString()}`} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="ink-panel p-6">
            <h2 className="font-eldritch text-xl font-bold">Scout Leaderboard</h2>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Ranked by verified sales</p>
            <div className="rune-rule my-4" />
            {board.length === 0 ? (
              <p className="text-sm text-earn-gray-600">No scouts have applied yet.</p>
            ) : (
              <ol className="space-y-2">
                {board.map((row, i) => (
                  <li key={row.salesId} className="flex items-center justify-between gap-3 border border-earn-gray-200 p-2">
                    <div className="flex items-center gap-3">
                      <span className="glyph-badge">#{i + 1}</span>
                      <div>
                        <p className="font-mono text-xs font-bold">{row.displayName}</p>
                        <p className="font-mono text-[10px] uppercase text-earn-gray-600">{row.salesId}</p>
                      </div>
                    </div>
                    <span className="metric-number font-bold">{row.verifiedSales}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="ink-panel p-6">
            <h2 className="font-eldritch text-xl font-bold">Pending Sales</h2>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Verify or reject scout submissions</p>
            <div className="rune-rule my-4" />
            {sales.filter((s) => s.status === 'pending').length === 0 ? (
              <p className="text-sm text-earn-gray-600">No pending submissions.</p>
            ) : (
              <ul className="space-y-2">
                {sales
                  .filter((s) => s.status === 'pending')
                  .map((s) => (
                    <li key={s.id} className="border border-earn-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-bold">{s.salesId}</p>
                          <p className="text-xs mt-1">{s.buyerNote}</p>
                          <p className="font-mono text-[10px] uppercase text-earn-gray-500 mt-1">tx: {s.txHash}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            className="btn-accent text-[10px] px-3 py-1"
                            onClick={() => {
                              reviewSale(s.id, 'verified');
                              toast(`Released ${s.payoutAmount} ${bounty.rewardToken} to ${s.scoutAddress.slice(0, 6)}…`, 'success');
                            }}
                          >
                            Verify
                          </button>
                          <button
                            className="btn-secondary text-[10px] px-3 py-1"
                            onClick={() => {
                              reviewSale(s.id, 'rejected');
                              toast('Sale rejected', 'info');
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        <div className="ink-panel p-6 mt-6">
          <h2 className="font-eldritch text-xl font-bold">Applications ({applications.length})</h2>
          <div className="rune-rule my-4" />
          {applications.length === 0 ? (
            <p className="text-sm text-earn-gray-600">No scouts have applied yet.</p>
          ) : (
            <ul className="space-y-1">
              {applications.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 font-mono text-xs">
                  <span>{a.salesId}</span>
                  <span className="text-earn-gray-600">{a.scoutAddress.slice(0, 8)}…</span>
                </li>
              ))}
            </ul>
          )}
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
