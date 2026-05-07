'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserRole, WalletProvider } from './types';

type Wallet = {
  address: string;
  provider: WalletProvider;
};

type Session = Wallet & { role: UserRole | null };

type Ctx = {
  wallet: Wallet | null;
  role: UserRole | null;
  hydrated: boolean;
  connect: (provider: WalletProvider, manualAddress?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setRole: (role: UserRole | null) => void;
  shortAddress: string;
};

const KEY = 'earn.session.v1';

function shorten(addr: string) {
  return addr.length <= 10 ? addr : `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

type SolanaWindow = {
  solana?: {
    isPhantom?: boolean;
    publicKey?: { toString: () => string };
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
  };
  solflare?: {
    isSolflare?: boolean;
    publicKey?: { toString: () => string };
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  };
};

async function connectProvider(provider: WalletProvider, manualAddress?: string): Promise<Wallet> {
  if (typeof window === 'undefined') throw new Error('Client only');
  const w = window as unknown as SolanaWindow;

  if (provider === 'phantom') {
    if (!w.solana?.isPhantom) throw new Error('Phantom not detected. Install at phantom.app');
    const res = await w.solana.connect();
    return { address: res.publicKey.toString(), provider: 'phantom' };
  }

  if (provider === 'solflare') {
    if (!w.solflare) throw new Error('Solflare not detected. Install at solflare.com');
    await w.solflare.connect();
    const pk = w.solflare.publicKey?.toString();
    if (!pk) throw new Error('Solflare did not return a public key');
    return { address: pk, provider: 'solflare' };
  }

  if (provider === 'embedded') {
    // PRIVY: drop in `usePrivy()` + `useSolanaWallets()` hooks here once
    // NEXT_PUBLIC_PRIVY_APP_ID is set. For now we mint a deterministic
    // local "embedded" wallet so the rest of the flow can be exercised.
    const stored = window.localStorage.getItem('earn.embeddedAddress');
    const address =
      stored ?? `EMB${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
    window.localStorage.setItem('earn.embeddedAddress', address);
    return { address, provider: 'embedded' };
  }

  if (provider === 'manual') {
    const trimmed = (manualAddress ?? '').trim();
    if (trimmed.length < 8) throw new Error('Enter a valid wallet address (min 8 chars).');
    return { address: trimmed, provider: 'manual' };
  }

  // mock — local dev only
  const stored = window.localStorage.getItem('earn.mockAddress');
  const address =
    stored ?? `MOCK${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
  window.localStorage.setItem('earn.mockAddress', address);
  return { address, provider: 'mock' };
}

const WalletCtx = createContext<Ctx | null>(null);

export function WalletProviderRoot({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [role, setLocalRole] = useState<UserRole | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        setWallet({ address: s.address, provider: s.provider });
        setLocalRole(s.role);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Session | null) => {
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
      else window.localStorage.removeItem(KEY);
    } catch {}
  }, []);

  const connect = useCallback(
    async (provider: WalletProvider, manualAddress?: string) => {
      const w = await connectProvider(provider, manualAddress);
      setWallet(w);
      persist({ ...w, role });
    },
    [persist, role],
  );

  const disconnect = useCallback(async () => {
    try {
      const win = window as unknown as SolanaWindow;
      if (wallet?.provider === 'phantom') await win.solana?.disconnect?.();
      if (wallet?.provider === 'solflare') await win.solflare?.disconnect?.();
    } catch {}
    setWallet(null);
    setLocalRole(null);
    persist(null);
  }, [persist, wallet?.provider]);

  const setRole = useCallback(
    (r: UserRole | null) => {
      setLocalRole(r);
      if (wallet) persist({ ...wallet, role: r });
    },
    [persist, wallet],
  );

  const value = useMemo<Ctx>(
    () => ({
      wallet,
      role,
      hydrated,
      connect,
      disconnect,
      setRole,
      shortAddress: wallet ? shorten(wallet.address) : '',
    }),
    [wallet, role, hydrated, connect, disconnect, setRole],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be used within WalletProviderRoot');
  return ctx;
}
