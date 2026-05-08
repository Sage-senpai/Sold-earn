'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import type { WalletProvider } from '@/lib/types';

export default function WalletButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { wallet, hydrated, connect, disconnect, shortAddress, role } = useWallet();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, left: r.right, width: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(t) &&
        popoverRef.current &&
        !popoverRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
        <span className="hidden md:inline-flex border border-earn-gray-900 bg-white/70 px-3 py-2 font-mono text-[10px] uppercase">
          {role ? `${role} · ${shortAddress}` : shortAddress}
        </span>
        <span className="md:hidden border border-earn-gray-900 bg-white/70 px-2.5 py-2 font-mono text-[10px] uppercase">
          {shortAddress}
        </span>
        <button
          className="btn-secondary px-3 py-2 text-[10px]"
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

  const popover =
    open && coords && mounted
      ? createPortal(
          <>
            {/* Mobile sheet (full-screen overlay) */}
            <div
              ref={popoverRef}
              className="sm:hidden fixed inset-0 z-[140] flex items-end"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div className="relative z-10 w-full bg-white border-t border-earn-gray-900 shadow-[0_-10px_30px_rgba(0,0,0,0.25)] p-4 max-h-[85vh] overflow-y-auto rounded-t-[6px]">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] uppercase text-earn-gray-600">Select Provider</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="font-mono text-[10px] uppercase border border-earn-gray-900 bg-white px-3 py-1.5"
                  >
                    Close
                  </button>
                </div>
                <ProviderList busy={busy} manual={manual} setManual={setManual} tryConnect={tryConnect} />
              </div>
            </div>

            {/* Desktop popover (anchored to button) */}
            <div
              ref={popoverRef}
              className="hidden sm:block fixed z-[140] w-80 max-w-[calc(100vw-24px)] border border-earn-gray-900 bg-white p-3 shadow-[8px_10px_0_rgba(0,0,0,0.9)]"
              style={{
                top: coords.top,
                left: Math.max(12, coords.left - 320),
              }}
              role="dialog"
            >
              <p className="font-mono text-[10px] uppercase text-earn-gray-600 mb-2">Select Provider</p>
              <ProviderList busy={busy} manual={manual} setManual={setManual} tryConnect={tryConnect} />
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        className={cls}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Connect Wallet
      </button>
      {popover}
    </>
  );
}

function ProviderList({
  busy,
  manual,
  setManual,
  tryConnect,
}: {
  busy: boolean;
  manual: string;
  setManual: (v: string) => void;
  tryConnect: (provider: WalletProvider, manualAddress?: string) => void;
}) {
  return (
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
  );
}
