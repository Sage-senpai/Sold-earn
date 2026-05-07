'use client';

export default function Hero() {
  return (
    <section className="section-shell relative z-10 flex min-h-[calc(100vh-6rem)] items-center pt-12 pb-12 appear">
      <div className="grid w-full gap-8 md:grid-cols-[1.1fr,0.9fr] items-center">
        <div>
          <div className="glyph-badge mb-6">Decentralized Sales Guild · Solana</div>
          <h1 className="shadow-word font-eldritch text-5xl font-bold leading-[1.05] md:text-7xl">
            Sales,
            <br />
            <span className="text-earn-accent">on-chain.</span>
          </h1>
          <div className="rune-rule my-8" />
          <p className="max-w-xl text-base md:text-lg text-earn-gray-700">
            Vendors hold bounties in escrow. Scouts mint a soulbound identity, generate a Sales ID, and earn 100% of the
            reward on every verified sale — paid the moment the chain confirms.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#paths" className="btn-accent">
              Pick Your Path
            </a>
            <a href="/scout/bounties" className="btn-secondary">
              Browse Bounties
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="ink-panel p-6 md:p-8">
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Live Protocol</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat k="Verified Volume" v="$214,830" />
              <Stat k="Active Bounties" v="42" />
              <Stat k="Scouts (SBT)" v="1,317" />
              <Stat k="Avg. Payout" v="$48" />
            </div>
            <div className="rune-rule my-6" />
            <p className="font-mono text-[10px] uppercase text-earn-gray-600">Latest Sales ID</p>
            <p className="metric-number mt-2 text-lg font-bold">SE-9MQ4F2-7K3X-9Q4</p>
          </div>
          <div className="absolute -bottom-3 -left-3 h-full w-full -z-10 border border-earn-ink" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">{k}</p>
      <p className="metric-number mt-1 text-2xl font-bold">{v}</p>
    </div>
  );
}
