'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { useStore, useBounty, useScout } from '@/lib/store';
import { verifySalesId } from '@/lib/sales';

export default function PublicSaleLink() {
  const params = useParams<{ salesId: string }>();
  const salesId = params.salesId;
  const application = useStore((s) => s.applications.find((a) => a.salesId === salesId));
  const bounty = useBounty(application?.bountyId);
  const scout = useScout(application?.scoutAddress);

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-12 appear">
        <div className="ink-panel max-w-2xl mx-auto p-8 md:p-10">
          <p className="glyph-badge glyph-badge-accent">Verified Sales Link</p>
          <h1 className="font-eldritch text-3xl font-bold md:text-4xl mt-4 break-all">{salesId}</h1>
          <div className="rune-rule my-6" />

          {!application || !bounty || !scout ? (
            <div className="text-center py-6">
              <p className="text-earn-gray-700">This Sales ID is not in our registry.</p>
              <Link href="/scout/bounties" className="btn-secondary text-xs mt-4 inline-flex">
                Browse bounties
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-eldritch text-xl font-bold">{bounty.title}</h2>
              <p className="text-earn-gray-700 mt-2">{bounty.description}</p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Field label="Reward" value={`${bounty.rewardAmount} ${bounty.rewardToken}`} />
                <Field label="Region" value={bounty.region} />
                <Field label="Scout" value={scout.displayName} />
                <Field label="SBT" value={scout.sbtMint} mono />
              </div>

              <div className="mt-6 border-l-4 border-earn-accent bg-earn-accent-soft/30 p-3">
                <p className="font-mono text-[10px] uppercase">Authenticity</p>
                <p className="text-xs mt-1">
                  {verifySalesId(salesId, {
                    sbtMint: application.sbtMint,
                    scoutAddress: application.scoutAddress,
                    bountyId: application.bountyId,
                  })
                    ? 'Verified — Sales ID matches the scout SBT on record.'
                    : 'Could not verify — Sales ID and SBT do not match.'}
                </p>
              </div>

              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mt-6">
                Buyers: confirming this purchase credits the scout above. Payout flows from the bounty escrow on
                vendor verification.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-earn-gray-200 p-3">
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{label}</p>
      <p className={`mt-1 ${mono ? 'font-mono text-xs break-all' : 'text-sm font-bold'}`}>{value}</p>
    </div>
  );
}
