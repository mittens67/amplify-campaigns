import { z } from 'zod';
import { CATEGORIES, LIMITS, type Category } from '@amplify/domain';
import { env } from '../env.js';
import { ApiError } from '../lib/errors.js';

/**
 * AI drafting. Suggestions only — the app shows them as editable "✦ Suggested" fields and
 * never applies a funding goal. Uses Gemini (or Mistral) when an API key is set, with a
 * deterministic template fallback so the flow always works.
 */

export const interviewSchema = z.object({
  about: z.string().max(2000).default(''),
  audience: z.string().max(2000).default(''),
  why: z.string().max(2000).default(''),
  evidence: z.string().max(2000).default(''),
  action: z.string().max(2000).default(''),
  creatorName: z.string().max(80).optional(),
  sample: z.boolean().optional(),
});
export type Interview = z.infer<typeof interviewSchema>;

const draftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  headline: z.string(),
  intro: z.string(),
  paragraphs: z.array(z.object({ heading: z.string().optional(), text: z.string() })).max(6),
  stat: z.object({ value: z.string(), label: z.string() }).nullable().optional(),
  actions: z.array(z.string()).max(5),
  adHeadline: z.string(),
  adDescription: z.string(),
  cta: z.string(),
  interests: z.array(z.string()).max(6),
});
export type AiDraft = z.infer<typeof draftSchema>;

export interface DraftResult {
  draft: AiDraft;
  source: 'ai' | 'template' | 'sample';
}

export const SAMPLE_INTERVIEW: Interview = {
  about:
    'Heat safety for outdoor workers. Delivery riders, farm workers and construction crews are working through record heat this summer and most don’t know the warning signs of heat stroke.',
  audience: 'Outdoor workers and their employers in Arizona and Texas, plus families who can share the message.',
  why: 'Heat is the leading weather-related killer in the US and the deaths are preventable with water, rest and shade. Many workers feel they can’t take breaks.',
  evidence:
    'CDC heat-related illness guidance and OSHA’s heat injury prevention data. Arizona’s Maricopa County recorded over 600 heat deaths in 2023.',
  action: 'Learn the warning signs, take water rest shade breaks, and ask employers for a heat plan.',
  sample: true,
};

const SAMPLE_DRAFT: AiDraft = {
  title: 'Water, rest, shade: heat safety for outdoor workers',
  summary:
    'Record heat is putting outdoor workers at risk. Simple breaks for water, rest and shade prevent heat illness — if people know the signs.',
  category: 'Health',
  headline: 'The heat is rising. Knowing the signs saves lives.',
  intro:
    'Delivery riders, farm workers and construction crews are working through record temperatures this summer. Heat illness is preventable, but only if workers and employers recognise it early and treat breaks as part of the job.',
  paragraphs: [
    {
      heading: 'Why this matters now',
      text: 'Heat is the leading weather-related cause of death in the United States. Many outdoor workers feel they can’t stop to rest, so early symptoms like dizziness and confusion are pushed through until it is too late.',
    },
    {
      heading: 'What the evidence says',
      text: 'Public-health agencies agree on a simple rule: water, rest and shade. Acclimatising new workers over their first week and planning breaks on hot days dramatically reduces heat illness.',
    },
    {
      heading: 'Who we want to reach',
      text: 'Outdoor workers and their employers in Arizona and Texas, and the families who can pass the message on.',
    },
  ],
  stat: { value: '600+', label: 'heat-related deaths recorded in Maricopa County, Arizona in 2023' },
  actions: ['Learn the warning signs of heat stroke', 'Take water, rest and shade breaks', 'Ask your employer for a heat plan'],
  adHeadline: 'Heat illness is preventable',
  adDescription: 'Know the warning signs and take water, rest and shade breaks on hot days. Share it with someone who works outside.',
  cta: 'Learn the signs',
  interests: ['Construction', 'Agriculture', 'Delivery work', 'Workplace safety'],
};

