// Bounty Drafter.
//
// Vendor types a one-line brief; agent fills the bounty form. Anti-hallucination
// posture is the same as the verifier: every "fact" the agent might invent
// (market price ranges, what's a reasonable reward) is fed in as a structured
// signal computed deterministically from the DB. The model's job is shaping
// language, not making up numbers.
//
// Output is strictly schema-validated. Any field that fails validation
// causes the whole draft to be rejected and the route returns a 502 — we
// never half-fill a form with a hallucinated value.

import { chatJson, isGroqEnabled } from './groq';
import type { ProductKind } from '../types';

export type MarketRef = {
  // One row per ProductKind. n=0 is fine — the model treats it as no signal.
  rows: Array<{
    productKind: ProductKind;
    sampleSize: number;
    avgRewardUsdc: number;
    minRewardUsdc: number;
    maxRewardUsdc: number;
  }>;
};

export type DraftedBounty = {
  title: string;
  description: string;
  productKind: ProductKind;
  productName: string;
  rewardAmount: number;
  targetSales: number;
  region: string;
  reasoning: string;
};

export type DrafterResult = {
  draft: DraftedBounty;
  model: string;
};

const PRODUCT_KINDS: ProductKind[] = ['digital', 'service', 'physical'];

const SYSTEM_PROMPT = [
  'You are the Bounty Drafter for a Solana sales-bounty platform. A vendor',
  'describes a product they want scouts to sell; you produce a draft listing.',
  '',
  'Hard rules:',
  '- Choose productKind from EXACTLY: "digital" | "service" | "physical".',
  '- rewardAmount is in USDC, integer. Use the market reference for the',
  '  chosen productKind: stay within [min, max] of that row UNLESS the brief',
  '  explicitly justifies pricing outside the range. If the row has',
  '  sampleSize=0, default to a sensible value for the product type.',
  '- targetSales is an integer >= 1. Default 50 if scale is unclear.',
  '- title <= 60 chars. description <= 280 chars. productName <= 60 chars.',
  '- region: extract from brief; "Global" if not stated.',
  '- DO NOT invent product features, pricing, or geography the brief did',
  '  not mention. If unsure, keep the description generic and short.',
  '',
  'Output: JSON only, exact shape:',
  '{',
  '  "title": string,',
  '  "description": string,',
  '  "productKind": "digital" | "service" | "physical",',
  '  "productName": string,',
  '  "rewardAmount": number,',
  '  "targetSales": number,',
  '  "region": string,',
  '  "reasoning": string  // <=200 chars, explain reward pricing',
  '}',
  'No markdown, no prose outside JSON.',
].join('\n');

export async function draftBounty(input: {
  brief: string;
  vendorBrandName?: string;
  vendorBio?: string;
  marketRef: MarketRef;
}): Promise<DrafterResult | null> {
  if (!isGroqEnabled) return null;

  const marketLines = input.marketRef.rows
    .map(
      (r) =>
        `  ${r.productKind.padEnd(8)}: n=${r.sampleSize}, avg=$${r.avgRewardUsdc}, ` +
        `min=$${r.minRewardUsdc}, max=$${r.maxRewardUsdc}`,
    )
    .join('\n');

  const userMsg = [
    `Brief:\n"""${input.brief.slice(0, 800)}"""`,
    input.vendorBrandName
      ? `Vendor: ${input.vendorBrandName}${input.vendorBio ? ' — ' + input.vendorBio.slice(0, 200) : ''}`
      : 'Vendor: (no profile yet)',
    'Market reference (active bounties on platform, USDC):',
    marketLines || '  (no data yet — use sensible defaults)',
  ].join('\n\n');

  return chatJson<DraftedBounty>(
    {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.2,
      maxTokens: 600,
    },
    validateDraft,
  ).then((r) => (r ? { draft: r.value, model: r.model } : null));
}

function validateDraft(raw: unknown): DraftedBounty | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const title = trimStr(r.title, 80);
  const description = trimStr(r.description, 320);
  const productName = trimStr(r.productName, 80);
  const region = trimStr(r.region, 60) || 'Global';
  const reasoning = trimStr(r.reasoning, 240);
  const productKind = PRODUCT_KINDS.find((k) => k === r.productKind);
  const rewardAmount = num(r.rewardAmount);
  const targetSales = num(r.targetSales);

  if (!title || !description || !productName) return null;
  if (!productKind) return null;
  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100_000) return null;
  if (!Number.isFinite(targetSales) || targetSales < 1 || targetSales > 100_000) return null;

  return {
    title,
    description,
    productKind,
    productName,
    rewardAmount: Math.round(rewardAmount),
    targetSales: Math.round(targetSales),
    region,
    reasoning,
  };
}

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);
  return NaN;
}

// Hardcoded fallback when Supabase isn't configured (so the drafter still
// works in stub mode). Numbers are loosely calibrated against the seed
// bounties in src/lib/store.ts so the model gets a reasonable anchor.
export const STUB_MARKET_REF: MarketRef = {
  rows: [
    { productKind: 'digital', sampleSize: 0, avgRewardUsdc: 35, minRewardUsdc: 10, maxRewardUsdc: 80 },
    { productKind: 'service', sampleSize: 0, avgRewardUsdc: 120, minRewardUsdc: 40, maxRewardUsdc: 300 },
    { productKind: 'physical', sampleSize: 0, avgRewardUsdc: 50, minRewardUsdc: 15, maxRewardUsdc: 120 },
  ],
};
