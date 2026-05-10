// sold-earn MCP tool catalog.
//
// Each tool is one server-side handler with a JSON-Schema input. The MCP
// route exposes them via tools/list + tools/call. Reads are open; writes
// require X-MCP-Key on the HTTP request (checked in the route, not here).
//
// Anti-hallucination: every handler returns *typed JSON only*. Errors are
// thrown — the route turns them into MCP error envelopes. Handlers never
// return free-text or model output.

import { getServerSupabase } from '../supabase';
import { verifySale } from '../agents/verifier';
import type { ProductKind } from '../types';

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // True = requires MCP_API_KEY in the request header.
  requiresAuth: boolean;
  handler: ToolHandler;
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function requireString(args: Record<string, unknown>, key: string, max = 200): string {
  const v = args[key];
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`missing_required_string: ${key}`);
  }
  return v.trim().slice(0, max);
}

function optString(args: Record<string, unknown>, key: string, max = 200): string | undefined {
  const v = args[key];
  if (typeof v !== 'string' || v.trim().length === 0) return undefined;
  return v.trim().slice(0, max);
}

function optNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function db() {
  const sb = getServerSupabase();
  if (!sb) throw new Error('supabase_disabled');
  return sb;
}

// ─────────────────────────────────────────────────────────────────────────
// Read tools
// ─────────────────────────────────────────────────────────────────────────

const listBounties: ToolDef = {
  name: 'list_bounties',
  description:
    'List active bounties on sold-earn, optionally filtered by region (substring) ' +
    'or product kind. Returns id, title, description, productKind, productName, ' +
    'rewardAmount (USDC), rewardToken, targetSales, escrowDeposited, region.',
  requiresAuth: false,
  inputSchema: {
    type: 'object',
    properties: {
      region: { type: 'string', description: 'Region substring filter, e.g. "Lagos"' },
      productKind: {
        type: 'string',
        enum: ['digital', 'service', 'physical'],
      },
      limit: { type: 'number', description: 'Max rows (default 25, max 100)' },
    },
  },
  handler: async (args) => {
    const sb = db();
    const region = optString(args, 'region', 60);
    const productKind = optString(args, 'productKind', 16) as ProductKind | undefined;
    const limit = Math.max(1, Math.min(100, optNumber(args, 'limit') ?? 25));

    let q = sb
      .from('bounties')
      .select(
        'id, title, description, product_kind, product_name, reward_amount, reward_token, target_sales, escrow_deposited, region, status, created_at',
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (productKind) q = q.eq('product_kind', productKind);
    if (region) q = q.ilike('region', `%${region}%`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { bounties: data ?? [] };
  },
};

const getBounty: ToolDef = {
  name: 'get_bounty',
  description:
    'Fetch a single bounty by id, including escrow + verified-sales count, ' +
    'so an agent can decide whether the bounty is still worth working.',
  requiresAuth: false,
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    const sb = db();
    const id = requireString(args, 'id', 64);
    const { data: bounty, error } = await sb
      .from('bounties')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bounty) throw new Error('bounty_not_found');
    const { count: verified } = await sb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('bounty_id', id)
      .eq('status', 'verified');
    const { count: pending } = await sb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('bounty_id', id)
      .eq('status', 'pending');
    return { bounty, verifiedSales: verified ?? 0, pendingSales: pending ?? 0 };
  },
};

const getBountyFunnel: ToolDef = {
  name: 'get_bounty_funnel',
  description:
    'Fetch the latest published Funnel Architect artifact for a bounty: ICP, ' +
    'channels, lead sources, multi-step funnel templates, objections, anti-patterns. ' +
    'Returns null if the vendor has not generated a funnel yet.',
  requiresAuth: false,
  inputSchema: {
    type: 'object',
    properties: { bountyId: { type: 'string' } },
    required: ['bountyId'],
  },
  handler: async (args) => {
    const sb = db();
    const bountyId = requireString(args, 'bountyId', 64);
    const { data } = await sb
      .from('bounty_latest_funnel')
      .select('artifact, llm_model, created_at')
      .eq('bounty_id', bountyId)
      .maybeSingle();
    if (!data) return { funnel: null };
    return { funnel: data.artifact, model: data.llm_model, runAt: data.created_at };
  },
};

