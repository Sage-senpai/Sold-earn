// Thin Groq client wrapper. Only used for adjudication where deterministic
// heuristics are insufficient. Always asks for JSON, parses safely, retries
// once on parse failure. If the key isn't set, returns null and the caller
// falls back to "human_review" with no LLM input.

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
// llama-3.3-70b-versatile is Groq's most reliable JSON-mode model. Override
// via env if Groq ships something better.
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

export const isGroqEnabled = !!GROQ_API_KEY;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatOpts = {
  messages: ChatMessage[];
  // Asking the model to emit JSON. We additionally validate shape outside.
  jsonOnly?: boolean;
  temperature?: number;
  maxTokens?: number;
};

type ChatResult = { text: string; model: string } | null;

async function chatRaw(opts: ChatOpts): Promise<ChatResult> {
  if (!GROQ_API_KEY) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 512,
      response_format: opts.jsonOnly ? { type: 'json_object' } : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`groq ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return { text, model: GROQ_MODEL };
}

export async function chatJson<T>(
  opts: ChatOpts,
  validate: (raw: unknown) => T | null,
): Promise<{ value: T; model: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chatRaw({ ...opts, jsonOnly: true });
    if (!r) return null;
    try {
      const parsed = JSON.parse(r.text);
      const value = validate(parsed);
      if (value) return { value, model: r.model };
    } catch {
      // fall through to retry
    }
  }
  return null;
}
