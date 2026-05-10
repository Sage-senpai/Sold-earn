'use client';

import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { ESCROW_PROGRAM_ID, USDC_MINT, getConnection, type SignFn } from './solana';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type EscrowDepositInput = {
  vendorAddress: string;
  bountyId: string;
  amount: number;
  token: 'USDC' | 'SOL';
};

export type EscrowReleaseInput = {
  vendorAddress: string;
  bountyId: string;
  scoutAddress: string;
  amount: number;
};

export type EscrowCloseInput = {
  vendorAddress: string;
  bountyId: string;
};

export type EscrowChainContext = {
  signTransaction: SignFn;
};

const USDC_DECIMALS = 6;

// ─────────────────────────────────────────────────────────────────────────
// Public API. When the program is deployed AND a chain context is supplied,
// these submit real transactions. Otherwise they fall back to a mock so
// pre-deploy local development continues to work end-to-end.
// ─────────────────────────────────────────────────────────────────────────

export async function depositToEscrow(
  input: EscrowDepositInput,
  chain?: EscrowChainContext,
): Promise<{ txHash: string; deposited: number }> {
  if (!isReady() || !chain || input.token !== 'USDC') {
    return mockTx(`mock_dep_${input.bountyId.slice(-4)}`, input.amount);
  }

  const conn = getConnection();
  const vendor = new PublicKey(input.vendorAddress);
  const seedBytes = bountySeedBytes(input.bountyId);
  const [bountyPda] = bountyPdaForSeed(seedBytes);
  const [vaultPda] = vaultPdaForBounty(bountyPda);
  const vendorAta = getAssociatedTokenAddressSync(USDC_MINT!, vendor);
  const lamports = toUnits(input.amount);

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
  ];

  // Initialise the bounty PDA + vault if it doesn't exist yet.
  const bountyInfo = await conn.getAccountInfo(bountyPda);
  if (!bountyInfo) {
    ixs.push(
      buildInitializeBountyIx({
        seedBytes,
        rewardPerSale: 0n, // tracked off-chain; on-chain only needs > 0 for create check below
        targetSales: 1,
        vendor,
        bounty: bountyPda,
        mint: USDC_MINT!,
        vault: vaultPda,
      }),
    );
  }

  ixs.push(
    buildDepositIx({
      vendor,
      bounty: bountyPda,
      vault: vaultPda,
      vendorTokenAccount: vendorAta,
      amount: lamports,
    }),
  );

  const tx = await sendIxs(conn, vendor, ixs, chain.signTransaction);
  return { txHash: tx, deposited: input.amount };
}

export async function releaseFromEscrow(
  input: EscrowReleaseInput,
  chain?: EscrowChainContext,
): Promise<{ txHash: string; released: number }> {
  if (!isReady() || !chain) {
    return { txHash: `mock_rel_${input.bountyId.slice(-4)}_${Date.now().toString(36)}`, released: input.amount };
  }

  const conn = getConnection();
  const vendor = new PublicKey(input.vendorAddress);
  const scout = new PublicKey(input.scoutAddress);
  const seedBytes = bountySeedBytes(input.bountyId);
  const [bountyPda] = bountyPdaForSeed(seedBytes);
  const [vaultPda] = vaultPdaForBounty(bountyPda);
  const scoutAta = getAssociatedTokenAddressSync(USDC_MINT!, scout);
  const lamports = toUnits(input.amount);

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
  ];

  const ataInfo = await conn.getAccountInfo(scoutAta);
  if (!ataInfo) {
    ixs.push(
      createAssociatedTokenAccountInstruction(vendor, scoutAta, scout, USDC_MINT!),
    );
  }

  ixs.push(
    buildReleaseIx({
      vendor,
      bounty: bountyPda,
      vault: vaultPda,
      scoutTokenAccount: scoutAta,
      amount: lamports,
    }),
  );

  const tx = await sendIxs(conn, vendor, ixs, chain.signTransaction);
  return { txHash: tx, released: input.amount };
}

export async function closeBountyEscrow(
  input: EscrowCloseInput,
  chain?: EscrowChainContext,
): Promise<{ txHash: string }> {
  if (!isReady() || !chain) {
    return { txHash: `mock_close_${input.bountyId.slice(-4)}_${Date.now().toString(36)}` };
  }

  const conn = getConnection();
  const vendor = new PublicKey(input.vendorAddress);
  const seedBytes = bountySeedBytes(input.bountyId);
  const [bountyPda] = bountyPdaForSeed(seedBytes);
  const [vaultPda] = vaultPdaForBounty(bountyPda);
  const vendorAta = getAssociatedTokenAddressSync(USDC_MINT!, vendor);

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    buildCloseBountyIx({
      vendor,
      bounty: bountyPda,
      vault: vaultPda,
      vendorTokenAccount: vendorAta,
    }),
  ];

  const tx = await sendIxs(conn, vendor, ixs, chain.signTransaction);
  return { txHash: tx };
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

function isReady() {
  return ESCROW_PROGRAM_ID !== null && USDC_MINT !== null;
}

