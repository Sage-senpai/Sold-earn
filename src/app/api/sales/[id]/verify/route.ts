// POST /api/sales/[id]/verify — manual re-run of the verifier on an
// existing sale. Used when the vendor wants a fresh agent suggestion
// (e.g. after the scout edits their note in a future flow).

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { verifySale } from '@/lib/agents/verifier';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: 'supabase_disabled' }, { status: 503 });

  const { data: sale, error } = await sb
    .from('sales')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !sale) return NextResponse.json({ error: 'sale_not_found' }, { status: 404 });

  const { data: bounty } = await sb
    .from('bounties')
    .select('reward_amount, reward_token, status, vendor_address')
    .eq('id', sale.bounty_id)
    .single();
  if (!bounty) return NextResponse.json({ error: 'bounty_not_found' }, { status: 404 });

  const [{ data: priorScoutSales }, { count: txHashCollisions }] = await Promise.all([
    sb
      .from('sales')
      .select('id, tx_hash, buyer_note, created_at, status')
      .eq('scout_address', sale.scout_address)
      .neq('id', sale.id)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('tx_hash', sale.tx_hash)
      .neq('id', sale.id),
  ]);

  const result = await verifySale({
    sale,
    bountyRewardAmount: Number(bounty.reward_amount),
    bountyRewardToken: bounty.reward_token,
    bountyVendorAddress: bounty.vendor_address,
    bountyStatus: bounty.status,
    priorScoutSales: priorScoutSales ?? [],
    txHashCollisions: txHashCollisions ?? 0,
  });

  await sb.from('sale_verifications').insert({
    sale_id: sale.id,
    decision: result.decision,
    confidence: result.confidence,
    signals: result.signals,
    llm_reasoning: result.llmReasoning ?? null,
    llm_model: result.llmModel ?? null,
    policy_caps: result.policyCaps,
  });

  await sb.from('agent_actions').insert({
    agent: 'sale_verifier',
    action: 'verify_sale_rerun',
    subject_kind: 'sale',
    subject_id: sale.id,
    outcome: 'ok',
    payload: { decision: result.decision, confidence: result.confidence },
  });

  return NextResponse.json({ ok: true, suggestion: result });
}
