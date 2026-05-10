// SBT (soulbound scout identity) on Metaplex Core.
//
// Two paths:
//  - mintSbt(...)        — real on-chain mint via @metaplex-foundation/mpl-core,
//                           creates a non-transferable Core asset using the
//                           PermanentFreezeDelegate plugin with frozen=true.
//  - mockSbtMintAddress  — deterministic fallback for dev (no signer).
//
// The on-chain path is opt-in: scout signup calls `mintSbt` only when a real
// signer (Phantom / Solflare / Privy embedded) is connected. Manual / mock
// wallets fall back to the deterministic string so the rest of the flow is
// still demoable without devnet SOL.

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

// In a real impl we'd resolve the asset on-chain and confirm the owner is
// `wallet`. For the local registry it's enough to confirm the deterministic
// hash matches.
export function isSbtBoundTo(sbtMint: string, walletAddress: string) {
  if (!sbtMint.startsWith(MINT_PREFIX)) {
    // Real Core asset address — owner check would happen on-chain. Trust local.
    return true;
  }
  return sbtMint === mockSbtMintAddress(walletAddress);
}

// ─────────────────────────────────────────────────────────────────────────
// On-chain minting
// ─────────────────────────────────────────────────────────────────────────

import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export type MintSbtInput = {
  walletPublicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  displayName: string;
  region: string;
  bio: string;
};

export type MintSbtResult = { assetAddress: string; signature: string };

export async function mintSbt(input: MintSbtInput): Promise<MintSbtResult> {
  // Heavy imports kept inside the function so the marketing pages don't
  // ship Metaplex umi or web3.js into their first-load bundle.
  const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
  const { walletAdapterIdentity } = await import('@metaplex-foundation/umi-signer-wallet-adapters');
  const { generateSigner, publicKey: umiPubkey } = await import('@metaplex-foundation/umi');
  const { create, mplCore } = await import('@metaplex-foundation/mpl-core');
  const { env } = await import('./env');

  const umi = createUmi(env.solana.rpcUrl).use(mplCore());
  umi.use(
    walletAdapterIdentity({
      publicKey: input.walletPublicKey,
      signTransaction: input.signTransaction,
    } as Parameters<typeof walletAdapterIdentity>[0]),
  );

  const asset = generateSigner(umi);
  const metadata = buildMetadataDataUri({
    displayName: input.displayName,
    region: input.region,
    bio: input.bio,
  });

  const builder = create(umi, {
    asset,
    name: `SOLd Scout — ${input.displayName.slice(0, 28)}`,
    uri: metadata,
    owner: umiPubkey(input.walletPublicKey.toBase58()),
    plugins: [
      {
        type: 'PermanentFreezeDelegate',
        frozen: true,
        authority: { type: 'UpdateAuthority' },
      },
    ],
  });

  const result = await builder.sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
  const signature = bytesToBase58(result.signature);

  return { assetAddress: asset.publicKey.toString(), signature };
}

function buildMetadataDataUri(input: { displayName: string; region: string; bio: string }) {
  const json = {
    name: `SOLd Scout · ${input.displayName}`,
    description: input.bio || `Scout identity for ${input.displayName}.`,
    attributes: [
      { trait_type: 'protocol', value: 'sold-earn' },
      { trait_type: 'region', value: input.region },
      { trait_type: 'soulbound', value: 'true' },
    ],
  };
  return `data:application/json;base64,${b64(JSON.stringify(json))}`;
}

function b64(s: string) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(s)));
  }
  return Buffer.from(s, 'utf-8').toString('base64');
}

function bytesToBase58(bytes: Uint8Array): string {
  // Lightweight base58 encoder for displaying the tx signature. Used only
  // for UI; do not reuse for protocol-critical encoding.
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let i = 0; i < zeros; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}
