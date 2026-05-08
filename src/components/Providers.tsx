'use client';

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WalletProviderRoot } from '@/lib/wallet';
import { ToastProvider } from '@/lib/toast';
import { env } from '@/lib/env';

export default function Providers({ children }: { children: ReactNode }) {
  const tree = (
    <ToastProvider>
      <WalletProviderRoot>{children}</WalletProviderRoot>
    </ToastProvider>
  );

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
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
          ethereum: { createOnLogin: 'off' },
        },
      }}
    >
      {tree}
    </PrivyProvider>
  );
}
