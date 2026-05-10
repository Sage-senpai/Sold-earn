// POST /api/outreach/draft
// body: {
//   bountyId: string,
//   leadDescription: string,
//   channels: OutreachChannel[],
//   scoutAddress?: string,
// }
// → { kit, model } | { error }
//
// Pulls the bounty + (if available) the latest funnel artifact + scout
// profile from Supabase, then runs the Outreach Drafter. Per-call only;
// nothing persisted (the kit is ephemeral guidance).

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { isGroqEnabled } from '@/lib/agents/groq';
import { draftOutreach, type OutreachChannel } from '@/lib/agents/outreach';
import type { FunnelArtifact } from '@/lib/agents/funnel';

export const runtime = 'nodejs';

const VALID_CHANNELS: OutreachChannel[] = ['x_dm', 'telegram', 'email', 'linkedin', 'whatsapp'];

type Body = {
  bountyId?: string;
  leadDescription?: string;
  channels?: string[];
  scoutAddress?: string;
};

export async function POST(req: Request) {
  if (!isGroqEnabled) {
    return NextResponse.json({ error: 'groq_disabled' }, { status: 503 });
  }
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: 'supabase_disabled' }, { status: 503 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const bountyId = (body.bountyId ?? '').trim();
  const leadDescription = (body.leadDescription ?? '').trim();
  if (!bountyId || leadDescription.length < 8) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  const channels = (body.channels ?? [])
    .map((c) => c as OutreachChannel)
    .filter((c) => VALID_CHANNELS.includes(c));
  if (channels.length === 0) channels.push('x_dm', 'email');

  const { data: bounty, error } = await sb
    .from('bounties')
    .select('id, title, description, product_name, region, reward_amount')
    .eq('id', bountyId)
    .single();
  if (error || !bounty) return NextResponse.json({ error: 'bounty_not_found' }, { status: 404 });

  let scoutDisplayName = 'Scout';
  let scoutRegion = 'Global';
  if (body.scoutAddress) {
    const { data: scout } = await sb
      .from('scouts')
      .select('display_name, region')
      .eq('address', body.scoutAddress)
      .maybeSingle();
    if (scout) {
      scoutDisplayName = scout.display_name ?? scoutDisplayName;
      scoutRegion = scout.region ?? scoutRegion;
    }
  }

  const { data: funnelRow } = await sb
    .from('bounty_latest_funnel')
    .select('artifact')
    .eq('bounty_id', bountyId)
    .maybeSingle();
  const funnel = (funnelRow?.artifact as FunnelArtifact | undefined) ?? null;

  const result = await draftOutreach({
    bountyTitle: bounty.title,
    bountyDescription: bounty.description,
    productName: bounty.product_name,
    region: bounty.region,
    rewardAmount: Number(bounty.reward_amount),
    scoutDisplayName,
    scoutRegion,
    leadDescription,
    channels: channels.slice(0, 3),  // cap tokens
    funnel,
  });

  if (!result) {
    return NextResponse.json(
      { error: 'drafter_failed', detail: 'model returned no usable kit' },
      { status: 502 },
    );
  }

  await sb.from('agent_actions').insert({
    agent: 'outreach_drafter',
    action: 'draft_outreach',
    subject_kind: 'bounty',
    subject_id: bountyId,
    outcome: 'ok',
    payload: {
      channels,
      scout_address: body.scoutAddress ?? null,
      messages: result.kit.messages.length,
      model: result.model,
    },
  });

  return NextResponse.json({ kit: result.kit, model: result.model });
}