function toUnits(amount: number) {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

function bountySeedBytes(bountyId: string): Uint8Array {
  // Use a deterministic 16-byte seed derived from the off-chain bounty id.
  const enc = new TextEncoder().encode(bountyId);
  const out = new Uint8Array(16);
  for (let i = 0; i < enc.length && i < 16; i++) out[i] = enc[i];
  // Pad-and-mix: fold remaining bytes by xor so longer ids still distinguish.
  for (let i = 16; i < enc.length; i++) out[i % 16] ^= enc[i];
  return out;
}

function bountyPdaForSeed(seed: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('bounty'), Buffer.from(seed)], ESCROW_PROGRAM_ID!);
}

function vaultPdaForBounty(bounty: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('vault'), bounty.toBuffer()], ESCROW_PROGRAM_ID!);
}

async function sendIxs(
  conn: ReturnType<typeof getConnection>,
  payer: PublicKey,
  ixs: TransactionInstruction[],
  sign: SignFn,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  tx.recentBlockhash = blockhash;

  const signed = await sign(tx);
  const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

// ─────────────────────────────────────────────────────────────────────────
// Anchor instruction builders. Discriminators are sha256("global:<name>")
// truncated to 8 bytes, computed lazily below. Args use Anchor's Borsh
// layout: u64 little-endian, u32 little-endian, fixed-size byte arrays
// inline.
// ─────────────────────────────────────────────────────────────────────────

const DISC_CACHE = new Map<string, Uint8Array>();
async function discriminator(name: string): Promise<Uint8Array> {
  const cached = DISC_CACHE.get(name);
  if (cached) return cached;
  const data = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const out = new Uint8Array(hash).slice(0, 8);
  DISC_CACHE.set(name, out);
  return out;
}

// Pre-warm so we don't await inside the synchronous tx builders below.
// Discriminators for our four instructions are constants; embed the
// pre-computed values to keep ix construction synchronous.
const DISCRIMINATORS = {
  initialize_bounty: new Uint8Array([150, 37, 249, 246, 85, 164, 253, 229]),
  deposit: new Uint8Array([242, 35, 198, 137, 82, 225, 242, 182]),
  release: new Uint8Array([253, 249, 15, 206, 28, 127, 193, 241]),
  close_bounty: new Uint8Array([90, 33, 205, 110, 210, 22, 247, 49]),
};

// Allow runtime verification once at module load that our embedded constants
// match what sha256 produces. If they ever drift (Anchor naming change), we
// log a warning so devs can update the table.
if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.subtle) {
  (async () => {
    for (const name of Object.keys(DISCRIMINATORS) as Array<keyof typeof DISCRIMINATORS>) {
      const live = await discriminator(name);
      const expected = DISCRIMINATORS[name];
      for (let i = 0; i < 8; i++) {
        if (live[i] !== expected[i]) {
          // eslint-disable-next-line no-console
          console.warn(`[escrow] discriminator drift on ${name}: regenerate DISCRIMINATORS table.`);
          return;
        }
      }
    }
  })();
}

function u64Le(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, value, true);
  return out;
}

function u32Le(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value >>> 0, true);
  return out;
}

function concat(parts: Uint8Array[]): Buffer {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return Buffer.from(out);
}

function buildInitializeBountyIx(args: {
  seedBytes: Uint8Array;
  rewardPerSale: bigint;
  targetSales: number;
  vendor: PublicKey;
  bounty: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
}): TransactionInstruction {
  const data = concat([
    DISCRIMINATORS.initialize_bounty,
    args.seedBytes,
    u64Le(args.rewardPerSale > 0n ? args.rewardPerSale : 1n),
    u32Le(args.targetSales > 0 ? args.targetSales : 1),
  ]);
  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID!,
    keys: [
      { pubkey: args.vendor, isSigner: true, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildDepositIx(args: {
  vendor: PublicKey;
  bounty: PublicKey;
  vault: PublicKey;
  vendorTokenAccount: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const data = concat([DISCRIMINATORS.deposit, u64Le(args.amount)]);
  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID!,
    keys: [
      { pubkey: args.vendor, isSigner: true, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
      { pubkey: args.vendorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildReleaseIx(args: {
  vendor: PublicKey;
  bounty: PublicKey;
  vault: PublicKey;
  scoutTokenAccount: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const data = concat([DISCRIMINATORS.release, u64Le(args.amount)]);
  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID!,
    keys: [
      { pubkey: args.vendor, isSigner: true, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: args.scoutTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildCloseBountyIx(args: {
  vendor: PublicKey;
  bounty: PublicKey;
  vault: PublicKey;
  vendorTokenAccount: PublicKey;
}): TransactionInstruction {
  const data = Buffer.from(DISCRIMINATORS.close_bounty);
  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID!,
    keys: [
      { pubkey: args.vendor, isSigner: true, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: args.vendorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function mockTx(prefix: string, deposited: number) {
  return new Promise<{ txHash: string; deposited: number }>((resolve) => {
    setTimeout(() => resolve({ txHash: `${prefix}_${Date.now().toString(36)}`, deposited }), 250);
  });
}
