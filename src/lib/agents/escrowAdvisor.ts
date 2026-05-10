// Escrow Advisor.
//
// Calculates whether a bounty's escrow is healthy enough to cover its
// pending obligations. Deterministic — no LLM. The advisor is purely a
// surface that recommends an action; the vendor still signs the top-up.
//
// Definitions:
//   pendingObligation = (# pending sales) × rewardPerSale
//                       Sales waiting for vendor verify; if all approved
//                       today, this is what would leave escrow.
//   committedRunway   = (# verified sales already paid out) × rewardPerSale
//                       (informational; already deducted from escrow_deposited
//                        once on-chain, but tracked separately for clarity)
//   freeBalance       = escrowDeposited − pendingObligation
//                       What's left if every pending sale verifies.
//   minHealthy        = 2 × rewardPerSale  (cushion: at least two more sales)
//
// Severity ladder:
//   ok:       freeBalance ≥ minHealthy AND escrow can cover full target
//   low:      freeBalance < minHealthy but ≥ 0
//   critical: freeBalance < 0  (over-committed; verify-all-pending would
//             fail to release)

export type EscrowAdviceSeverity = 'ok' | 'low' | 'critical';

export type EscrowAdvice = {
  severity: EscrowAdviceSeverity;
  rewardPerSale: number;
  pendingCount: number;
  pendingObligation: number;
  freeBalance: number;
  // 0 if no top-up needed. Suggested deposit to bring escrow back to a
  // full target × reward, capped at a reasonable per-action ceiling.
  suggestedTopUp: number;
  // Sale-equivalent runway after top-up.
  runwayAfterTopUpSales: number;
  reason: string;
};

export type EscrowSnapshot = {
  rewardPerSale: number;
  targetSales: number;
  escrowDeposited: number;
  pendingSalesCount: number;
};

export function adviseEscrow(s: EscrowSnapshot): EscrowAdvice {
  const reward = Math.max(0, Number(s.rewardPerSale) || 0);
  const balance = Math.max(0, Number(s.escrowDeposited) || 0);
  const pendingObligation = s.pendingSalesCount * reward;
  const freeBalance = balance - pendingObligation;
  const minHealthy = 2 * reward;

  // Always size up to the original target × reward; the vendor can
  // edit the number before signing.
  const targetEscrow = s.targetSales * reward;
  const rawSuggested = Math.max(0, targetEscrow - balance);
  const suggestedTopUp = roundUpToReward(rawSuggested, reward);

  let severity: EscrowAdviceSeverity;
  let reason: string;

  if (freeBalance < 0) {
    severity = 'critical';
    const shortfall = -freeBalance;
    reason = `Over-committed by ${fmt(shortfall)}. Verifying all pending sales would fail.`;
  } else if (freeBalance < minHealthy) {
    severity = 'low';
    reason =
      `Only ${fmt(freeBalance)} free after pending sales — ` +
      `under the 2-sale (${fmt(minHealthy)}) cushion.`;
  } else {
    severity = 'ok';
    const salesLeft = reward > 0 ? Math.floor(freeBalance / reward) : 0;
    reason = `Healthy. Covers ${salesLeft} more sale${salesLeft === 1 ? '' : 's'}.`;
  }

  const runwayAfterTopUpSales =
    reward > 0 ? Math.floor((freeBalance + suggestedTopUp) / reward) : 0;

  return {
    severity,
    rewardPerSale: reward,
    pendingCount: s.pendingSalesCount,
    pendingObligation,
    freeBalance,
    suggestedTopUp,
    runwayAfterTopUpSales,
    reason,
  };
}

function roundUpToReward(amount: number, reward: number): number {
  if (reward <= 0 || amount <= 0) return Math.max(0, Math.round(amount));
  return Math.ceil(amount / reward) * reward;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
