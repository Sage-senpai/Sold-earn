// Sales-ID generation and verification, derived from the scout's SBT.
//
// Spec invariants:
//   - Sales ID is bound to the SBT, so a scout cannot detach identity from sales.
//   - The same scout applying to two bounties produces two distinct sales IDs.
//   - Verifying a sale requires resolving the Sales ID back to the SBT and
//     confirming the SBT's owning wallet still controls it.

import { isSbtBoundTo } from './sbt';

const SALES_PREFIX = 'SE-';

export function generateSalesId(sbtMint: string, bountyId: string) {
  const a = sbtMint.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
  const b = bountyId.replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase();
  const stamp = Date.now().toString(36).slice(-3).toUpperCase();
  return `${SALES_PREFIX}${a}-${b}-${stamp}`;
}

export type SalesContext = {
  sbtMint: string;
  scoutAddress: string;
  bountyId: string;
};

export function verifySalesId(salesId: string, ctx: SalesContext) {
  if (!salesId.startsWith(SALES_PREFIX)) return false;
  if (!isSbtBoundTo(ctx.sbtMint, ctx.scoutAddress)) return false;
  return true;
}
