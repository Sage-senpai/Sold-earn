// Stub escrow. The real implementation is an Anchor program that:
//   - Locks `amount` of `token` from the vendor's wallet at bounty creation.
//   - Releases reward to the SBT-bound scout wallet on verified sale.
//   - Refunds the remainder to the vendor on bounty completion / cancel.
//
// Locally we just record deposits/releases against in-memory state via store.ts.

export type EscrowDepositInput = {
  vendorAddress: string;
  bountyId: string;
  amount: number;
  token: 'USDC' | 'SOL';
};

export type EscrowReleaseInput = {
  bountyId: string;
  scoutAddress: string;
  amount: number;
};

export async function depositToEscrow(input: EscrowDepositInput) {
  await new Promise((r) => setTimeout(r, 250));
  return {
    txHash: `mock_dep_${input.bountyId.slice(-4)}_${Date.now().toString(36)}`,
    deposited: input.amount,
  };
}

export async function releaseFromEscrow(input: EscrowReleaseInput) {
  await new Promise((r) => setTimeout(r, 200));
  return {
    txHash: `mock_rel_${input.bountyId.slice(-4)}_${Date.now().toString(36)}`,
    released: input.amount,
  };
}
