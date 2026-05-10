'use client';

import { useMemo, type ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { WalletProviderRoot } from '@/lib/wallet';
import { ToastProvider } from '@/lib/toast';
import { env } from '@/lib/env';

// Privy v3 needs explicit Solana RPC clients when walletChainType is
// 'solana-only'. Without them, embedded wallets throw "No RPC configuration
// found for chain solana:<network>" the first time they try to sign. The
// SOLANA_CHAINS the SDK accepts are 'solana:mainnet|devnet|testnet' — we
// derive that from NEXT_PUBLIC_SOLANA_NETWORK.
const SOLANA_CHAIN_FOR_NETWORK = {
  'mainnet-beta': 'solana:mainnet',
  mainnet: 'solana:mainnet',
  devnet: 'solana:devnet',
  testnet: 'solana:testnet',
  localnet: 'solana:devnet',
} as const;

// HTTP RPC URL → WS URL by swapping protocols. Most public RPCs accept both
// on the same host. If a custom Helius/QuickNode URL is set, use it; else
// the default Solana cluster URLs.
function wsUrlFromHttp(http: string): string {
  if (http.startsWith('https://')) return 'wss://' + http.slice('https://'.length);
  if (http.startsWith('http://')) return 'ws://' + http.slice('http://'.length);
  return http;
}

// Login methods are opt-in via NEXT_PUBLIC_PRIVY_LOGIN_METHODS so a fresh
// dashboard (which has only email + wallet enabled out of the box) doesn't
// 403 on Google/Twitter buttons. Add providers to this env var only AFTER
// you've enabled them in dash.privy.io → Login methods.
type LoginMethod = 'email' | 'wallet' | 'google' | 'twitter' | 'discord' | 'sms';

function parseLoginMethods(): LoginMethod[] {
  const raw = process.env.NEXT_PUBLIC_PRIVY_LOGIN_METHODS;
  if (!raw) return ['email', 'wallet'];
  const allowed: LoginMethod[] = ['email', 'wallet', 'google', 'twitter', 'discord', 'sms'];
  const out = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is LoginMethod => (allowed as string[]).includes(s));
  return out.length ? out : ['email', 'wallet'];
}

export default function Providers({ children }: { children: ReactNode }) {
  const tree = (
    <ToastProvider>
      <WalletProviderRoot>{children}</WalletProviderRoot>
    </ToastProvider>
  );

  // Build the @solana/kit clients lazily and only once. They aren't safe to
  // construct on the server (they hold sockets), so we keep this inside the
  // 'use client' component memo.
  const solanaRpcs = useMemo(() => {
    if (!env.privy.enabled) return undefined;
    const chain = SOLANA_CHAIN_FOR_NETWORK[env.solana.network] ?? 'solana:devnet';
    return {
      [chain]: {
        rpc: createSolanaRpc(env.solana.rpcUrl),
        rpcSubscriptions: createSolanaRpcSubscriptions(wsUrlFromHttp(env.solana.rpcUrl)),
      },
    };
  }, []);

  if (!env.privy.enabled) return tree;

  return (
    <PrivyProvider
      appId={env.privy.appId}
      config={{
        appearance: {
          walletChainType: 'solana-only',
          theme: 'light',
          accentColor: '#0f6e56',
          showWalletLoginFirst: false,
        },
        loginMethods: parseLoginMethods(),
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
          ethereum: { createOnLogin: 'off' },
        },
        solana: { rpcs: solanaRpcs },
      }}
    >
      {tree}
    </PrivyProvider>
  );
}
