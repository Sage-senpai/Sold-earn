// GET /api/sales/suggestions?ids=sale_a,sale_b,...
// Returns the latest verifier suggestion per requested sale id. Used by the
// vendor dashboard to overlay agent guidance on its localStorage-driven
// pending list. Empty/no-Supabase → returns {} so the UI just hides the
// agent hint.

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import type { VerificationDecision, VerificationSignal } from '@/lib/supabase';

export const runtime = 'nodejs';

export type SuggestionMap = Record<
  string,
  {
    decision: VerificationDecision;
    confidence: number;
    signals: VerificationSignal[];
    reasoning: string | null;
    runAt: string;
  }
>;

export async function GET(req: Request) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ suggestions: {} as SuggestionMap });

  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ suggestions: {} as SuggestionMap });

  const { data, error } = await sb
    .from('sales_with_suggestion')
    .select('id, agent_decision, agent_confidence, agent_signals, agent_reasoning, agent_run_at')
    .in('id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: SuggestionMap = {};
  for (const row of data ?? []) {
    if (!row.agent_decision || row.agent_run_at == null) continue;
    out[row.id as string] = {
      decision: row.agent_decision as VerificationDecision,
      confidence: Number(row.agent_confidence),
      signals: (row.agent_signals as VerificationSignal[]) ?? [],
      reasoning: (row.agent_reasoning as string) ?? null,
      runAt: row.agent_run_at as string,
    };
  }
  return NextResponse.json({ suggestions: out });
}
