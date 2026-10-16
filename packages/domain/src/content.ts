import { z } from 'zod';
import { MAX_GOAL_CENTS, MIN_GOAL_CENTS } from './lifecycle';

export const CATEGORIES = [
  'Environment',
  'Health',
  'Science',
  'Education',
  'Public Policy',
  'Economic Policy',
  'Community',
  'Arts & Culture',
  'Business',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CREATOR_TYPES = [
  { key: 'individual', label: 'Individual' },
  { key: 'influencer', label: 'Creator' },
  { key: 'nonprofit', label: 'Nonprofit' },
  { key: 'organization', label: 'Organization' },
  { key: 'business', label: 'Business' },
  { key: 'community', label: 'Community group' },
] as const;
export type CreatorType = (typeof CREATOR_TYPES)[number]['key'];

export const CHANNELS = [
  { key: 'meta', label: 'Facebook & Instagram', placements: ['Feed', 'Stories'] },
  { key: 'youtube', label: 'YouTube', placements: ['In-stream', 'Shorts'] },
  { key: 'search', label: 'Search ads', placements: ['Search results'] },
  { key: 'news', label: 'News sites', placements: ['Display'] },
] as const;
export type ChannelKey = (typeof CHANNELS)[number]['key'];

export const LIMITS = {
  title: 60,
  headlinePreview: 40,
  summary: 160,
  adHeadline: 40,
  adDescription: 125,
  cta: 20,
  imageMaxBytes: 8 * 1024 * 1024,
  imageMinWidth: 600,
  videoMaxSeconds: 60,
} as const;

/* ---------------- Building blocks ---------------- */

export const assetSchema = z.object({
  url: z.string().min(1),
  kind: z.enum(['image', 'video']).default('image'),
  width: z.number().optional(),
  height: z.number().optional(),
  generated: z.boolean().optional(),
});
export type Asset = z.infer<typeof assetSchema>;

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, 'Add a source title'),
  url: z.url({ message: 'Enter a valid link (https://…)' }),
  publisher: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'stat', 'quote'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(BLOCK_TYPES),
  text: z.string().optional(),
  image: assetSchema.optional(),
  caption: z.string().optional(),
  credit: z.string().optional(),
  value: z.string().optional(), // stat value e.g. "1 in 4"
  attribution: z.string().optional(), // quote attribution
  sourceIds: z.array(z.string()).optional(),
});
export type Block = z.infer<typeof blockSchema>;

/* ---------------- Campaign content (the draft document) ---------------- */

export const contentSchema = z.object({
  basics: z
    .object({
      title: z.string().default(''),
      category: z.enum(CATEGORIES).optional(),
      creatorName: z.string().default(''),
      creatorType: z.enum(CREATOR_TYPES.map((c) => c.key) as [CreatorType, ...CreatorType[]]).optional(),
      summary: z.string().default(''),
      cover: assetSchema.optional(),
      prompts: z
        .object({
          about: z.string().default(''),
          audience: z.string().default(''),
          why: z.string().default(''),
          evidence: z.string().default(''),
        })
        .prefault({}),
    })
    .prefault({}),
  story: z
    .object({
      headline: z.string().default(''),
      intro: z.string().default(''),
      blocks: z.array(blockSchema).default([]),
      sources: z
        .array(z.object({ id: z.string(), title: z.string().default(''), url: z.string().default(''), publisher: z.string().optional() }))
        .default([]),
      actions: z.array(z.string()).default([]),
    })
    .prefault({}),
  visuals: z
    .object({
      adImages: z.array(assetSchema).default([]),
      video: assetSchema.optional(),
      adHeadline: z.string().default(''),
      adDescription: z.string().default(''),
      cta: z.string().default('Learn more'),
    })
    .prefault({}),
  reach: z
    .object({
      locations: z.array(z.string()).default([]),
      ageMin: z.number().default(18),
      ageMax: z.number().default(65),
      interests: z.array(z.string()).default([]),
      channels: z.array(z.enum(CHANNELS.map((c) => c.key) as [ChannelKey, ...ChannelKey[]])).default([]),
      split: z.record(z.string(), z.number()).default({}),
      durationDays: z.number().default(30),
    })
    .prefault({}),
  submit: z
    .object({
      goalCents: z.number().int().optional(),
      acceptedRules: z.boolean().default(false),
      acceptedFunding: z.boolean().default(false),
    })
    .prefault({}),
  /** Field paths that were filled by AI and not yet reviewed by the creator. */
  aiSuggested: z.array(z.string()).default([]),
});
export type CampaignContent = z.infer<typeof contentSchema>;

