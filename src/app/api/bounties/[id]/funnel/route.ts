// GET  /api/bounties/[id]/funnel  → latest persisted funnel artifact
// POST /api/bounties/[id]/funnel  → regenerate (vendor only)
//
// The funnel is persisted server-side so scouts can read it without
// triggering an LLM call. Regeneration is gated behind an explicit POST,
// payload may include {force: true} to skip stale-check.

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { isGroqEnabled } from '@/lib/agents/groq';
import { buildFunnel, type FunnelArtifact } from '@/lib/agents/funnel';
import type { ProductKind } from '@/lib/types';

export const runtime = 'nodejs';

type LatestRow = {
  bounty_id: string;
  artifact: FunnelArtifact;
  llm_model: string | null;
  bounty_title_at_run: string | null;
  bounty_desc_hash: string | null;
  created_at: string;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ funnel: null, mode: 'stub' });
  const { data } = await sb
    .from('bounty_latest_funnel')
    .select('*')
    .eq('bounty_id', params.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ funnel: null });
  const row = data as LatestRow;
  return NextResponse.json({
    funnel: row.artifact,
    model: row.llm_model,
    titleAtRun: row.bounty_title_at_run,
    runAt: row.created_at,
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isGroqEnabled) {
    return NextResponse.json({ error: 'groq_disabled' }, { status: 503 });
  }
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: 'supabase_disabled' }, { status: 503 });

  const { data: bounty, error } = await sb
    .from('bounties')
    .select('id, title, description, product_kind, product_name, reward_amount, region, vendor_address')
    .eq('id', params.id)
    .single();
  if (error || !bounty) {
    return NextResponse.json({ error: 'bounty_not_found' }, { status: 404 });
  }

  // Pull vendor profile if available — gives the agent brand context.
  const { data: vendor } = await sb
    .from('vendors')
    .select('brand_name, bio')
    .eq('address', bounty.vendor_address)
    .maybeSingle();

  const result = await buildFunnel({
    title: bounty.title,
    description: bounty.description,
    productKind: bounty.product_kind as ProductKind,
    productName: bounty.product_name,
    rewardAmount: Number(bounty.reward_amount),
    region: bounty.region,
    vendorBrandName: vendor?.brand_name,
    vendorBio: vendor?.bio,
  });

  if (!result) {
    return NextResponse.json(
      { error: 'funnel_failed', detail: 'model returned no usable artifact' },
      { status: 502 },
    );
  }

  const descHash = await sha256(`${bounty.title}\n\n${bounty.description}`);

  await sb.from('bounty_funnels').insert({
    bounty_id: bounty.id,
    artifact: result.artifact,
    llm_model: result.model,
    bounty_title_at_run: bounty.title,
    bounty_desc_hash: descHash,
  });

  await sb.from('agent_actions').insert({
    agent: 'funnel_architect',
    action: 'build_funnel',
    subject_kind: 'bounty',
    subject_id: bounty.id,
    outcome: 'ok',
    payload: {
      stages: result.artifact.funnel.length,
      channels: result.artifact.channels.length,
      lead_sources: result.artifact.lead_sources.length,
      model: result.model,
    },
  });

  return NextResponse.json({ funnel: result.artifact, model: result.model });
}

// Cheap content hash so we can later flag a funnel as stale when a vendor
// edits the bounty copy. SHA-256, lowercase hex, first 16 chars is enough.
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}
