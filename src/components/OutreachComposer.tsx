'use client';

import { useState } from 'react';
import type { OutreachChannel, OutreachKit } from '@/lib/agents/outreach';

type Props = {
  bountyId: string;
  scoutAddress?: string;
  onError?: (msg: string) => void;
};

const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  x_dm: 'X DM',
  telegram: 'Telegram',
  email: 'Email',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
};

const DEFAULT_CHANNELS: OutreachChannel[] = ['x_dm', 'email'];

export default function OutreachComposer({ bountyId, scoutAddress, onError }: Props) {
  const [lead, setLead] = useState('');
  const [channels, setChannels] = useState<OutreachChannel[]>(DEFAULT_CHANNELS);
  const [busy, setBusy] = useState(false);
  const [kit, setKit] = useState<OutreachKit | null>(null);

  const toggleChannel = (c: OutreachChannel) => {
    setChannels((cur) =>
      cur.includes(c)
        ? cur.filter((x) => x !== c)
        : cur.length >= 3
          ? cur
          : [...cur, c],
    );
  };

  const submit = async () => {
    if (lead.trim().length < 8) {
      onError?.('Describe the lead in at least a sentence');
      return;
    }
    if (channels.length === 0) {
      onError?.('Pick at least one channel');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/outreach/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bountyId,
          leadDescription: lead,
          channels,
          scoutAddress,
        }),
      });
      if (res.status === 503) {
        onError?.('Drafter offline — needs Supabase + GROQ_API_KEY');
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        onError?.(j.error ?? 'Draft failed');
        return;
      }
      const j = (await res.json()) as { kit: OutreachKit };
      setKit(j.kit);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Draft failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ink-panel p-6">
      <h2 className="font-eldritch text-xl font-bold">Outreach Drafter</h2>
      <p className="font-mono text-[10px] uppercase text-earn-gray-600">
        agent drafts a message for one lead
      </p>
      <div className="rune-rule my-4" />

      <label className="field-label">Tell the agent about the lead</label>
      <textarea
        className="field-input min-h-[88px]"
        value={lead}
        onChange={(e) => setLead(e.target.value)}
        placeholder="Alpha Books, a Lagos bookstore chain. Owner Tunde is on X as @alphabooks. They process card payments today and have complained about chargebacks."
      />

      <div className="mt-3">
        <p className="font-mono text-[10px] uppercase text-earn-gray-600">Channels (max 3)</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {(Object.keys(CHANNEL_LABELS) as OutreachChannel[]).map((c) => {
            const on = channels.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleChannel(c)}
                className={`font-mono text-[10px] uppercase px-2 py-1 border ${
                  on
                    ? 'border-earn-accent text-earn-accent bg-earn-accent-soft/40'
                    : 'border-earn-gray-300 text-earn-gray-700'
                }`}
              >
                {CHANNEL_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          type="button"
          className="btn-accent text-xs"
          onClick={submit}
          disabled={busy || lead.trim().length < 8}
        >
          {busy ? 'Drafting…' : 'Draft messages'}
        </button>
      </div>

      {kit && (
        <div className="mt-5 space-y-4">
          {kit.messages.map((m, i) => (
            <MessageCard key={i} channel={m.channel} subject={m.subject} body={m.body} />
          ))}
          {kit.research_hooks.length > 0 && (
            <div className="border border-earn-gray-200 p-3">
              <p className="font-mono text-[10px] uppercase text-earn-gray-700">
                Verify before sending
              </p>
              <ul className="text-xs list-disc pl-4 mt-1 space-y-0.5 break-words">
                {kit.research_hooks.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {kit.unknown_fields.length > 0 && (
            <div className="border border-amber-300 bg-amber-50/60 p-3">
              <p className="font-mono text-[10px] uppercase text-amber-800">
                Placeholders to fill
              </p>
              <ul className="text-xs list-disc pl-4 mt-1 space-y-0.5 break-words text-amber-900">
                {kit.unknown_fields.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageCard({
  channel,
  subject,
  body,
}: {
  channel: OutreachChannel;
  subject: string | null;
  body: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = subject ? `Subject: ${subject}\n\n${body}` : body;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="border border-earn-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase">{CHANNEL_LABELS[channel]}</span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[10px] uppercase text-earn-accent hover:underline"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      {subject && (
        <p className="text-xs font-bold mt-2 break-words">Subject: {subject}</p>
      )}
      <pre className="text-xs whitespace-pre-wrap break-words mt-1 font-sans">{body}</pre>
    </div>
  );
}
