'use client';

import { useMemo } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useSignTransaction as usePrivySignTransaction, useWallets as usePrivySolanaWallets } from '@privy-io/react-auth/solana';
import { env } from './env';
import { isEscrowDeployed } from './chain-config';
import type { WalletProvider } from './types';

export { isEscrowDeployed };

// One Connection per RPC URL at module scope so RPC keep-alives are reused.
const connections = new Map<string, Connection>();

export function getConnection() {
  const url = env.solana.rpcUrl;
  let c = connections.get(url);
  if (!c) {
    c = new Connection(url, { commitment: 'confirmed' });
    connections.set(url, c);
  }
  return c;
}

export const USDC_MINT = (() => {
  try {
    return new PublicKey(env.solana.usdcMint);
  } catch {
    return null;
  }
})();

export const ESCROW_PROGRAM_ID = (() => {
  try {
    return env.escrow.programId ? new PublicKey(env.escrow.programId) : null;
  } catch {
    return null;
  }
})();

export function privyChainTag(): 'solana:mainnet' | 'solana:devnet' | 'solana:testnet' {
  if (env.solana.network === 'mainnet-beta') return 'solana:mainnet';
  if (env.solana.network === 'testnet') return 'solana:testnet';
  return 'solana:devnet';
}

// ─────────────────────────────────────────────────────────────────────────
// Signer abstraction. Phantom/Solflare expose `signTransaction(tx)` directly;
// Privy embedded signs serialised bytes via a hook. Manual / mock wallets
// cannot sign and `useSigner` returns null for them.
// ─────────────────────────────────────────────────────────────────────────

export type SignableTx = Transaction | VersionedTransaction;
export type SignFn = <T extends SignableTx>(tx: T) => Promise<T>;

type InjectedSolana = {
  isPhantom?: boolean;
  signTransaction?: SignFn;
};

export function useSigner(provider: WalletProvider | null | undefined): SignFn | null {
  const privySign = usePrivySignerSafe();

  return useMemo<SignFn | null>(() => {
    if (!provider) return null;

    if (provider === 'phantom') {
      return (tx) => {
        if (typeof window === 'undefined') throw new Error('Client only');
        const w = (window as unknown as { solana?: InjectedSolana }).solana;
        if (!w?.signTransaction) throw new Error('Phantom wallet not available.');
        return w.signTransaction(tx);
      };
    }

    if (provider === 'solflare') {
      return (tx) => {
        if (typeof window === 'undefined') throw new Error('Client only');
        const w = (window as unknown as { solflare?: InjectedSolana }).solflare;
        if (!w?.signTransaction) throw new Error('Solflare wallet not available.');
        return w.signTransaction(tx);
      };
    }

    if (provider === 'embedded') {
      if (!privySign) throw new Error('Privy is not configured for signing.');
      return privySign;
    }

    return null;
  }, [provider, privySign]);
}

// Privy hooks throw outside PrivyProvider, so guard on env.privy.enabled.
// The condition is constant per build — hook order is preserved.
function usePrivySignerSafe(): SignFn | null {
  if (!env.privy.enabled) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { signTransaction } = usePrivySignTransaction();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { wallets } = usePrivySolanaWallets();

  return useMemo<SignFn | null>(() => {
    const wallet = wallets[0];
    if (!wallet) return null;
    return (async <T extends SignableTx>(tx: T): Promise<T> => {
      const bytes =
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : (tx as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false });

      const result = await signTransaction({
        transaction: bytes,
        wallet,
        chain: privyChainTag(),
      });

      if (tx instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(result.signedTransaction) as T;
      }
      return Transaction.from(result.signedTransaction) as T;
    }) as SignFn;
  }, [signTransaction, wallets]);
}
