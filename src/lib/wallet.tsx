'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as usePrivySolanaWallets } from '@privy-io/react-auth/solana';
import { env } from './env';
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

async function connectInjectedProvider(
  provider: WalletProvider,
  manualAddress?: string,
): Promise<Wallet> {
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

type EmbeddedBridge = {
  ready: boolean;
  authenticated: boolean;
  liveAddress: string | undefined;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const NoopBridge: EmbeddedBridge = {
  ready: true,
  authenticated: false,
  liveAddress: undefined,
  login: async () => {
    throw new Error('Privy is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID to enable embedded wallets.');
  },
  logout: async () => {},
};

function usePrivyEmbeddedBridge(): EmbeddedBridge {
  const p = usePrivy();
  const { wallets } = usePrivySolanaWallets();
  return {
    ready: p.ready,
    authenticated: p.authenticated,
    liveAddress: wallets[0]?.address,
    login: () => Promise.resolve(p.login()),
    logout: () => Promise.resolve(p.logout()),
  };
}

export function WalletProviderRoot({ children }: { children: ReactNode }) {
  if (env.privy.enabled) {
    return <WalletProviderInner useBridge={usePrivyEmbeddedBridge}>{children}</WalletProviderInner>;
  }
  return (
    <WalletProviderInner useBridge={() => NoopBridge}>{children}</WalletProviderInner>
  );
}

function WalletProviderInner({
  children,
  useBridge,
}: {
  children: ReactNode;
  useBridge: () => EmbeddedBridge;
}) {
  const bridge = useBridge();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [role, setLocalRole] = useState<UserRole | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const liveAddressRef = useRef(bridge.liveAddress);
  liveAddressRef.current = bridge.liveAddress;
  const authedRef = useRef(bridge.authenticated);
  authedRef.current = bridge.authenticated;

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

  // Reactive sync for the embedded wallet: keep our session aligned with
  // Privy's current Solana wallet (handles cross-tab logins, refreshes, etc).
  useEffect(() => {
    if (!env.privy.enabled || !bridge.ready) return;
    if (!bridge.authenticated) {
      if (wallet?.provider === 'embedded') {
        setWallet(null);
        setLocalRole(null);
        persist(null);
      }
      return;
    }
    if (!bridge.liveAddress) return;
    if (wallet?.provider === 'embedded' && wallet.address !== bridge.liveAddress) {
      const next: Wallet = { address: bridge.liveAddress, provider: 'embedded' };
      setWallet(next);
      persist({ ...next, role });
    }
  }, [bridge.ready, bridge.authenticated, bridge.liveAddress, wallet, role, persist]);

  const connect = useCallback(
    async (provider: WalletProvider, manualAddress?: string) => {
      let next: Wallet;

      if (provider === 'embedded') {
        if (!env.privy.enabled) {
          const stored = window.localStorage.getItem('earn.embeddedAddress');
          const address =
            stored ??
            `EMB${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now()
              .toString(36)
              .slice(-4)
              .toUpperCase()}`;
          window.localStorage.setItem('earn.embeddedAddress', address);
          next = { address, provider: 'embedded' };
        } else {
          if (!authedRef.current) {
            await bridge.login();
          }
          // Wait for the Solana embedded wallet to be provisioned.
          const deadline = Date.now() + 15_000;
          let live = liveAddressRef.current;
          while (!live && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 200));
            live = liveAddressRef.current;
          }
          if (!live) {
            throw new Error('Privy login complete, but no Solana wallet was provisioned in time.');
          }
          next = { address: live, provider: 'embedded' };
        }
      } else {
        next = await connectInjectedProvider(provider, manualAddress);
      }

      setWallet(next);
      persist({ ...next, role });
    },
    [bridge, persist, role],
  );

  const disconnect = useCallback(async () => {
    try {
      const win = window as unknown as SolanaWindow;
      if (wallet?.provider === 'phantom') await win.solana?.disconnect?.();
      if (wallet?.provider === 'solflare') await win.solflare?.disconnect?.();
      if (wallet?.provider === 'embedded' && env.privy.enabled) await bridge.logout();
    } catch {}
    setWallet(null);
    setLocalRole(null);
    persist(null);
  }, [persist, bridge, wallet?.provider]);

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
