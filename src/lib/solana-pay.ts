'use client';

import { Keypair, PublicKey } from '@solana/web3.js';
import { env } from './env';

// Solana Pay attribution.
//
// Each Sales ID maps to a deterministic reference Pubkey. Any USDC transfer
// that includes that reference in its accounts is attributable to the Sales
// ID — no on-chain memo, no shared state, just a 32-byte tag the indexer
// can search for via getSignaturesForAddress(reference).
//
// We derive the reference deterministically from the Sales ID so two
// different devices viewing the same /sale/[salesId] generate identical
// references and identical QR codes.

function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function fnv1a64Bytes(input: Uint8Array): Uint8Array {
  // Stable, dependency-free 32-byte expansion: we hash with a simple
  // polynomial then expand into 32 bytes by mixing the running hash. This
  // is not cryptographic — it's only a name → curve-point mapping. The
  // resulting pubkey is treated as opaque attribution metadata.
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29ce4n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < input.length; i++) {
    h1 = ((h1 ^ BigInt(input[i])) * prime) & mask;
    h2 = ((h2 ^ BigInt(input[input.length - 1 - i])) * prime) & mask;
  }
  const out = new Uint8Array(32);
  for (let round = 0; round < 4; round++) {
    const v1 = h1;
    const v2 = h2;
    const off = round * 8;
    out[off + 0] = Number((v1 >> 0n) & 0xffn);
    out[off + 1] = Number((v1 >> 8n) & 0xffn);
    out[off + 2] = Number((v1 >> 16n) & 0xffn);
    out[off + 3] = Number((v1 >> 24n) & 0xffn);
    out[off + 4] = Number((v1 >> 32n) & 0xffn);
    out[off + 5] = Number((v1 >> 40n) & 0xffn);
    out[off + 6] = Number((v1 >> 48n) & 0xffn);
    out[off + 7] = Number((v1 >> 56n) & 0xffn);
    h1 = ((h1 ^ h2) * prime) & mask;
    h2 = ((h2 + h1) * prime) & mask;
  }
  return out;
}

export function referenceFor(salesId: string): PublicKey {
  // Try until we land on a value PublicKey accepts. Pubkeys are 32-byte
  // values; Keypair.fromSeed wants 32 bytes too. We use the seed path so
  // the resulting public key is on the ed25519 curve and accepted by any
  // Solana wallet that validates accounts.
  let counter = 0;
  while (counter < 32) {
    const seed = fnv1a64Bytes(utf8ToBytes(`${salesId}#${counter}`));
    try {
      return Keypair.fromSeed(seed).publicKey;
    } catch {
      counter += 1;
    }
  }
  // Fallback (statistically unreachable): use raw bytes as off-curve pubkey.
  return new PublicKey(fnv1a64Bytes(utf8ToBytes(salesId)));
}

export type SolanaPayParams = {
  salesId: string;
  recipient: string; // vendor wallet — payment lands here, scout gets credited via reference
  amount: number; // human-readable USDC amount (e.g. 50 = 50 USDC)
  label?: string;
  message?: string;
};

export function buildSolanaPayUrl({
  salesId,
  recipient,
  amount,
  label,
  message,
}: SolanaPayParams): string {
  const reference = referenceFor(salesId).toBase58();
  const params = new URLSearchParams();
  if (Number.isFinite(amount) && amount > 0) params.set('amount', amount.toString());
  if (env.solana.usdcMint) params.set('spl-token', env.solana.usdcMint);
  params.set('reference', reference);
  if (label) params.set('label', label);
  if (message) params.set('message', message);
  params.set('memo', `SOLd:${salesId}`);
  return `solana:${recipient}?${params.toString()}`;
}
