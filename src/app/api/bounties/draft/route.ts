// POST /api/bounties/draft
// body: { brief: string, vendorAddress?: string }
// → { draft, marketRef, model } | { error }
//
// Gathers a real per-productKind reward distribution from active bounties so
// the model has ground truth to anchor its number, then calls the drafter.
// Returns 503 if Groq isn't configured (UI hides the button).

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { isGroqEnabled } from '@/lib/agents/groq';
import { draftBounty, STUB_MARKET_REF, type MarketRef } from '@/lib/agents/drafter';
import type { ProductKind } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!isGroqEnabled) {
    return NextResponse.json({ error: 'groq_disabled' }, { status: 503 });
  }
  let body: { brief?: string; vendorAddress?: string };
  try {
    body = (await req.json()) as { brief?: string; vendorAddress?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const brief = (body.brief ?? '').trim();
  if (brief.length < 8) {
    return NextResponse.json({ error: 'brief_too_short' }, { status: 400 });
  }

  const sb = getServerSupabase();
  const marketRef: MarketRef = sb ? await loadMarketRef(sb) : STUB_MARKET_REF;

  let vendorBrandName: string | undefined;
  let vendorBio: string | undefined;
  if (sb && body.vendorAddress) {
    const { data } = await sb
      .from('vendors')
      .select('brand_name, bio')
      .eq('address', body.vendorAddress)
      .maybeSingle();
    if (data) {
      vendorBrandName = data.brand_name;
      vendorBio = data.bio;
    }
  }

  const result = await draftBounty({
    brief,
    vendorBrandName,
    vendorBio,
    marketRef,
  });

  if (!result) {
    return NextResponse.json(
      { error: 'drafter_failed', detail: 'model returned no usable draft' },
      { status: 502 },
    );
  }

  if (sb) {
    await sb.from('agent_actions').insert({
      agent: 'bounty_drafter',
      action: 'draft_bounty',
      subject_kind: 'vendor',
      subject_id: body.vendorAddress ?? 'unknown',
      outcome: 'ok',
      payload: {
        brief_len: brief.length,
        product_kind: result.draft.productKind,
        reward_amount: result.draft.rewardAmount,
        target_sales: result.draft.targetSales,
        model: result.model,
      },
    });
  }

  return NextResponse.json({
    draft: result.draft,
    marketRef,
    model: result.model,
  });
}

async function loadMarketRef(sb: NonNullable<ReturnType<typeof getServerSupabase>>): Promise<MarketRef> {
  // One round-trip; we aggregate in-memory because the table is small.
  const { data } = await sb
    .from('bounties')
    .select('product_kind, reward_amount, reward_token, status')
    .eq('status', 'active')
    .eq('reward_token', 'USDC');

  const buckets: Record<ProductKind, number[]> = { digital: [], service: [], physical: [] };
  for (const row of data ?? []) {
    const kind = row.product_kind as ProductKind;
    if (!buckets[kind]) continue;
    const amt = Number(row.reward_amount);
    if (Number.isFinite(amt) && amt > 0) buckets[kind].push(amt);
  }

  const rows = (Object.keys(buckets) as ProductKind[]).map((kind) => {
    const xs = buckets[kind];
    if (xs.length === 0) {
      const stub = STUB_MARKET_REF.rows.find((r) => r.productKind === kind)!;
      return stub;
    }
    const sum = xs.reduce((a, b) => a + b, 0);
    return {
      productKind: kind,
      sampleSize: xs.length,
      avgRewardUsdc: Math.round(sum / xs.length),
      minRewardUsdc: Math.round(Math.min(...xs)),
      maxRewardUsdc: Math.round(Math.max(...xs)),
    };
  });
  return { rows };
}
