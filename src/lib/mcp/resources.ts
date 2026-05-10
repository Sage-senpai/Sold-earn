// MCP resources — addressable, read-only data surfaces. Clients can list
// and fetch these without burning a tool-call slot on the model.
//
// URI scheme:
//   sold-earn://bounties/active    → JSON array of active bounties
//   sold-earn://bounty/{id}        → JSON object of one bounty + funnel
//   sold-earn://bounty/{id}/funnel → JSON object of latest funnel artifact

import { getServerSupabase } from '../supabase';

export type ResourceTemplate = {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
};

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: 'sold-earn://bounties/active',
    name: 'Active bounties',
    description: 'All currently-active bounties on sold-earn.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'sold-earn://bounty/{id}',
    name: 'Bounty detail',
    description: 'Full bounty record including escrow + verified count.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'sold-earn://bounty/{id}/funnel',
    name: 'Bounty funnel',
    description: 'Latest Funnel Architect artifact for the bounty.',
    mimeType: 'application/json',
  },
];

// Returns the JSON-encoded body, or throws on bad URI / missing data.
export async function readResource(uri: string): Promise<{ mimeType: string; text: string }> {
  const sb = getServerSupabase();
  if (!sb) throw new Error('supabase_disabled');

  if (uri === 'sold-earn://bounties/active') {
    const { data } = await sb
      .from('bounties')
      .select('id, title, description, product_kind, product_name, reward_amount, reward_token, target_sales, region, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    return { mimeType: 'application/json', text: JSON.stringify({ bounties: data ?? [] }, null, 2) };
  }

  const bountyMatch = uri.match(/^sold-earn:\/\/bounty\/([^/]+)$/);
  if (bountyMatch) {
    const id = bountyMatch[1];
    const { data: bounty } = await sb.from('bounties').select('*').eq('id', id).maybeSingle();
    if (!bounty) throw new Error('bounty_not_found');
    return { mimeType: 'application/json', text: JSON.stringify(bounty, null, 2) };
  }

  const funnelMatch = uri.match(/^sold-earn:\/\/bounty\/([^/]+)\/funnel$/);
  if (funnelMatch) {
    const id = funnelMatch[1];
    const { data } = await sb
      .from('bounty_latest_funnel')
      .select('artifact, llm_model, created_at')
      .eq('bounty_id', id)
      .maybeSingle();
    return {
      mimeType: 'application/json',
      text: JSON.stringify(data ?? { funnel: null }, null, 2),
    };
  }

  throw new Error('unknown_resource_uri');
}
