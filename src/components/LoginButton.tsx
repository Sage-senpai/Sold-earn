'use client';

// "Log In" button for returning users. Same wallet-connection flow as
// WalletButton, but after the wallet settles we look up an existing vendor/
// scout profile and route the user straight to their dashboard. If the wallet
// has no profile, we surface a friendly "no account yet" hint instead of
// stranding the user on the landing page.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/lib/toast';
import { useStore } from '@/lib/store';
import type { WalletProvider } from '@/lib/types';

export default function LoginButton({ variant = 'nav' }: { variant?: 'nav' | 'inline' }) {
  const router = useRouter();
  const { wallet, hydrated, connect, setRole } = useWallet();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Read profile maps reactively so we can route the instant the wallet
  // hydrates after connect (vs. polling).
  const vendor = useStore((s) => (pendingAddress ? s.vendors[pendingAddress] : undefined));
  const scout = useStore((s) => (pendingAddress ? s.scouts[pendingAddress] : undefined));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Position the popover (centered on button, flip above if no room below).
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const popW = 320;
      const popH = popoverRef.current?.offsetHeight ?? 360;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = r.left + r.width / 2 - popW / 2;
      left = Math.max(12, Math.min(left, vw - popW - 12));
      const spaceBelow = vh - r.bottom;
      const top =
        spaceBelow >= popH + 16 || spaceBelow >= r.top
          ? Math.min(r.bottom + 8, vh - popH - 12)
          : Math.max(12, r.top - popH - 8);
      setCoords({ top, left });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Dismiss on outside click + Escape.
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

  // Once the wallet settles to the address we just connected, look up the
  // profile and route — or tell the user they don't have an account yet.
  useEffect(() => {
    if (!pendingAddress || !wallet || wallet.address !== pendingAddress) return;
    if (vendor) {
      setRole('vendor');
      toast(`Welcome back · vendor ${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`, 'success');
      router.push('/vendor/dashboard');
    } else if (scout) {
      setRole('scout');
      toast(`Welcome back · scout ${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`, 'success');
      router.push('/scout/dashboard');
    } else {
      toast(
        `No account found for ${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}. Sign up as Vendor or Scout to continue.`,
        'info',
      );
    }
    setPendingAddress(null);
  }, [pendingAddress, wallet, vendor, scout, setRole, router, toast]);

  const tryLogin = async (provider: WalletProvider, manualAddress?: string) => {
    setBusy(true);
    try {
      await connect(provider, manualAddress);
      // Capture the address that just connected via the wallet context.
      // The effect above will fire as soon as `wallet` updates.
      const next = manualAddress ?? (wallet?.address ?? '');
      // If connect resolved before React committed the new wallet, fall back
      // to a microtask to let useWallet flush.
      queueMicrotask(() => {
        setPendingAddress((cur) => cur ?? next);
      });
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Hide the button entirely once a wallet is connected. Returning users
  // can use the existing nav links to jump to their dashboard.
  if (!hydrated || wallet) return null;

  const buttonClass =
    variant === 'inline'
      ? 'btn-secondary text-xs'
      : 'btn-secondary hidden md:inline-flex text-[11px] px-3 py-2';

  const popover =
    open && coords && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[140] w-80 max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto border border-earn-gray-900 bg-white p-3 shadow-[8px_10px_0_rgba(0,0,0,0.9)]"
            style={{ top: coords.top, left: coords.left }}
            role="dialog"
            aria-label="Log in with wallet"
          >
            <p className="font-mono text-[10px] uppercase text-earn-gray-600 mb-2">
              Log in with wallet
            </p>
            <p className="text-[11px] text-earn-gray-600 mb-3">
              Connect the same wallet you signed up with. We&apos;ll take you straight to your dashboard.
            </p>
            <div className="space-y-2">
              <button
                className="btn-primary w-full text-xs"
                disabled={busy}
                onClick={() => tryLogin('phantom')}
              >
                Phantom
              </button>
              <button
                className="btn-secondary w-full text-xs"
                disabled={busy}
                onClick={() => tryLogin('solflare')}
              >
                Solflare
              </button>
              <button
                className="btn-accent w-full text-xs"
                disabled={busy}
                onClick={() => tryLogin('embedded')}
              >
                Embedded (email / social)
              </button>
            </div>
            <p className="font-mono text-[9px] uppercase text-earn-gray-500 mt-3 leading-relaxed">
              No account yet?{' '}
              <a href="/vendor/signup" className="underline">
                Become a Vendor
              </a>{' '}
              ·{' '}
              <a href="/scout/signup" className="underline">
                Become a Scout
              </a>
            </p>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Log In
      </button>
      {popover}
    </>
  );
}