export function emptyContent(): CampaignContent {
  return contentSchema.parse({});
}

/** Normalise any partial/legacy content into a full document. */
export function normalizeContent(input: unknown): CampaignContent {
  const r = contentSchema.safeParse(input ?? {});
  if (r.success) return r.data;
  // Never lose a whole draft because one section is malformed: keep the sections that parse.
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const shape = contentSchema.shape;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const section = shape[key].safeParse(raw[key]);
    out[key] = section.success ? section.data : shape[key].parse(undefined);
  }
  return out as CampaignContent;
}

/* ---------------- Step validation ---------------- */

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'story', label: 'Story' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'reach', label: 'Reach' },
  { key: 'submit', label: 'Submit' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

export type FieldErrors = Record<string, string>;

const isUrl = (s: string | undefined) => !!s && /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s.trim());

export function validateStep(step: StepKey, c: CampaignContent): FieldErrors {
  const e: FieldErrors = {};
  if (step === 'basics') {
    const t = c.basics.title.trim();
    if (!t) e['basics.title'] = 'Give your campaign a title';
    else if (t.length > LIMITS.title) e['basics.title'] = `Keep it under ${LIMITS.title} characters`;
    if (!c.basics.category) e['basics.category'] = 'Choose a category';
    if (!c.basics.creatorName.trim()) e['basics.creatorName'] = 'Add your name or organization';
    if (!c.basics.creatorType) e['basics.creatorType'] = 'Tell backers who is behind this';
    if (c.basics.summary.length > LIMITS.summary) e['basics.summary'] = `Keep it under ${LIMITS.summary} characters`;
  }
  if (step === 'story') {
    const textBlocks = c.story.blocks.filter((b) => b.type === 'paragraph' && (b.text ?? '').trim().length > 0);
    if (!c.story.intro.trim() && textBlocks.length === 0) e['story.intro'] = 'Write an introduction or at least one paragraph';
    c.story.sources.forEach((s, i) => {
      if (!s.title?.trim()) e[`story.sources.${i}.title`] = 'Add a source title';
      if (!isUrl(s.url)) e[`story.sources.${i}.url`] = 'Enter a valid link (https://…)';
    });
    if (c.story.sources.length === 0) e['story.sources'] = 'Add at least one supporting source';
    c.story.blocks.forEach((b, i) => {
      if (b.type === 'image' && !b.image) e[`story.blocks.${i}.image`] = 'Choose an image or remove this section';
      if (b.type === 'stat' && !(b.value ?? '').trim()) e[`story.blocks.${i}.value`] = 'Add the statistic';
    });
  }
  if (step === 'visuals') {
    if (!c.basics.cover) e['basics.cover'] = 'Add a cover image';
    if (c.visuals.adImages.length === 0) e['visuals.adImages'] = 'Add or generate at least one ad image';
    if (c.visuals.adHeadline.length > LIMITS.adHeadline) e['visuals.adHeadline'] = `Max ${LIMITS.adHeadline} characters`;
    if (c.visuals.adDescription.length > LIMITS.adDescription)
      e['visuals.adDescription'] = `Max ${LIMITS.adDescription} characters`;
    if (!c.visuals.cta.trim()) e['visuals.cta'] = 'Add a call to action';
  }
  if (step === 'reach') {
    if (c.reach.locations.length === 0) e['reach.locations'] = 'Choose at least one location';
    if (c.reach.channels.length === 0) e['reach.channels'] = 'Choose at least one channel';
    const total = c.reach.channels.reduce((s, k) => s + (c.reach.split[k] ?? 0), 0);
    if (c.reach.channels.length > 0 && total !== 100) e['reach.split'] = `Budget split must total 100% (now ${total}%)`;
    if (c.reach.durationDays < 7 || c.reach.durationDays > 90) e['reach.durationDays'] = 'Choose 7–90 days';
  }
  if (step === 'submit') {
    const g = c.submit.goalCents;
    if (!g) e['submit.goalCents'] = 'Set a funding goal';
    else if (g < MIN_GOAL_CENTS) e['submit.goalCents'] = 'Minimum goal is $100';
    else if (g > MAX_GOAL_CENTS) e['submit.goalCents'] = 'Maximum goal is $100,000';
    if (!c.submit.acceptedRules) e['submit.acceptedRules'] = 'Please confirm the campaign rules';
    if (!c.submit.acceptedFunding) e['submit.acceptedFunding'] = 'Please confirm the funding policy';
  }
  return e;
}

