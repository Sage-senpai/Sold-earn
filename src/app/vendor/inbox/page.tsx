'use client';

import Link from 'next/link';
import Nav from '@/components/Nav';
import { useWallet } from '@/lib/wallet';
import { useBounty, useVendorInbox } from '@/lib/store';
import type { Sale } from '@/lib/types';

export default function VendorInbox() {
  const { wallet, role } = useWallet();
  const { pending, history } = useVendorInbox(role === 'vendor' ? wallet?.address : undefined);

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 sm:py-10 appear">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Vendor Inbox</p>
            <h1 className="font-eldritch text-2xl sm:text-3xl md:text-4xl font-bold">
              Sales awaiting your review
            </h1>
            <p className="text-sm text-earn-gray-700 mt-2 max-w-xl">
              Every sale a scout submits across all your bounties lands here. Verify on the bounty page so the
              on-chain release runs against the right escrow.
            </p>
          </div>
          <Link href="/vendor/dashboard" className="btn-secondary text-xs">
            ← Dashboard
          </Link>
        </div>

        {!wallet || role !== 'vendor' ? (
          <div className="ink-card p-8 text-center">
            <p className="text-earn-gray-700">Connect a vendor wallet to see your inbox.</p>
            <Link href="/vendor/signup" className="btn-accent text-xs mt-4 inline-flex">
              Sign up as Vendor
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="ink-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-eldritch text-lg sm:text-xl font-bold">
                  Pending
                  <span className="ml-2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-earn-accent text-white text-xs font-bold rounded-full align-middle">
                    {pending.length}
                  </span>
                </h2>
                <p className="font-mono text-[10px] uppercase text-earn-gray-600">
                  Newest first
                </p>
              </div>
              <div className="rune-rule my-4" />
              {pending.length === 0 ? (
                <p className="text-sm text-earn-gray-700">
                  Nothing pending. Scouts will appear here when they log sales against your bounties.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pending.map((s) => (
                    <SaleRow key={s.id} sale={s} cta="review" />
                  ))}
                </ul>
              )}
            </div>

            <div className="ink-panel p-5 sm:p-6">
              <h2 className="font-eldritch text-lg sm:text-xl font-bold">History</h2>
              <p className="font-mono text-[10px] uppercase text-earn-gray-600">Verified + rejected</p>
              <div className="rune-rule my-4" />
              {history.length === 0 ? (
                <p className="text-sm text-earn-gray-700">No reviewed sales yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.slice(0, 20).map((s) => (
                    <SaleRow key={s.id} sale={s} cta="open" compact />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function SaleRow({
  sale,
  cta,
  compact,
}: {
  sale: Sale;
  cta: 'review' | 'open';
  compact?: boolean;
}) {
  const bounty = useBounty(sale.bountyId);
  const statusClass =
    sale.status === 'verified'
      ? 'glyph-badge glyph-badge-accent'
      : sale.status === 'rejected'
        ? 'glyph-badge'
        : 'glyph-badge glyph-badge-amber';

  return (
    <li className="border border-earn-gray-200 p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold break-all">{sale.salesId}</p>
          <p className={`mt-1 text-sm ${compact ? 'line-clamp-1' : 'line-clamp-2'} break-words`}>
            {sale.buyerNote}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase text-earn-gray-600">
            <span className="break-words">{bounty?.title ?? 'unknown bounty'}</span>
            <span>·</span>
            <span>
              {sale.payoutAmount} {bounty?.rewardToken ?? ''}
            </span>
            <span>·</span>
            <span>{new Date(sale.createdAt).toLocaleString()}</span>
          </div>
          {!compact && (
            <p className="font-mono text-[10px] uppercase text-earn-gray-500 mt-1 break-all">
              tx: {sale.txHash}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <span className={statusClass}>{sale.status}</span>
          {bounty && (
            <Link
              href={`/vendor/dashboard/${bounty.id}`}
              className="btn-secondary text-[10px] px-3 py-1"
            >
              {cta === 'review' ? 'Review →' : 'Open →'}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
