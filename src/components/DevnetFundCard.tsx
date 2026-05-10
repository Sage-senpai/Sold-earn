'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { env } from '@/lib/env';

// Visible only on devnet/testnet/localnet — disappears on mainnet so demo-only
// helpers don't leak into production. Lets a connected wallet airdrop SOL for
// gas and points the user to the SPL faucet for devnet USDC.
export default function DevnetFundCard({ compact = false }: { compact?: boolean }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (env.solana.network === 'mainnet-beta') return null;
  if (!wallet) return null;

  const airdropSol = async () => {
    setBusy(true);
    try {
      const { getConnection } = await import('@/lib/solana');
      const { PublicKey } = await import('@solana/web3.js');
      const conn = getConnection();
      const pk = new PublicKey(wallet.address);
      const sig = await conn.requestAirdrop(pk, 1_000_000_000); // 1 SOL
      await conn.confirmTransaction(sig, 'confirmed');
      toast(`Airdropped 1 SOL · ${sig.slice(0, 8)}…`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Airdrop failed';
      toast(
        msg.includes('rate') || msg.includes('limit')
          ? 'Devnet airdrop is rate-limited. Try https://faucet.solana.com'
          : msg,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`ink-card p-4 ${compact ? '' : 'md:p-5'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600">Devnet helper</p>
          <p className="font-eldritch text-base sm:text-lg font-bold mt-0.5">Fund your test wallet</p>
        </div>
        <span
          className="border border-earn-gray-900 bg-earn-amber/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
          aria-label="Devnet only"
        >
          Devnet only
        </span>
      </div>
      <p className="text-xs sm:text-sm text-earn-gray-700 mt-2">
        You need a little SOL for transaction fees and devnet USDC to fund bounty escrow.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button className="btn-secondary text-xs" disabled={busy} onClick={airdropSol}>
          {busy ? 'Airdropping…' : 'Airdrop 1 SOL'}
        </button>
        <a
          href="https://spl-token-faucet.com/?token-name=USDC-Dev"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-xs"
        >
          Get devnet USDC →
        </a>
      </div>
      <p className="font-mono text-[10px] uppercase text-earn-gray-500 mt-3 break-all">
        Wallet · {wallet.address}
      </p>
    </div>
  );
}
