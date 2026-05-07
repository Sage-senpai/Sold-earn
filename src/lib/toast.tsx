'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'error';
type Toast = { id: number; message: string; tone: Tone };

type Ctx = {
  toast: (message: string, tone?: Tone) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, message, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto border border-earn-gray-900 bg-white/95 px-4 py-3 font-mono text-xs uppercase shadow-[6px_7px_0_rgba(0,0,0,0.85)]"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: t.tone === 'error' ? '#a32d2d' : t.tone === 'success' ? '#0f6e56' : '#0b0b0b',
              minWidth: 240,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
