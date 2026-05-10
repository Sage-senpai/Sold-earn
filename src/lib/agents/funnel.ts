// Funnel Architect.
//
// Vendor-facing agent that emits a sales playbook for a given bounty:
// ICP, channels, lead sources, multi-step outreach funnel, common
// objections + rebuttals. Output is a structured JSON artifact persisted
// to bounty_funnels and rendered to scouts as a read-only kit.
//
// Anti-hallucination posture: the model must derive everything from the
// bounty inputs. We forbid invented integrations, statistics, or links.
// Lead sources are categorical (community / directory / search query /
// competitor) — the agent suggests *where to look*, not specific URLs it
// can't verify.

import { chatJson, isGroqEnabled } from './groq';
import type { ProductKind } from '../types';

export type FunnelChannelFit = 'high' | 'medium' | 'low';

export type FunnelArtifact = {
  icp: {
    who: string;
    pains: string[];
    buying_signals: string[];
    deal_breakers: string[];
  };
  channels: Array<{
    name: string;          // e.g. "X DM", "Telegram group", "Email"
    fit: FunnelChannelFit;
    why: string;
  }>;
  lead_sources: Array<{
    kind: 'community' | 'directory' | 'search_query' | 'competitor' | 'event';
    label: string;
    where: string;         // descriptive ("Solana dev Telegram groups in Lagos") not URL
  }>;
  funnel: Array<{
    stage: string;         // "open" | "qualify" | "demo" | "close" | custom
    channel: string;
    send_when: string;     // trigger / timing
    message_template: string;
  }>;
  objections: Array<{ concern: string; rebuttal: string }>;
  do_not_say: string[];    // anti-patterns / claims to avoid
};

export type FunnelInput = {
  title: string;
  description: string;
  productKind: ProductKind;
  productName: string;
  rewardAmount: number;
  region: string;
  vendorBrandName?: string;
  vendorBio?: string;
};

const PRODUCT_KINDS: ProductKind[] = ['digital', 'service', 'physical'];
const FITS: FunnelChannelFit[] = ['high', 'medium', 'low'];
const SOURCE_KINDS = ['community', 'directory', 'search_query', 'competitor', 'event'] as const;

const SYSTEM_PROMPT = [
  'You are the Funnel Architect for a Solana sales-bounty marketplace.',
  'You produce a sales playbook scouts can actually execute.',
  '',
  'Hard rules:',
  '- Derive everything from the bounty inputs. Do NOT invent statistics,',
  '  customer counts, integration partners, or claims the vendor did not state.',
  '- Lead sources describe WHERE to look, not specific URLs. Use placeholders',
  '  like "Solana dev Telegram groups in {region}" — never a fabricated link.',
  '- Funnel must have 3-5 stages. First stage opens cold; last stage asks',
  '  for the close. Each stage names a channel, a trigger ("send_when"),',
  '  and a SHORT message template (<=500 chars) with placeholders like',
  '  {{first_name}}, {{company}}, {{pain_point}}.',
  '- Channels: pick from the obvious set for the productKind. "high"/"medium"',
  '  /"low" fit, with a one-sentence why.',
  '- ICP must be concrete enough that a scout could screen a lead in 30s.',
  '- objections: 3-5 real concerns a buyer would raise.',
  '- do_not_say: 2-4 anti-patterns scouts should avoid (e.g. unsupported',
  '  guarantees, regulated claims).',
  '',
  'Output JSON ONLY, exact shape:',
  '{',
  '  "icp": {"who": str, "pains": str[], "buying_signals": str[], "deal_breakers": str[]},',
  '  "channels": [{"name": str, "fit": "high|medium|low", "why": str}],',
  '  "lead_sources": [{"kind": "community|directory|search_query|competitor|event",',
  '                    "label": str, "where": str}],',
  '  "funnel": [{"stage": str, "channel": str, "send_when": str, "message_template": str}],',
  '  "objections": [{"concern": str, "rebuttal": str}],',
  '  "do_not_say": str[]',
  '}',
  'No markdown, no prose outside JSON.',
].join('\n');

