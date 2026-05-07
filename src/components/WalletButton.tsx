'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import type { WalletProvider } from '@/lib/types';

export default function WalletButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { wallet, hydrated, connect, disconnect, shortAddress, role } = useWallet();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');

  const cls = size === 'sm' ? 'btn-primary px-4 py-2 text-xs' : 'btn-primary';

  if (!hydrated) {
    return (
      <button className={cls} disabled>
        Loading…
      </button>
    );
  }

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <span className="border border-earn-gray-900 bg-white/70 px-3 py-2 font-mono text-xs uppercase">
          {role ? `${role} · ${shortAddress}` : shortAddress}
        </span>
        <button
          className="btn-secondary px-4 py-2 text-xs"
          onClick={async () => {
            await disconnect();
            toast('Wallet disconnected', 'info');
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  const tryConnect = async (provider: WalletProvider, manualAddress?: string) => {
    setBusy(true);
    try {
      await connect(provider, manualAddress);
      toast(`Connected via ${provider}`, 'success');
      setOpen(false);
      setManual('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Connection failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button className={cls} onClick={() => setOpen((v) => !v)}>
        Connect Wallet
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 border border-earn-gray-900 bg-white p-3 shadow-[8px_10px_0_rgba(0,0,0,0.9)]">
          <p className="font-mono text-[10px] uppercase text-earn-gray-600 mb-2">Select Provider</p>
          <div className="space-y-2">
            <button className="btn-primary w-full text-xs" disabled={busy} onClick={() => tryConnect('phantom')}>
              Phantom
            </button>
            <button className="btn-secondary w-full text-xs" disabled={busy} onClick={() => tryConnect('solflare')}>
              Solflare
            </button>
            <button className="btn-accent w-full text-xs" disabled={busy} onClick={() => tryConnect('embedded')}>
              Embedded Wallet (email / social)
            </button>
            <div className="border border-earn-gray-300 p-2">
              <label className="field-label">Or paste an address</label>
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                className="field-input text-xs"
                placeholder="9xQe…"
              />
              <button
                className="btn-secondary w-full text-xs mt-2"
                disabled={busy || !manual}
                onClick={() => tryConnect('manual', manual)}
              >
                Use Manual Address
              </button>
              <p className="font-mono text-[9px] uppercase text-earn-gray-500 mt-1">
                Disclaimer: manual addresses cannot sign — payouts only.
              </p>
            </div>
            <button className="btn-secondary w-full text-xs" disabled={busy} onClick={() => tryConnect('mock')}>
              Dev Mock Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
