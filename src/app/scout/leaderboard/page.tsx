'use client';

import Nav from '@/components/Nav';
import { useStore } from '@/lib/store';

export default function LeaderboardPage() {
  const sales = useStore((s) => s.sales);
  const scouts = useStore((s) => s.scouts);

  const verifiedByScout = new Map<string, { count: number; volume: number }>();
  for (const s of sales) {
    if (s.status !== 'verified') continue;
    const cur = verifiedByScout.get(s.scoutAddress) ?? { count: 0, volume: 0 };
    cur.count += 1;
    cur.volume += s.payoutAmount;
    verifiedByScout.set(s.scoutAddress, cur);
  }

  const rows = Array.from(verifiedByScout.entries())
    .map(([address, agg]) => {
      const profile = scouts[address];
      return {
        address,
        displayName: profile?.displayName ?? address.slice(0, 8),
        region: profile?.region ?? '—',
        sbt: profile?.sbtMint ?? '—',
        ...agg,
      };
    })
    .sort((a, b) => b.volume - a.volume);

  return (
    <main className="relative min-h-screen overflow-hidden text-earn-gray-900">
      <div className="nascent-bg" aria-hidden="true" />
      <Nav />

      <section className="section-shell relative z-10 py-10 appear">
        <p className="font-mono text-[10px] uppercase text-earn-gray-600">Protocol-wide</p>
        <h1 className="font-eldritch text-3xl font-bold md:text-4xl mb-6">Top Scouts</h1>

        {rows.length === 0 ? (
          <div className="ink-card p-8 text-center text-earn-gray-700">
            No verified sales yet — be the first.
          </div>
        ) : (
          <div className="ink-panel p-2">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <Th>#</Th>
                  <Th>Scout</Th>
                  <Th>Region</Th>
                  <Th>SBT</Th>
                  <Th>Verified</Th>
                  <Th>Volume</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.address} className="border-t border-earn-gray-200">
                    <Td>{i + 1}</Td>
                    <Td bold>{r.displayName}</Td>
                    <Td>{r.region}</Td>
                    <Td mono>{r.sbt}</Td>
                    <Td mono>{r.count}</Td>
                    <Td mono>${r.volume.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="font-mono text-[10px] uppercase text-earn-gray-600 px-3 py-3">{children}</th>;
}
function Td({ children, bold, mono }: { children: React.ReactNode; bold?: boolean; mono?: boolean }) {
  return (
    <td className={`px-3 py-3 ${bold ? 'font-bold' : ''} ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{children}</td>
  );
}
