'use client';

import type { ReactNode } from 'react';
import { WalletProviderRoot } from '@/lib/wallet';
import { ToastProvider } from '@/lib/toast';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WalletProviderRoot>{children}</WalletProviderRoot>
    </ToastProvider>
  );
}
