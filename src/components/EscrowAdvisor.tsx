'use client';

import type { EscrowAdvice } from '@/lib/agents/escrowAdvisor';

type Props = {
  advice: EscrowAdvice;
  token: 'USDC' | 'SOL';
  onTopUp: (amount: number) => void;
};

// Banner on the bounty detail page. Hidden when severity === 'ok' to keep
// the dashboard quiet when nothing's wrong.
export default function EscrowAdvisor({ advice, token, onTopUp }: Props) {
  if (advice.severity === 'ok') return null;

  const tone =
    advice.severity === 'critical'
      ? 'border-rose-400 bg-rose-50/60 text-rose-900'
      : 'border-amber-400 bg-amber-50/60 text-amber-900';

  return (
    <div className={`ink-card-accent border-l-4 ${tone} p-4 mt-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase">
            agent · escrow {advice.severity === 'critical' ? 'critical' : 'low'}
          </p>
          <p className="text-sm mt-1 break-words">{advice.reason}</p>
          <p className="font-mono text-[10px] text-earn-gray-700 mt-1">
            pending obligation {fmt(advice.pendingObligation)} · free{' '}
            {fmt(advice.freeBalance)}
          </p>
        </div>
        {advice.suggestedTopUp > 0 && (
          <button
            type="button"
            className="btn-accent text-xs whitespace-nowrap"
            onClick={() => onTopUp(advice.suggestedTopUp)}
          >
            Top up {advice.suggestedTopUp.toLocaleString()} {token}
            <span className="ml-1 font-mono text-[9px] opacity-80">
              · {advice.runwayAfterTopUpSales} sales
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