export type FunnelResult = { artifact: FunnelArtifact; model: string };

export async function buildFunnel(input: FunnelInput): Promise<FunnelResult | null> {
  if (!isGroqEnabled) return null;
  const userMsg = [
    `Bounty title: ${input.title}`,
    `Description: ${input.description}`,
    `Product kind: ${input.productKind}`,
    `Product name: ${input.productName}`,
    `Reward per verified sale: ${input.rewardAmount} USDC`,
    `Region: ${input.region}`,
    input.vendorBrandName ? `Vendor: ${input.vendorBrandName}` : 'Vendor: (no profile)',
    input.vendorBio ? `Vendor bio: ${input.vendorBio.slice(0, 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const r = await chatJson<FunnelArtifact>(
    {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.3,
      maxTokens: 2400,
    },
    validateFunnel,
  );
  if (!r) return null;
  return { artifact: r.value, model: r.model };
}

function validateFunnel(raw: unknown): FunnelArtifact | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const icp = parseIcp(r.icp);
  const channels = parseChannels(r.channels);
  const lead_sources = parseLeadSources(r.lead_sources);
  const funnel = parseFunnel(r.funnel);
  const objections = parseObjections(r.objections);
  const do_not_say = parseStrArr(r.do_not_say, 8, 240);

  if (!icp || channels.length === 0 || lead_sources.length === 0) return null;
  if (funnel.length < 2 || funnel.length > 8) return null;
  if (objections.length === 0) return null;

  // Make sure productKind validation isn't forgotten anywhere; touch it.
  void PRODUCT_KINDS;

  return { icp, channels, lead_sources, funnel, objections, do_not_say };
}

function parseIcp(raw: unknown): FunnelArtifact['icp'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const who = trimStr(r.who, 240);
  if (!who) return null;
  return {
    who,
    pains: parseStrArr(r.pains, 8, 200),
    buying_signals: parseStrArr(r.buying_signals, 8, 200),
    deal_breakers: parseStrArr(r.deal_breakers, 8, 200),
  };
}

function parseChannels(raw: unknown): FunnelArtifact['channels'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const name = trimStr(o.name, 60);
      const why = trimStr(o.why, 240);
      const fit = FITS.find((f) => f === o.fit);
      if (!name || !fit) return null;
      return { name, fit, why };
    })
    .filter((x): x is FunnelArtifact['channels'][number] => x !== null);
}

function parseLeadSources(raw: unknown): FunnelArtifact['lead_sources'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const kind = SOURCE_KINDS.find((k) => k === o.kind);
      const label = trimStr(o.label, 100);
      const where = trimStr(o.where, 240);
      if (!kind || !label || !where) return null;
      return { kind, label, where };
    })
    .filter((x): x is FunnelArtifact['lead_sources'][number] => x !== null);
}

function parseFunnel(raw: unknown): FunnelArtifact['funnel'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const stage = trimStr(o.stage, 40);
      const channel = trimStr(o.channel, 60);
      const send_when = trimStr(o.send_when, 200);
      const message_template = trimStr(o.message_template, 700);
      if (!stage || !channel || !message_template) return null;
      return { stage, channel, send_when, message_template };
    })
    .filter((x): x is FunnelArtifact['funnel'][number] => x !== null);
}

function parseObjections(raw: unknown): FunnelArtifact['objections'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const concern = trimStr(o.concern, 200);
      const rebuttal = trimStr(o.rebuttal, 400);
      if (!concern || !rebuttal) return null;
      return { concern, rebuttal };
    })
    .filter((x): x is FunnelArtifact['objections'][number] => x !== null);
}

function parseStrArr(raw: unknown, max: number, charMax: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, max)
    .map((s) => trimStr(s, charMax))
    .filter(Boolean);
}

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}
