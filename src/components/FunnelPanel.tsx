'use client';

import { useEffect, useState } from 'react';
import type { FunnelArtifact } from '@/lib/agents/funnel';

type Props = {
  bountyId: string;
  // 'vendor' shows the regenerate button; 'scout' is read-only.
  mode: 'vendor' | 'scout';
  onError?: (msg: string) => void;
};

type FetchState = {
  funnel: FunnelArtifact | null;
  runAt: string | null;
  loading: boolean;
};

export default function FunnelPanel({ bountyId, mode, onError }: Props) {
  const [state, setState] = useState<FetchState>({ funnel: null, runAt: null, loading: true });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bounties/${bountyId}/funnel`, { cache: 'no-store' });
        const j = (await res.json().catch(() => ({}))) as {
          funnel?: FunnelArtifact;
          runAt?: string;
        };
        if (cancelled) return;
        setState({ funnel: j.funnel ?? null, runAt: j.runAt ?? null, loading: false });
      } catch {
        if (!cancelled) setState({ funnel: null, runAt: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bountyId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/bounties/${bountyId}/funnel`, { method: 'POST' });
      if (res.status === 503) {
        onError?.('Funnel agent offline — set GROQ_API_KEY in .env.local');
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        onError?.(j.error ?? 'Funnel build failed');
        return;
      }
      const j = (await res.json()) as { funnel: FunnelArtifact };
      setState({ funnel: j.funnel, runAt: new Date().toISOString(), loading: false });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Funnel build failed');
    } finally {
      setGenerating(false);
    }
  };

  if (state.loading) {
    return (
      <div className="ink-panel p-6">
        <p className="font-mono text-[10px] uppercase text-earn-gray-600">Loading funnel…</p>
      </div>
    );
  }

  if (!state.funnel) {
    return (
      <div className="ink-panel p-6">
        <h2 className="font-eldritch text-xl font-bold">Funnel & Audience</h2>
        <p className="text-sm text-earn-gray-700 mt-2">
          {mode === 'vendor'
            ? 'No funnel yet. Generate one to give your scouts an ICP, channel plan, and message templates.'
            : 'The vendor has not published a funnel for this bounty yet.'}
        </p>
        {mode === 'vendor' && (
          <button
            type="button"
            className="btn-accent text-xs mt-4"
            disabled={generating}
            onClick={generate}
          >
            {generating ? 'Building…' : 'Generate funnel'}
          </button>
        )}
      </div>
    );
  }

  const f = state.funnel;
  return (
    <div className="ink-panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-eldritch text-xl font-bold">Funnel & Audience</h2>
          <p className="font-mono text-[10px] uppercase text-earn-gray-600">
            agent · funnel architect{state.runAt ? ` · ${timeAgo(state.runAt)}` : ''}
          </p>
        </div>
        {mode === 'vendor' && (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={generating}
            onClick={generate}
          >
            {generating ? 'Rebuilding…' : 'Rebuild'}
          </button>
        )}
      </div>
      <div className="rune-rule my-4" />

      <Section title="ICP">
        <p className="text-sm break-words">{f.icp.who}</p>
        <DefList label="Pains" items={f.icp.pains} />
        <DefList label="Buying signals" items={f.icp.buying_signals} />
        <DefList label="Deal breakers" items={f.icp.deal_breakers} />
      </Section>

      <Section title="Channels">
        <ul className="space-y-1">
          {f.channels.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border shrink-0 ${
                  c.fit === 'high'
                    ? 'border-emerald-400 text-emerald-800 bg-emerald-50'
                    : c.fit === 'medium'
                      ? 'border-amber-400 text-amber-800 bg-amber-50'
                      : 'border-earn-gray-300 text-earn-gray-700 bg-earn-gray-50'
                }`}
              >
                {c.fit}
              </span>
              <span className="break-words">
                <strong>{c.name}</strong> — {c.why}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Where to find leads">
        <ul className="space-y-1">
          {f.lead_sources.map((s, i) => (
            <li key={i} className="text-xs break-words">
              <span className="font-mono text-[9px] uppercase text-earn-gray-600 mr-2">
                {s.kind}
              </span>
              <strong>{s.label}</strong> — {s.where}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Outreach funnel">
        <ol className="space-y-3">
          {f.funnel.map((stage, i) => (
            <li key={i} className="border border-earn-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glyph-badge">#{i + 1}</span>
                <span className="font-mono text-[10px] uppercase">{stage.stage}</span>
                <span className="font-mono text-[10px] text-earn-gray-600">
                  via {stage.channel}
                </span>
              </div>
              <p className="font-mono text-[10px] text-earn-gray-600 mt-2">
                send when: {stage.send_when}
              </p>
              <pre className="text-xs whitespace-pre-wrap break-words mt-2 font-sans">
                {stage.message_template}
              </pre>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Objections & rebuttals">
        <ul className="space-y-2">
          {f.objections.map((o, i) => (
            <li key={i} className="text-xs break-words">
              <p>
                <strong>↳ {o.concern}</strong>
              </p>
              <p className="text-earn-gray-700">{o.rebuttal}</p>
            </li>
          ))}
        </ul>
      </Section>

      {f.do_not_say.length > 0 && (
        <Section title="Do not say">
          <ul className="text-xs list-disc pl-4 space-y-1 break-words">
            {f.do_not_say.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="mt-4 group">
      <summary className="cursor-pointer select-none font-mono text-[10px] uppercase text-earn-gray-700">
        {title}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function DefList({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2">
      <p className="font-mono text-[9px] uppercase text-earn-gray-600">{label}</p>
      <ul className="text-xs list-disc pl-4 space-y-0.5 break-words">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
