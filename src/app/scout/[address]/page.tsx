'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { useScout, useScoutApplications, useScoutSales, useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import type { Sale } from '@/lib/types';

export default function PublicScoutProfile() {
  const params = useParams<{ address: string }>();
  const address = decodeURIComponent(params.address);
  const scout = useScout(address);
  const apps = useScoutApplications(address);
  const sales = useScoutSales(address);
  const bounties = useStore((s) => s.bounties);
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== 'undefined') setShareUrl(window.location.href);
  }, []);

  const verified = sales.filter((s) => s.status === 'verified');
  const verifiedByBounty = new Map<string, Sale[]>();
  for (const s of verified) {
    const arr = verifiedByBounty.get(s.bountyId) ?? [];
    arr.push(s);
    verifiedByBounty.set(s.bountyId, arr);
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('Link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 sm:py-10 appear">
        <Link
          href="/scout/leaderboard"
          className="font-mono text-[10px] uppercase text-earn-gray-600 hover:text-earn-accent inline-flex items-center gap-1"
        >
          ← Leaderboard
        </Link>

        {!hydrated ? (
          <div className="ink-panel max-w-3xl mx-auto p-6 md:p-10 mt-4">
            <div className="h-6 w-1/2 bg-earn-gray-200 mb-3" />
            <div className="h-4 w-3/4 bg-earn-gray-200 mb-2" />
            <div className="h-4 w-2/3 bg-earn-gray-200" />
          </div>
        ) : !scout ? (
          <div className="ink-panel max-w-3xl mx-auto p-6 md:p-10 mt-4 text-center">
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Scout not in registry</p>
            <h1 className="font-eldritch text-2xl font-bold mt-2 break-all">{address}</h1>
            <p className="text-sm text-earn-gray-700 mt-4 max-w-prose mx-auto">
              No scout profile is registered to this wallet on this device. Profiles are local until the protocol
              moves to a server-of-record. If you&rsquo;re the scout, open this link from the device that signed up.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <Link href="/scout/leaderboard" className="btn-secondary text-xs">
                Browse leaderboard
              </Link>
              <Link href="/scout/signup" className="btn-accent text-xs">
                Become a scout
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
            <div className="ink-panel p-6 md:p-8">
              <p className="font-mono text-[10px] uppercase text-earn-gray-600">Scout</p>
              <h1 className="font-eldritch text-3xl md:text-4xl font-bold leading-tight mt-1 break-words">
                {scout.displayName}
              </h1>
              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-2 break-all">
                SBT · {scout.sbtMint}
              </p>
              <div className="rune-rule my-5" />
              <p className="text-sm md:text-base text-earn-gray-700 break-words">{scout.bio || 'No bio yet.'}</p>
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <span className="glyph-badge">{scout.region}</span>
                <span className="glyph-badge glyph-badge-accent">{scout.reputation}/100 rep</span>
                {scout.payoutLocked && <span className="glyph-badge glyph-badge-amber">Payout-locked</span>}
                {scout.socialX && (
                  <a
                    href={`https://x.com/${scout.socialX.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] uppercase underline hover:text-earn-accent"
                  >
                    {scout.socialX}
                  </a>
                )}
                {scout.socialTelegram && (
                  <a
                    href={`https://t.me/${scout.socialTelegram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] uppercase underline hover:text-earn-accent"
                  >
                    {scout.socialTelegram}
                  </a>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn-secondary text-xs" onClick={copyLink}>
                  Copy profile link
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total earned" value={`${scout.totalEarned.toLocaleString()} USDC`} />
                <Stat label="Verified sales" value={verified.length.toString()} />
                <Stat label="Active applications" value={apps.length.toString()} />
                <Stat label="Reputation" value={`${scout.reputation}/100`} />
              </div>

              <div className="ink-panel p-5">
                <h2 className="font-eldritch text-lg font-bold">Active bounties</h2>
                <div className="rune-rule my-3" />
                {apps.length === 0 ? (
                  <p className="text-sm text-earn-gray-700">No active applications.</p>
                ) : (
                  <ul className="space-y-2">
                    {apps.map((a) => {
                      const b = bounties.find((bb) => bb.id === a.bountyId);
                      const bountyVerified = verifiedByBounty.get(a.bountyId)?.length ?? 0;
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 border border-earn-gray-200 p-2 flex-wrap"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold break-words">
                              {a.bountyTitle}
                            </p>
                            <p className="font-mono text-[10px] uppercase text-earn-gray-600 break-all">
                              {a.salesId}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {b && (
                              <span className="glyph-badge glyph-badge-accent">
                                {b.rewardAmount} {b.rewardToken}
                              </span>
                            )}
                            <span className="font-mono text-[10px] uppercase">
                              {bountyVerified} verified
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ink-card p-4">
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</p>
      <p className="metric-number mt-1 text-xl font-bold break-words">{value}</p>
    </div>
  );
}
