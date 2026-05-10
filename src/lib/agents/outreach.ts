// Outreach Drafter.
//
// Scout-facing agent. Given a bounty + a free-text description of one lead
// (the prospect the scout is about to contact), produces a small set of
// channel-specific messages plus research hooks the scout should verify
// before sending. Per-call only — output is not persisted.
//
// Anti-hallucination: the agent must keep claims to what's stated about
// the lead. It is allowed to use the funnel artifact (passed in) for tone
// and structure, but must not invent specifics about the lead's company,
// pains, or buying intent. Placeholders left for the scout to fill are
// preferable to invented content.

import { chatJson, isGroqEnabled } from './groq';
import type { FunnelArtifact } from './funnel';

export type OutreachChannel = 'x_dm' | 'telegram' | 'email' | 'linkedin' | 'whatsapp';

export type OutreachMessage = {
  channel: OutreachChannel;
  subject: string | null;     // only for email
  body: string;
};

export type OutreachKit = {
  messages: OutreachMessage[];
  research_hooks: string[];   // facts to verify before sending
  unknown_fields: string[];   // explicit list of placeholders the scout must fill
};

export type OutreachInput = {
  bountyTitle: string;
  bountyDescription: string;
  productName: string;
  region: string;
  rewardAmount: number;
  // Salesperson voice — the scout's display name + region.
  scoutDisplayName: string;
  scoutRegion: string;
  // Free-text lead description from the scout.
  leadDescription: string;
  // Channels the scout wants drafts for. Limited to keep tokens reasonable.
  channels: OutreachChannel[];
  // Optional: cached funnel artifact to anchor tone + step structure.
  funnel?: FunnelArtifact | null;
};

const CHANNELS: OutreachChannel[] = ['x_dm', 'telegram', 'email', 'linkedin', 'whatsapp'];

const SYSTEM_PROMPT = [
  'You are the Outreach Drafter for a Solana sales-bounty platform. A scout',
  'is about to contact one lead about one product; you write short, honest,',
  'channel-appropriate cold messages.',
  '',
  'Hard rules:',
  '- Stay within what the scout said about the lead. Do NOT invent the',
  '  lead\'s company size, pains, recent news, or buying intent. If a fact',
  '  would help but is not in the input, leave a clear {{placeholder}} and',
  '  list it under "unknown_fields".',
  '- The scout speaks in first person as themselves, not as the vendor.',
  '- No spammy claims, no fake guarantees, no fabricated stats. No emoji',
  '  unless culturally normal for the channel.',
  '- Length budgets:',
  '    x_dm:     <= 280 chars',
  '    telegram: <= 400 chars',
  '    whatsapp: <= 400 chars',
  '    linkedin: <= 700 chars',
  '    email:    subject <= 60 chars, body <= 900 chars',
  '- "research_hooks" lists 2-4 SHORT items the scout should verify before',
  '  sending (e.g. "Confirm the lead actually accepts crypto payments").',
  '- "unknown_fields" lists every {{placeholder}} present in any message.',
  '',
  'Output JSON ONLY. Exact shape:',
  '{',
  '  "messages": [{"channel": "x_dm|telegram|email|linkedin|whatsapp",',
  '                "subject": str|null, "body": str}],',
  '  "research_hooks": str[],',
  '  "unknown_fields": str[]',
  '}',
  'No markdown, no prose outside JSON.',
].join('\n');

export type OutreachResult = { kit: OutreachKit; model: string };

export async function draftOutreach(input: OutreachInput): Promise<OutreachResult | null> {
  if (!isGroqEnabled) return null;

  const channelsCsv = input.channels.length
    ? input.channels.join(', ')
    : 'x_dm, email';

  const funnelHint = input.funnel
    ? [
        'Funnel context (use for tone/stage, not as facts about THIS lead):',
        `  ICP: ${input.funnel.icp.who}`,
        `  Top pains: ${input.funnel.icp.pains.slice(0, 3).join(' / ')}`,
        `  Common objections: ${input.funnel.objections.slice(0, 2).map((o) => o.concern).join(' / ')}`,
        `  Do not say: ${input.funnel.do_not_say.slice(0, 3).join(' / ')}`,
      ].join('\n')
    : '';

  const userMsg = [
    `Bounty: ${input.bountyTitle}`,
    `Product: ${input.productName}`,
    `Vendor description: ${input.bountyDescription.slice(0, 400)}`,
    `Region focus: ${input.region}`,
    `Reward to scout per verified sale: ${input.rewardAmount} USDC`,
    `Scout name (sender): ${input.scoutDisplayName}`,
    `Scout region: ${input.scoutRegion}`,
    `Channels to draft: ${channelsCsv}`,
    `Lead description (everything we know about THIS prospect):`,
    `"""${input.leadDescription.slice(0, 800)}"""`,
    funnelHint,
  ]
    .filter(Boolean)
    .join('\n\n');

  const r = await chatJson<OutreachKit>(
    {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.3,
      maxTokens: 1400,
    },
    validateKit,
  );
  if (!r) return null;
  return { kit: r.value, model: r.model };
}

function validateKit(raw: unknown): OutreachKit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const messages = parseMessages(r.messages);
  if (messages.length === 0) return null;
  return {
    messages,
    research_hooks: parseStrArr(r.research_hooks, 6, 200),
    unknown_fields: parseStrArr(r.unknown_fields, 12, 80),
  };
}

function parseMessages(raw: unknown): OutreachMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const o = m as Record<string, unknown>;
      const channel = CHANNELS.find((c) => c === o.channel);
      const body = trimStr(o.body, 1200);
      const subject =
        typeof o.subject === 'string' && o.subject.trim().length > 0
          ? trimStr(o.subject, 100)
          : null;
      if (!channel || !body) return null;
      return { channel, subject, body };
    })
    .filter((x): x is OutreachMessage => x !== null);
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