const KEYWORDS: [Category, RegExp][] = [
  ['Environment', /climate|river|pollut|forest|ocean|wildlife|recycl|emission|environment|water quality|plastic/i],
  ['Health', /health|heat|disease|vaccin|mental|hospital|doctor|nutrition|cancer|illness|safety/i],
  ['Science', /science|research|study|space|data|physics|biology/i],
  ['Education', /school|student|teacher|literacy|education|learn|college|reading/i],
  ['Public Policy', /vote|election|policy|law|council|legislat|rights|civic|government/i],
  ['Economic Policy', /econom|tax|wage|inflation|housing|jobs|budget|cost of living/i],
  ['Community', /community|neighbou?r|local|volunteer|library|park/i],
  ['Arts & Culture', /art|music|culture|museum|film|theat|heritage/i],
  ['Business', /business|startup|shop|market|customer|product/i],
];

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).replace(/[,.;:]$/, '') + '…';
}

function firstSentence(s: string) {
  return (s.split(/(?<=[.!?])\s/)[0] ?? s).replace(/[.!?]$/, '');
}

function sentenceCase(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function templateDraft(i: Interview): AiDraft {
  const all = [i.about, i.why, i.evidence, i.audience].join(' ');
  const category = KEYWORDS.find(([, re]) => re.test(all))?.[0] ?? 'Other';
  const title = clip(sentenceCase(firstSentence(i.about) || 'A message worth sharing'), LIMITS.title);
  const stat = all.match(/(\d[\d,.]*\s?%?|\d+\s?(?:in|out of)\s?\d+)[^.]{0,80}/);
  return {
    title,
    summary: clip([firstSentence(i.about), firstSentence(i.why)].filter(Boolean).join('. ') + '.', LIMITS.summary),
    category,
    headline: title,
    intro: i.about.trim(),
    paragraphs: [
      i.why && { heading: 'Why it matters', text: i.why.trim() },
      i.evidence && { heading: 'What the evidence says', text: i.evidence.trim() },
      i.audience && { heading: 'Who this is for', text: i.audience.trim() },
    ].filter(Boolean) as AiDraft['paragraphs'],
    stat: stat ? { value: stat[1].trim(), label: clip(stat[0].slice(stat[1].length).trim(), 90) } : null,
    actions: i.action
      .split(/(?<=[.!?])\s|,\s(?:and\s)?|\sand\s/)
      .map((s) => sentenceCase(s.replace(/[.!?]$/, '').trim()))
      .filter((s) => s.length > 3)
      .slice(0, 3),
    adHeadline: clip(title, LIMITS.adHeadline),
    adDescription: clip(i.why || i.about, LIMITS.adDescription),
    cta: 'Learn more',
    interests: [],
  };
}

const SYSTEM_PROMPT = `You help people turn a spoken description into a clear, fair, well-sourced public-interest campaign.
Write in plain, calm, factual English. Do not invent statistics, sources or quotes: only use numbers the user gave.
Avoid sensational or divisive framing. Return ONLY JSON with exactly these keys:
{"title": string (max ${LIMITS.title} chars), "summary": string (max ${LIMITS.summary} chars), "category": one of ${JSON.stringify(CATEGORIES)},
"headline": string, "intro": string (2-3 sentences), "paragraphs": [{"heading": string, "text": string}] (2-4 items),
"stat": {"value": string, "label": string} or null (only from user's numbers), "actions": [string] (1-3 short imperative actions),
"adHeadline": string (max ${LIMITS.adHeadline} chars), "adDescription": string (max ${LIMITS.adDescription} chars), "cta": string (max ${LIMITS.cta} chars),
"interests": [string] (2-5 audience interests)}`;

/* ---------- Providers: Gemini (preferred) or Mistral, chosen by which key is set ---------- */

type Provider = 'gemini' | 'mistral' | null;
export function provider(): Provider {
  if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY) return 'gemini';
  if (env.AI_PROVIDER === 'mistral' && env.MISTRAL_API_KEY) return 'mistral';
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.MISTRAL_API_KEY) return 'mistral';
  return null;
}

async function timed<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

