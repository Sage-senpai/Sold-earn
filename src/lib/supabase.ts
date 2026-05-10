// Supabase client. Server routes use the service-role client (bypasses RLS).
// Browser code reads through the anon client. Both gracefully degrade to
// `null` if env vars are absent — every caller must handle the null case so
// the app keeps working without a Supabase project (matches the wider
// "graceful stub" pattern used by escrow / sbt / wallet).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Db = SupabaseClient<any, 'public', any>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const isSupabaseEnabled = !!(url && (anonKey || serviceKey));

let _server: Db | null = null;
let _browser: Db | null = null;

export function getServerSupabase(): Db | null {
  if (!url || !serviceKey) return null;
  if (_server) return _server;
  _server = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _server;
}

export function getBrowserSupabase(): Db | null {
  if (!url || !anonKey) return null;
  if (_browser) return _browser;
  _browser = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _browser;
}

// Row shapes matching the SQL schema. Snake_case so we can pass directly.
export type SaleRow = {
  id: string;
  sales_id: string;
  bounty_id: string;
  bounty_title: string;
  scout_address: string;
  sbt_mint: string;
  buyer_note: string;
  tx_hash: string;
  payout_amount: number;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
};

export type VerificationDecision = 'auto_approve' | 'auto_reject' | 'human_review';

export type VerificationSignal = {
  key: string;
  ok: boolean;
  weight: number;
  detail?: string;
};

export type SaleWithSuggestion = SaleRow & {
  agent_decision: VerificationDecision | null;
  agent_confidence: number | null;
  agent_signals: VerificationSignal[] | null;
  agent_reasoning: string | null;
  agent_run_at: string | null;
};
