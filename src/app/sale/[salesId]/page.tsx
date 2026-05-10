'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Nav from '@/components/Nav';
import { useStore, useBounty, useScout } from '@/lib/store';
import { verifySalesId } from '@/lib/sales';
import { useToast } from '@/lib/toast';
import { buildSolanaPayUrl, referenceFor } from '@/lib/solana-pay';

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((m) => m.QRCodeSVG),
  { ssr: false },
);

export default function PublicSaleLink() {
  const params = useParams<{ salesId: string }>();
  const salesId = params.salesId;
  const application = useStore((s) => s.applications.find((a) => a.salesId === salesId));
  const bounty = useBounty(application?.bountyId);
  const scout = useScout(application?.scoutAddress);
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== 'undefined') setShareUrl(window.location.href);
  }, []);

  const verified =
    application &&
    verifySalesId(salesId, {
      sbtMint: application.sbtMint,
      scoutAddress: application.scoutAddress,
      bountyId: application.bountyId,
    });

  const payUrl = useMemo(() => {
    if (!bounty || !application) return null;
    return buildSolanaPayUrl({
      salesId,
      recipient: bounty.vendorAddress,
      amount: bounty.rewardAmount,
      label: bounty.title,
      message: `Pay ${bounty.title} via SOLd · Earn`,
    });
  }, [salesId, bounty, application]);

  const reference = useMemo(() => referenceFor(salesId).toBase58(), [salesId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('Link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  };

  const shareToX = () => {
    if (!bounty || !scout) return;
    const text = `I'm earning on @SOLd_protocol — ${bounty.title} via Sales ID ${salesId}. Verified payout on every sale.`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-8 md:py-12 appear">
        <Link
          href="/scout/bounties"
          className="font-mono text-[10px] uppercase text-earn-gray-600 hover:text-earn-accent inline-flex items-center gap-1"
        >
          ← All bounties
        </Link>

        <div className="ink-panel max-w-2xl mx-auto p-6 md:p-10 mt-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`glyph-badge ${verified ? 'glyph-badge-accent' : 'glyph-badge-amber'}`}>
              {verified ? 'Verified Sales Link' : 'Sales Link'}
            </span>
            {hydrated && application && (
              <span className="glyph-badge">SBT-bound</span>
            )}
          </div>

          <p className="font-mono text-[10px] uppercase text-earn-gray-600">Sales ID</p>
          <h1 className="font-eldritch text-2xl md:text-3xl font-bold mt-1 break-all leading-tight">
            {salesId}
          </h1>
          <div className="rune-rule my-6" />

          {!hydrated ? (
            <div className="py-6">
              <div className="h-4 w-2/3 bg-earn-gray-200 mb-3" />
              <div className="h-4 w-5/6 bg-earn-gray-200 mb-3" />
              <div className="h-4 w-1/2 bg-earn-gray-200" />
            </div>
          ) : !application || !bounty || !scout ? (
            <NotInLocalRegistry salesId={salesId} />
          ) : (
            <>
              <h2 className="font-eldritch text-xl md:text-2xl font-bold leading-tight">{bounty.title}</h2>
              <p className="text-sm md:text-base text-earn-gray-700 mt-2">{bounty.description}</p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Field label="Reward" value={`${bounty.rewardAmount} ${bounty.rewardToken}`} />
                <Field label="Region" value={bounty.region} />
                <Field label="Scout" value={scout.displayName} />
                <Field label="SBT" value={scout.sbtMint} mono />
              </div>

              <div
                className={`mt-6 border-l-4 p-3 ${
                  verified ? 'border-earn-accent bg-earn-accent-soft/30' : 'border-earn-amber bg-earn-amber/10'
                }`}
              >
                <p className="font-mono text-[10px] uppercase">Authenticity</p>
                <p className="text-xs mt-1">
                  {verified
                    ? 'Verified — Sales ID matches the scout SBT on record.'
                    : 'Could not verify — Sales ID and SBT do not match.'}
                </p>
              </div>

              {verified && payUrl && (
                <div className="mt-8 ink-card-accent border-l-4 border-earn-accent bg-earn-accent-soft/30 p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-[auto,1fr] items-start">
                    <div className="bg-white p-2 border border-earn-gray-900 self-start">
                      <QRCodeSVG value={payUrl} size={140} level="M" includeMargin={false} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase text-earn-gray-700">Solana Pay</p>
                      <p className="font-eldritch text-xl font-bold mt-1">
                        Pay {bounty.rewardAmount} {bounty.rewardToken}
                      </p>
                      <p className="text-xs text-earn-gray-700 mt-1">
                        Scan with any Solana Pay-compatible wallet, or open in your phone&rsquo;s wallet.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={payUrl} className="btn-accent text-xs" rel="noopener noreferrer">
                          {bounty.productKind === 'service' ? 'Book' : 'Pay'} now
                        </a>
                        <button
                          className="btn-secondary text-xs"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(payUrl);
                              toast('Pay link copied', 'success');
                            } catch {
                              toast('Could not copy', 'error');
                            }
                          }}
                        >
                          Copy pay link
                        </button>
                      </div>
                      <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-3 break-all">
                        ref · {reference}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn-secondary text-xs" onClick={copyLink}>
                  Copy link
                </button>
                <button className="btn-secondary text-xs" onClick={shareToX}>
                  Share on X
                </button>
                <Link
                  href={`/scout/${encodeURIComponent(application.scoutAddress)}`}
                  className="btn-secondary text-xs"
                >
                  View scout profile
                </Link>
              </div>

              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-6">
                Every Solana Pay tx that includes the reference above is auto-attributed to this Sales ID. The
                vendor verifies, the bounty escrow releases, the scout earns.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function NotInLocalRegistry({ salesId }: { salesId: string }) {
  return (
    <div className="py-2">
      <p className="text-sm text-earn-gray-700">
        We couldn&rsquo;t find <span className="font-mono break-all">{salesId}</span> in this device&rsquo;s registry.
      </p>
      <p className="text-sm text-earn-gray-700 mt-2">
        Sales IDs are issued to scouts and bound to their SBT. If you arrived here from a scout&rsquo;s pitch, the
        registry will resolve once the on-chain index syncs to your browser.
      </p>
      <ul className="list-disc list-inside text-xs text-earn-gray-600 mt-4 space-y-1">
        <li>Make sure the link wasn&rsquo;t truncated.</li>
        <li>If you&rsquo;re the scout, open this link from the device that issued the ID.</li>
        <li>If the bounty has been paused or filled, the link still verifies but isn&rsquo;t purchasable.</li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/scout/bounties" className="btn-accent text-xs">
          Browse open bounties
        </Link>
        <Link href="/" className="btn-secondary text-xs">
          What is SOLd · Earn?
        </Link>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-earn-gray-200 p-3">
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</p>
      <p className={`mt-1 ${mono ? 'font-mono text-xs break-all' : 'text-sm font-bold break-words'}`}>{value}</p>
    </div>
  );
}
