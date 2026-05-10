// On-chain check for sale-payment proof.
//
// Calls a Helius RPC endpoint (devnet or mainnet, matching
// NEXT_PUBLIC_SOLANA_NETWORK) and reads the tx's pre/post token balances
// to verify, deterministically:
//   - the tx exists and succeeded
//   - some account owned by the bounty's vendor received USDC
//   - the credited amount equals the bounty's reward
//   - the tx signer is NOT the scout (anti self-pay collusion)
//
// We rely on pre/post token balances rather than instruction parsing —
// it's how Solana surfaces the post-state of every token account touched
// by a tx, including accounts created during the tx, with mint + owner
// already resolved by the validator. Much more robust than walking ixs.
//
// Anti-hallucination: this whole module returns structured booleans. No
// LLM is involved. The verifier consumes these signals and decides.

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? '';
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
const USDC_MINT =
  process.env.NEXT_PUBLIC_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// 30 days. Sales claimed against very old txs are suspicious.
const MAX_TX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
// Hard timeout — verifier latency budget is small.
const RPC_TIMEOUT_MS = 5_000;

export const isOnchainEnabled = !!HELIUS_API_KEY;

function rpcUrl(): string | null {
  if (!HELIUS_API_KEY) return null;
  if (NETWORK === 'mainnet-beta' || NETWORK === 'mainnet') {
    return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  }
  return `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
}

export type OnchainCheckInput = {
  txHash: string;
  // In USDC units (e.g. 50 for $50). We convert to base units for compare.
  expectedRewardAmount: number;
  expectedRewardToken: 'USDC' | 'SOL';
  // Vendor wallet — should own the destination ATA that gets credited.
  expectedRecipient: string;
  // Scout wallet — must NOT be the tx signer.
  scoutAddress: string;
};

type FailReason =
  | 'rpc_unavailable'
  | 'rpc_error'
  | 'rpc_timeout'
  | 'tx_not_found'
  | 'tx_failed'
  | 'self_pay'
  | 'wrong_recipient'
  | 'amount_mismatch'
  | 'token_unsupported';

export type OnchainCheckResult =
  | { ok: false; reason: FailReason; detail?: string }
  | {
      ok: true;
      // Base-units credited (e.g. 50_000_000 for 50 USDC).
      matchedBaseUnits: number;
      uiAmount: number;
      signer: string;
      ageMs: number;
      ageWithinWindow: boolean;
    };

type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number; uiAmount: number | null };
};

type RpcMeta = {
  err: unknown;
  preTokenBalances?: TokenBalance[];
  postTokenBalances?: TokenBalance[];
};

type RpcMessage = {
  accountKeys: Array<{ pubkey: string; signer: boolean; writable?: boolean } | string>;
};

type RpcTransaction = { message: RpcMessage };

type RpcResult = {
  blockTime: number | null;
  meta: RpcMeta | null;
  transaction: RpcTransaction;
} | null;

export async function checkSaleTxOnChain(input: OnchainCheckInput): Promise<OnchainCheckResult> {
  const url = rpcUrl();
  if (!url) return { ok: false, reason: 'rpc_unavailable' };

  // Currently only USDC is verifiable here. Native SOL transfers would
  // need a different parse path (system program ix); skip for v1.
  if (input.expectedRewardToken !== 'USDC') {
    return { ok: false, reason: 'token_unsupported', detail: 'only USDC sales are on-chain-verified' };
  }

  let json: { result?: RpcResult; error?: { message?: string } };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          input.txHash,
          {
            maxSupportedTransactionVersion: 0,
            encoding: 'jsonParsed',
            commitment: 'confirmed',
          },
        ],
      }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { ok: false, reason: 'rpc_error', detail: `http ${res.status}` };
    }
    json = await res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, reason: 'rpc_timeout' };
    }
    return { ok: false, reason: 'rpc_error', detail: e instanceof Error ? e.message : 'unknown' };
  }

  if (json.error) return { ok: false, reason: 'rpc_error', detail: json.error.message };
  const result = json.result ?? null;
  if (!result) return { ok: false, reason: 'tx_not_found' };
  if (result.meta?.err) {
    return { ok: false, reason: 'tx_failed', detail: JSON.stringify(result.meta.err) };
  }

  // Resolve signer. accountKeys is either string[] (legacy) or {pubkey,signer}[]
  // (jsonParsed). With jsonParsed it's the object form.
  const keys = result.transaction?.message?.accountKeys ?? [];
  let signer = '';
  for (const k of keys) {
    if (typeof k === 'string') continue;
    if (k.signer) {
      signer = k.pubkey;
      break;
    }
  }

  if (signer && signer === input.scoutAddress) {
    return { ok: false, reason: 'self_pay', detail: 'tx signed by the scout themselves' };
  }

  // Find the vendor's USDC balance change.
  const pre = result.meta?.preTokenBalances ?? [];
  const post = result.meta?.postTokenBalances ?? [];

  let creditBaseUnits = 0;
  let foundForVendor = false;

  for (const p of post) {
    if (p.mint !== USDC_MINT) continue;
    if (p.owner !== input.expectedRecipient) continue;
    foundForVendor = true;
    const preMatch = pre.find((b) => b.accountIndex === p.accountIndex);
    const preAmt = preMatch ? Number(preMatch.uiTokenAmount.amount) : 0;
    const postAmt = Number(p.uiTokenAmount.amount);
    const delta = postAmt - preAmt;
    if (delta > creditBaseUnits) creditBaseUnits = delta;
  }

  if (!foundForVendor || creditBaseUnits <= 0) {
    return { ok: false, reason: 'wrong_recipient', detail: 'no USDC credit to vendor in this tx' };
  }

  // USDC has 6 decimals.
  const expectedBaseUnits = Math.round(input.expectedRewardAmount * 1_000_000);
  if (creditBaseUnits !== expectedBaseUnits) {
    return {
      ok: false,
      reason: 'amount_mismatch',
      detail: `expected ${expectedBaseUnits}, got ${creditBaseUnits}`,
    };
  }

  const blockTimeMs = result.blockTime ? result.blockTime * 1000 : Date.now();
  const ageMs = Math.max(0, Date.now() - blockTimeMs);

  return {
    ok: true,
    matchedBaseUnits: creditBaseUnits,
    uiAmount: creditBaseUnits / 1_000_000,
    signer,
    ageMs,
    ageWithinWindow: ageMs <= MAX_TX_AGE_MS,
  };
}
