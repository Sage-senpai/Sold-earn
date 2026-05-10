// POST /api/sales — write a sale to Supabase and immediately run the
// verifier agent. Returns the agent's suggestion so the client can render
// it without a second roundtrip. No-op (returns 200) when Supabase isn't
// configured, so the app keeps working.
//
// Bounty + scout rows are upserted on demand from the client payload — this
// keeps the migration off-ramp narrow during the localStorage → Supabase
// transition. Once the client reads bounties from the server, drop the
// upsert and require FK existence.

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { verifySale } from '@/lib/agents/verifier';
import type { Bounty, Sale, ScoutProfile, VendorProfile } from '@/lib/types';

export const runtime = 'nodejs';

type Payload = {
  sale: Sale;
  bounty: Bounty;
  scout?: ScoutProfile;
  vendor?: VendorProfile;
};

export async function POST(req: Request) {
  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ ok: true, mode: 'stub', suggestion: null });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { sale, bounty, scout, vendor } = body ?? {};
  if (!sale?.id || !bounty?.id) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Upsert vendor → bounty → scout → sale, in FK order.
  if (vendor) {
    await sb.from('vendors').upsert({
      address: vendor.address,
      brand_name: vendor.brandName,
      bio: vendor.bio,
      website: vendor.website ?? null,
      contact_x: vendor.contactX ?? null,
      contact_telegram: vendor.contactTelegram ?? null,
    });
  } else {
    // Seed bounties have no vendor profile yet — synthesize one to satisfy FK.
    await sb.from('vendors').upsert({
      address: bounty.vendorAddress,
      brand_name: 'Pending vendor',
      bio: '',
    });
  }

  await sb.from('bounties').upsert({
    id: bounty.id,
    vendor_address: bounty.vendorAddress,
    title: bounty.title,
    description: bounty.description,
    product_kind: bounty.productKind,
    product_name: bounty.productName,
    reward_amount: bounty.rewardAmount,
    reward_token: bounty.rewardToken,
    escrow_deposited: bounty.escrowDeposited,
    target_sales: bounty.targetSales,
    region: bounty.region,
    status: bounty.status,
  });

  if (scout) {
    await sb.from('scouts').upsert({
      address: scout.address,
      display_name: scout.displayName,
      bio: scout.bio,
      social_x: scout.socialX ?? null,
      social_telegram: scout.socialTelegram ?? null,
      region: scout.region,
      wallet_provider: scout.walletProvider,
      payout_locked: scout.payoutLocked,
      sbt_mint: scout.sbtMint,
      reputation: scout.reputation,
      total_earned: scout.totalEarned,
    });
  }

  const saleRow = {
    id: sale.id,
    sales_id: sale.salesId,
    bounty_id: sale.bountyId,
    bounty_title: sale.bountyTitle,
    scout_address: sale.scoutAddress,
    sbt_mint: sale.sbtMint,
    buyer_note: sale.buyerNote,
    tx_hash: sale.txHash,
    payout_amount: sale.payoutAmount,
    status: sale.status,
    created_at: new Date(sale.createdAt).toISOString(),
  };
  const { error: saleErr } = await sb.from('sales').upsert(saleRow);
  if (saleErr) {
    return NextResponse.json({ error: saleErr.message }, { status: 500 });
  }

  // Gather context for the verifier and run it inline. Sub-second under
  // typical load; Groq adjudication adds ~300-700ms.
  const [{ data: priorScoutSales }, { count: txHashCollisions }] = await Promise.all([
    sb
      .from('sales')
      .select('id, tx_hash, buyer_note, created_at, status')
      .eq('scout_address', sale.scoutAddress)
      .neq('id', sale.id)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('tx_hash', sale.txHash)
      .neq('id', sale.id),
  ]);

  const result = await verifySale({
    sale: saleRow,
    bountyRewardAmount: bounty.rewardAmount,
    bountyRewardToken: bounty.rewardToken,
    bountyVendorAddress: bounty.vendorAddress,
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
    action: 'verify_sale',
    subject_kind: 'sale',
    subject_id: sale.id,
    outcome: 'ok',
    payload: {
      decision: result.decision,
      confidence: result.confidence,
      llm_used: !!result.llmModel,
    },
  });

  return NextResponse.json({ ok: true, mode: 'live', suggestion: result });
}
