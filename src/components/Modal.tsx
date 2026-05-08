'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-white border border-earn-gray-900 shadow-[10px_12px_0_rgba(0,0,0,0.92)] sm:shadow-[14px_16px_0_rgba(0,0,0,0.92)] rounded-t-[6px] sm:rounded-none"
        role="document"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-earn-gray-200 bg-white/95 backdrop-blur px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="font-eldritch text-lg sm:text-xl md:text-2xl font-bold leading-tight pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 font-mono text-[10px] uppercase border border-earn-gray-900 bg-white px-3 py-1.5 hover:bg-earn-gray-100"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
