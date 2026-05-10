'use client';

import { useEffect, useState } from 'react';
import type { SuggestionMap } from '@/app/api/sales/suggestions/route';

// Polls /api/sales/suggestions for the given sale ids. Lightweight by
// design — runs on a 6s loop while the page is open, cancels on unmount.
// Returns an empty map when Supabase isn't configured (the API returns {}).
export function useVerifierSuggestions(saleIds: string[]): SuggestionMap {
  const [map, setMap] = useState<SuggestionMap>({});
  const key = saleIds.slice().sort().join(',');

  useEffect(() => {
    if (!key) {
      setMap({});
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/sales/suggestions?ids=${encodeURIComponent(key)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { suggestions?: SuggestionMap };
        if (cancelled) return;
        setMap(json.suggestions ?? {});
      } catch {
        // network blip — try again next tick
      } finally {
        if (!cancelled) timer = setTimeout(tick, 6000);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  return map;
}