const userPrompt = (i: Interview) =>
  `What it's about: ${i.about}\nWho it should reach: ${i.audience}\nWhy it matters: ${i.why}\nEvidence: ${i.evidence}\nWhat people should do: ${i.action}`;

async function geminiGenerate(parts: unknown[], opts: { json?: boolean; system?: string }, signal: AbortSignal): Promise<string> {
  const body = JSON.stringify({
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.4, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
  });
  let lastError: Error = new Error('No Gemini models configured');
  for (const model of env.GEMINI_MODELS) {
    if (signal.aborted) break;
    // Each model gets a bounded slice of time so one slow model can't stall the request.
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body,
      });
      if (!res.ok) {
        lastError = new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        if ([404, 429, 500, 503].includes(res.status)) continue; // try the next model
        throw lastError;
      }
      const json = (await res.json()) as any;
      const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
      if (text) return text;
      lastError = new Error(`Gemini ${model} returned no text`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e;
      lastError = new Error(`Gemini ${model} timed out`);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }
  throw lastError;
}

async function mistralChat(i: Interview, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.MISTRAL_CHAT_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(i) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as any;
  return body.choices[0].message.content;
}

async function aiDraft(i: Interview): Promise<AiDraft> {
  const raw = await timed(25_000, (signal) =>
    provider() === 'gemini'
      ? geminiGenerate([{ text: userPrompt(i) }], { json: true, system: SYSTEM_PROMPT }, signal)
      : mistralChat(i, signal),
  );
  const parsed = draftSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')));
  // Enforce limits even if the model overshoots.
  return {
    ...parsed,
    title: clip(parsed.title, LIMITS.title),
    summary: clip(parsed.summary, LIMITS.summary),
    category: (CATEGORIES as readonly string[]).includes(parsed.category) ? parsed.category : 'Other',
    adHeadline: clip(parsed.adHeadline, LIMITS.adHeadline),
    adDescription: clip(parsed.adDescription, LIMITS.adDescription),
    cta: clip(parsed.cta, LIMITS.cta),
  };
}

export async function draftFromInterview(i: Interview): Promise<DraftResult> {
  if (i.sample) return { draft: SAMPLE_DRAFT, source: 'sample' };
  if (!provider()) return { draft: templateDraft(i), source: 'template' };
  try {
    return { draft: await aiDraft(i), source: 'ai' };
  } catch (e) {
    console.warn('[ai] falling back to template:', (e as Error).message);
    return { draft: templateDraft(i), source: 'template' };
  }
}

const TRANSCRIBE_FAILED = "We couldn't transcribe that. Try again or type your answer.";

export async function transcribe(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string> {
  const p = provider();
  if (!p) throw new ApiError(503, 'AI_UNAVAILABLE', 'Voice transcription is not configured. Type your answer instead.');
  try {
    return await timed(40_000, async (signal) => {
      if (p === 'gemini') {
        // Android/iOS recordings are AAC in an MP4 container (.m4a).
        const mime = !file.mimetype || /m4a|octet-stream/.test(file.mimetype) ? 'audio/mp4' : file.mimetype;
        const text = await geminiGenerate(
          [
            { inlineData: { mimeType: mime, data: file.buffer.toString('base64') } },
            { text: 'Transcribe this spoken answer verbatim in English. Return only the transcript text, with no commentary.' },
          ],
          {},
          signal,
        );
        return text.trim();
      }
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname || 'answer.m4a');
      form.append('model', env.MISTRAL_STT_MODEL);
      form.append('language', 'en');
      const res = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.MISTRAL_API_KEY}` },
        body: form,
        signal,
      });
      if (!res.ok) throw new Error(`Mistral STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as { text?: string };
      return (body.text ?? '').trim();
    });
  } catch (e) {
    console.warn('[ai] transcription failed:', (e as Error).message);
    throw new ApiError(502, 'AI_FAILED', TRANSCRIBE_FAILED);
  }
}

export const aiStatus = () => ({ voice: !!provider(), drafting: provider() ? 'ai' : 'template', provider: provider() });