export function validateAll(c: CampaignContent): FieldErrors {
  return STEPS.reduce<FieldErrors>((acc, s) => ({ ...acc, ...validateStep(s.key, c) }), {});
}

export function stepOfField(path: string): StepKey {
  if (path === 'basics.cover') return 'visuals';
  return (path.split('.')[0] as StepKey) ?? 'basics';
}

/** Human-friendly step completeness for the "Continue a draft" list. */
export function completedSteps(c: CampaignContent): StepKey[] {
  return STEPS.filter((s) => Object.keys(validateStep(s.key, c)).length === 0).map((s) => s.key);
}

/** The ad headline actually used: custom headline, else the start of the title. */
export function effectiveAdHeadline(c: CampaignContent): string {
  const h = c.visuals.adHeadline.trim();
  if (h) return h;
  const t = c.basics.title.trim();
  return t.length > LIMITS.headlinePreview ? t.slice(0, LIMITS.headlinePreview - 1).trimEnd() + '…' : t;
}

/* ---------------- Contributions ---------------- */

export const PAYMENT_OUTCOMES = ['succeed', 'decline', 'verify', 'cancel'] as const;
export type PaymentOutcome = (typeof PAYMENT_OUTCOMES)[number];

export const CONTRIBUTION_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'voided',
  'refund_pending',
  'refunded',
] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export const contributionRequestSchema = z.object({
  campaignId: z.string().uuid(),
  amountCents: z.number().int().min(100, 'Minimum is $1').max(1_000_000, 'Maximum is $10,000'),
  showName: z.boolean().default(false),
  publicName: z.string().trim().max(40).optional(),
  email: z.email().optional().or(z.literal('').transform(() => undefined)),
  outcome: z.enum(PAYMENT_OUTCOMES).default('succeed'),
});
export type ContributionRequest = z.infer<typeof contributionRequestSchema>;

/* ---------------- Review ---------------- */

export const REVIEW_LAYERS = [
  {
    key: 'fact_check',
    label: 'Fact-Check',
    question: 'Are claims accurate, verifiable and traceable to the cited sources?',
  },
  {
    key: 'integrity',
    label: 'Communication Integrity',
    question: 'Is the framing fair and free of manipulation or misleading emphasis?',
  },
  {
    key: 'shared_reality',
    label: 'Shared Reality',
    question: 'Does it invite people with different views to engage, rather than deepen division?',
  },
] as const;
export type ReviewLayerKey = (typeof REVIEW_LAYERS)[number]['key'];
export const REVIEW_OUTCOMES = ['pass', 'concern', 'fail'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const reviewDecisionSchema = z.object({
  layers: z
    .array(
      z.object({
        layer: z.enum(REVIEW_LAYERS.map((l) => l.key) as [ReviewLayerKey, ...ReviewLayerKey[]]),
        outcome: z.enum(REVIEW_OUTCOMES),
        notes: z.string().max(500).default(''),
      }),
    )
    .default([]),
  decision: z.enum(['approve', 'request_changes', 'reject']),
  message: z.string().max(1000).default(''),
  fieldNotes: z.record(z.string(), z.string().max(300)).default({}),
});
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