const getLeaderboard: ToolDef = {
  name: 'get_leaderboard',
  description:
    'Top scouts by verified-sales count for a given bounty. Returns rank, ' +
    'scoutAddress, displayName, verifiedSales.',
  requiresAuth: false,
  inputSchema: {
    type: 'object',
    properties: {
      bountyId: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['bountyId'],
  },
  handler: async (args) => {
    const sb = db();
    const bountyId = requireString(args, 'bountyId', 64);
    const limit = Math.max(1, Math.min(50, optNumber(args, 'limit') ?? 10));
    const { data: sales } = await sb
      .from('sales')
      .select('scout_address, status')
      .eq('bounty_id', bountyId)
      .eq('status', 'verified');
    const counts = new Map<string, number>();
    for (const s of sales ?? []) {
      counts.set(s.scout_address, (counts.get(s.scout_address) ?? 0) + 1);
    }
    const ordered = Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
    if (ordered.length === 0) return { leaderboard: [] };
    const addrs = ordered.map(([a]) => a);
    const { data: scouts } = await sb
      .from('scouts')
      .select('address, display_name')
      .in('address', addrs);
    const nameByAddr = new Map<string, string>(
      (scouts ?? []).map((s) => [s.address as string, s.display_name as string]),
    );
    return {
      leaderboard: ordered.map(([scoutAddress, verifiedSales], i) => ({
        rank: i + 1,
        scoutAddress,
        displayName: nameByAddr.get(scoutAddress) ?? scoutAddress.slice(0, 8),
        verifiedSales,
      })),
    };
  },
};

const getScoutProfile: ToolDef = {
  name: 'get_scout_profile',
  description:
    'Fetch a scout profile by address: SBT mint, region, reputation, total ' +
    'earned, plus their current open applications and verified-sale count.',
  requiresAuth: false,
  inputSchema: {
    type: 'object',
    properties: { address: { type: 'string' } },
    required: ['address'],
  },
  handler: async (args) => {
    const sb = db();
    const address = requireString(args, 'address', 64);
    const { data: scout, error } = await sb
      .from('scouts')
      .select('*')
      .eq('address', address)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!scout) throw new Error('scout_not_found');
    const { data: apps } = await sb
      .from('applications')
      .select('id, bounty_id, bounty_title, sales_id, status, created_at')
      .eq('scout_address', address)
      .order('created_at', { ascending: false })
      .limit(50);
    const { count: verified } = await sb
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('scout_address', address)
      .eq('status', 'verified');
    return { scout, applications: apps ?? [], verifiedSales: verified ?? 0 };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Write tools (require MCP_API_KEY)
// ─────────────────────────────────────────────────────────────────────────

const submitSaleProof: ToolDef = {
  name: 'submit_sale_proof',
  description:
    'Submit a sale on behalf of a scout. Writes a pending sale row and runs ' +
    'the Sale Verifier agent inline. Returns the agent suggestion. The vendor ' +
    'still has to click Verify in the UI to release escrow — this tool does ' +
    'NOT pay anyone.',
  requiresAuth: true,
  inputSchema: {
    type: 'object',
    properties: {
      salesId: { type: 'string', description: 'The Sales ID minted when the scout applied' },
      scoutAddress: { type: 'string' },
      buyerNote: { type: 'string', description: 'Buyer brand + context, <= 800 chars' },
      txHash: { type: 'string', description: 'On-chain USDC payment signature' },
      payoutAmount: {
        type: 'number',
        description: 'Reward amount this sale claims (USDC). Must equal bounty.rewardAmount.',
      },
    },
    required: ['salesId', 'scoutAddress', 'buyerNote', 'txHash', 'payoutAmount'],
  },
  handler: async (args) => {
    const sb = db();
    const salesId = requireString(args, 'salesId', 80);
    const scoutAddress = requireString(args, 'scoutAddress', 64);
    const buyerNote = requireString(args, 'buyerNote', 800);
    const txHash = requireString(args, 'txHash', 200);
    const payoutAmount = optNumber(args, 'payoutAmount');
    if (payoutAmount === undefined || payoutAmount <= 0) {
      throw new Error('invalid_payout_amount');
    }

    // Resolve sales_id → application → bounty.
    const { data: app } = await sb
      .from('applications')
      .select('id, bounty_id, bounty_title, scout_address, sbt_mint, sales_id')
      .eq('sales_id', salesId)
      .maybeSingle();
    if (!app) throw new Error('sales_id_not_found');
    if (app.scout_address !== scoutAddress) throw new Error('scout_address_mismatch');

    const { data: bounty } = await sb
      .from('bounties')
      .select('id, reward_amount, reward_token, status, title, vendor_address')
      .eq('id', app.bounty_id)
      .maybeSingle();
    if (!bounty) throw new Error('bounty_not_found');
    if (bounty.status !== 'active') throw new Error('bounty_not_active');

    const id = `sale_mcp_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
    const saleRow = {
      id,
      sales_id: app.sales_id,
      bounty_id: app.bounty_id,
      bounty_title: app.bounty_title,
      scout_address: app.scout_address,
      sbt_mint: app.sbt_mint,
      buyer_note: buyerNote,
      tx_hash: txHash,
      payout_amount: payoutAmount,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    };
    const { error: insErr } = await sb.from('sales').insert(saleRow);
    if (insErr) throw new Error(insErr.message);

    // Run the verifier inline. Same shape as /api/sales POST.
    const [{ data: priorScoutSales }, { count: txHashCollisions }] = await Promise.all([
      sb
        .from('sales')
        .select('id, tx_hash, buyer_note, created_at, status')
        .eq('scout_address', scoutAddress)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      sb
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('tx_hash', txHash)
        .neq('id', id),
    ]);

    const result = await verifySale({
      sale: saleRow,
      bountyRewardAmount: Number(bounty.reward_amount),
      bountyRewardToken: bounty.reward_token,
      bountyVendorAddress: bounty.vendor_address,
      bountyStatus: bounty.status,
      priorScoutSales: priorScoutSales ?? [],
      txHashCollisions: txHashCollisions ?? 0,
    });

    await sb.from('sale_verifications').insert({
      sale_id: id,
      decision: result.decision,
      confidence: result.confidence,
      signals: result.signals,
      llm_reasoning: result.llmReasoning ?? null,
      llm_model: result.llmModel ?? null,
      policy_caps: result.policyCaps,
    });

    await sb.from('agent_actions').insert({
      agent: 'sale_verifier',
      action: 'verify_sale_via_mcp',
      subject_kind: 'sale',
      subject_id: id,
      outcome: 'ok',
      payload: { decision: result.decision, confidence: result.confidence },
    });

    return {
      saleId: id,
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      status: 'pending',
      agentSuggestion: result,
      humanGate:
        'Vendor must click Verify in the sold-earn dashboard to release escrow. ' +
        'This tool only filed a pending sale; payout is NOT automatic.',
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Catalog
// ─────────────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  listBounties,
  getBounty,
  getBountyFunnel,
  getLeaderboard,
  getScoutProfile,
  submitSaleProof,
];

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
);
