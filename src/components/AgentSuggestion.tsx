'use client';

import type { VerificationDecision, VerificationSignal } from '@/lib/supabase';

type Props = {
  decision: VerificationDecision;
  confidence: number;
  signals: VerificationSignal[];
  reasoning: string | null;
};

// Compact agent verdict chip + expandable signals list. Lives next to the
// Verify/Reject buttons on the vendor dashboard so the human always sees
// the agent's reasoning before clicking.
export default function AgentSuggestion({ decision, confidence, signals, reasoning }: Props) {
  const tone = toneFor(decision);
  const failed = signals.filter((s) => !s.ok && s.weight > 0);
  const onChainProven = signals.some(
    (s) => s.key === 'tx_recipient_is_vendor' && s.ok && s.weight >= 1.0,
  );

  return (
    <details className="mt-2 group">
      <summary className="flex flex-wrap items-center gap-2 cursor-pointer select-none">
        <span
          className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${tone.chip}`}
          title="Sale Verifier (agent suggestion)"
        >
          agent · {labelFor(decision)}
        </span>
        <span className="font-mono text-[10px] text-earn-gray-600">
          conf {Math.round(confidence * 100)}%
        </span>
        {onChainProven && (
          <span
            className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-emerald-400 text-emerald-800 bg-emerald-50"
            title="USDC payment confirmed on-chain to the vendor's wallet"
          >
            chain ✓
          </span>
        )}
        {failed.length > 0 && (
          <span className="font-mono text-[10px] text-earn-gray-600">
            · {failed.length} flag{failed.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="font-mono text-[10px] text-earn-gray-500 underline group-open:hidden">
          why
        </span>
      </summary>
      <div className="mt-2 border-l-2 border-earn-gray-200 pl-2 space-y-1">
        {signals.map((s) => (
          <div key={s.key} className="flex items-start gap-2 font-mono text-[10px]">
            <span className={s.ok ? 'text-emerald-700' : 'text-rose-700'}>
              {s.ok ? '✓' : '✗'}
            </span>
            <span className="break-words">
              <span className="uppercase">{prettyKey(s.key)}</span>
              {s.detail && <span className="text-earn-gray-600"> — {s.detail}</span>}
            </span>
          </div>
        ))}
        {reasoning && (
          <p className="font-mono text-[10px] text-earn-gray-600 mt-1 break-words">
            note: {reasoning}
          </p>
        )}
      </div>
    </details>
  );
}

function labelFor(d: VerificationDecision): string {
  if (d === 'auto_approve') return 'looks good';
  if (d === 'auto_reject') return 'reject';
  return 'review';
}

function toneFor(d: VerificationDecision): { chip: string } {
  if (d === 'auto_approve') return { chip: 'border-emerald-400 text-emerald-800 bg-emerald-50' };
  if (d === 'auto_reject') return { chip: 'border-rose-400 text-rose-800 bg-rose-50' };
  return { chip: 'border-earn-gray-400 text-earn-gray-800 bg-earn-gray-50' };
}

const KEY_LABELS: Record<string, string> = {
  amount_matches_bounty: 'amount matches bounty',
  tx_hash_unique: 'tx hash unique',
  bounty_active: 'bounty active',
  tx_format_plausible: 'tx format plausible',
  velocity_under_threshold: 'velocity under threshold',
  buyer_note_unique_for_scout: 'buyer note unique for scout',
  buyer_note_quality: 'buyer note quality',
  tx_on_chain_exists: 'on-chain · tx confirmed',
  tx_recipient_is_vendor: 'on-chain · vendor received funds',
  tx_amount_matches_bounty: 'on-chain · amount matches reward',
  tx_not_self_pay: 'on-chain · not self-pay',
  tx_age_recent: 'on-chain · recent tx',
  tx_on_chain_check_skipped: 'on-chain check skipped',
};

function prettyKey(k: string): string {
  return KEY_LABELS[k] ?? k.replace(/_/g, ' ');
}
