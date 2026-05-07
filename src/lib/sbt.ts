// Stub SBT module. Real version mints a Metaplex non-transferable NFT
// keyed to the scout's wallet, embedding profile metadata. The mint address
// is the scout's identity across the system.

const MINT_PREFIX = 'SBT_';

export function mockSbtMintAddress(walletAddress: string) {
  let hash = 0;
  for (let i = 0; i < walletAddress.length; i++) {
    hash = (hash * 31 + walletAddress.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash).toString(36).padStart(6, '0');
  const tail = walletAddress.slice(-4).toUpperCase();
  return `${MINT_PREFIX}${seed}${tail}`;
}

// In a real impl: assert SBT exists on-chain and the owner is `wallet`.
// Here we just check our local registry via the store layer.
export function isSbtBoundTo(sbtMint: string, walletAddress: string) {
  return sbtMint === mockSbtMintAddress(walletAddress);
}
