import { adBudget } from './money';

/**
 * Campaign lifecycle — one definition shared by the API (authoritative) and the app
 * (Journey Rail, which actions to show).
 *
 * Draft → Submitted → Changes Requested | Approved → Available for Funding →
 * Goal Reached | Funding Ended → Distribution Preparation → Promoting → Completed
 * Exceptional: Rejected, Cancelled, Failed, Refund Pending → Refunded.
 *
 * Reaching the funding goal never launches advertising by itself: launch needs a reviewer
 * action with ad setup confirmed.
 */

export const CAMPAIGN_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'available_for_funding',
  'goal_reached',
  'funding_ended',
  'distribution_preparation',
  'promoting',
  'completed',
  'rejected',
  'cancelled',
  'failed',
  'refund_pending',
  'refunded',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type Actor = 'creator' | 'reviewer' | 'system';

export type CampaignEvent =
  | 'submit'
  | 'request_changes'
  | 'resubmit'
  | 'approve'
  | 'reject'
  | 'open_funding'
  | 'goal_reached'
  | 'period_ended'
  | 'funding_failed'
  | 'prepare'
  | 'launch'
  | 'complete'
  | 'cancel'
  | 'halt'
  | 'refund_complete';

/** Minimum advertising budget needed for a campaign to run when its period ends below goal. */
export const MIN_AD_BUDGET_CENTS = 10_000; // $100
export const MIN_GOAL_CENTS = 10_000; // $100
export const MAX_GOAL_CENTS = 10_000_000; // $100k
/** How long a campaign stays open for backing after approval. */
export const FUNDING_WINDOW_DAYS = 21;
/** "Deadline approaching" notifications fire this many days before funding closes. */
export const DEADLINE_WARNING_DAYS = 2;

export interface TransitionContext {
  raisedCents: number;
  goalCents: number;
  /** Reviewer confirmed creative + targeting are set up with the ad partner. */
  adSetupConfirmed?: boolean;
  /** All three review layers recorded. */
  reviewComplete?: boolean;
  /** Content passes full submission validation. */
  contentValid?: boolean;
}

interface TransitionDef {
  from: CampaignStatus[];
  to: CampaignStatus;
  actors: Actor[];
  guard?: (ctx: TransitionContext) => string | null; // returns a reason when blocked
}

export const TRANSITIONS: Record<CampaignEvent, TransitionDef> = {
  submit: {
    from: ['draft'],
    to: 'submitted',
    actors: ['creator'],
    guard: (c) => (c.contentValid === false ? 'Campaign is incomplete' : null),
  },
  request_changes: { from: ['submitted'], to: 'changes_requested', actors: ['reviewer'] },
  resubmit: {
    from: ['changes_requested'],
    to: 'submitted',
    actors: ['creator'],
    guard: (c) => (c.contentValid === false ? 'Campaign is incomplete' : null),
  },
  approve: {
    from: ['submitted'],
    to: 'approved',
    actors: ['reviewer'],
    guard: (c) => (c.reviewComplete === false ? 'Record all three review layers before approving' : null),
  },
  reject: { from: ['submitted'], to: 'rejected', actors: ['reviewer'] },
  open_funding: { from: ['approved'], to: 'available_for_funding', actors: ['system', 'reviewer'] },
  goal_reached: {
    from: ['available_for_funding'],
    to: 'goal_reached',
    actors: ['system'],
    guard: (c) => (c.raisedCents < c.goalCents ? 'Goal not reached' : null),
  },
  period_ended: {
    from: ['available_for_funding'],
    to: 'funding_ended',
    actors: ['system'],
    guard: (c) => (adBudget(c.raisedCents) < MIN_AD_BUDGET_CENTS ? 'Below minimum ad budget' : null),
  },
  funding_failed: {
    from: ['available_for_funding'],
    to: 'failed',
    actors: ['system'],
    guard: (c) => (adBudget(c.raisedCents) >= MIN_AD_BUDGET_CENTS ? 'Minimum ad budget met' : null),
  },
  prepare: { from: ['goal_reached', 'funding_ended'], to: 'distribution_preparation', actors: ['reviewer'] },
  launch: {
    from: ['distribution_preparation'],
    to: 'promoting',
    actors: ['reviewer'],
    guard: (c) => (!c.adSetupConfirmed ? 'Confirm ad setup before launching' : null),
  },
  complete: { from: ['promoting'], to: 'completed', actors: ['reviewer', 'system'] },
  cancel: { from: ['draft', 'submitted', 'changes_requested'], to: 'cancelled', actors: ['creator'] },
  halt: {
    from: ['available_for_funding', 'goal_reached', 'funding_ended', 'distribution_preparation', 'failed'],
    to: 'refund_pending',
    actors: ['reviewer', 'system'],
  },
  refund_complete: { from: ['refund_pending'], to: 'refunded', actors: ['system', 'reviewer'] },
};

export type TransitionResult =
  | { ok: true; to: CampaignStatus }
  | { ok: false; code: 'INVALID_STATE' | 'FORBIDDEN' | 'GUARD'; reason: string };

export function canTransition(
  from: CampaignStatus,
  event: CampaignEvent,
  actor: Actor,
  ctx: TransitionContext,
): TransitionResult {
  const def = TRANSITIONS[event];
  if (!def) return { ok: false, code: 'INVALID_STATE', reason: `Unknown event ${event}` };
  if (!def.from.includes(from)) {
    return { ok: false, code: 'INVALID_STATE', reason: `Cannot ${event} a campaign that is ${STATUS_LABEL[from]}` };
  }
  if (!def.actors.includes(actor)) {
    return { ok: false, code: 'FORBIDDEN', reason: `${actor} cannot ${event}` };
  }
  const blocked = def.guard?.(ctx);
  if (blocked) return { ok: false, code: 'GUARD', reason: blocked };
  return { ok: true, to: def.to };
}

export function availableEvents(from: CampaignStatus, actor: Actor): CampaignEvent[] {
  return (Object.keys(TRANSITIONS) as CampaignEvent[]).filter(
    (e) => TRANSITIONS[e].from.includes(from) && TRANSITIONS[e].actors.includes(actor),
  );
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  submitted: 'Under review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  available_for_funding: 'Funding',
  goal_reached: 'Goal reached',
  funding_ended: 'Funding ended',
  distribution_preparation: 'Preparing distribution',
  promoting: 'Promoting',
  completed: 'Completed',
  rejected: 'Not approved',
  cancelled: 'Cancelled',
  failed: 'Did not reach minimum',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};

export type StatusTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger';

export const STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  changes_requested: 'warning',
  approved: 'info',
  available_for_funding: 'accent',
  goal_reached: 'success',
  funding_ended: 'info',
  distribution_preparation: 'info',
  promoting: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  failed: 'danger',
  refund_pending: 'warning',
  refunded: 'neutral',
};

/** Statuses visible to the public (audience can browse). */
export const PUBLIC_STATUSES: CampaignStatus[] = [
  'available_for_funding',
  'goal_reached',
  'funding_ended',
  'distribution_preparation',
  'promoting',
  'completed',
];

export const BACKABLE_STATUSES: CampaignStatus[] = ['available_for_funding'];

/* ---------------- Journey Rail ---------------- */

export const JOURNEY_STAGES = [
  { key: 'review', label: 'Review', blurb: 'Reviewers check the story, sources and ad creative.' },
  { key: 'funding', label: 'Funding', blurb: 'Backers pool contributions toward distribution.' },
  { key: 'preparing', label: 'Preparing', blurb: 'The team finalises targeting and ad setup.' },
  { key: 'promoting', label: 'Promoting', blurb: 'Ads run and show the message to new audiences.' },
  { key: 'completed', label: 'Completed', blurb: 'Final report with spend and measured reach.' },
] as const;
export type JourneyStageKey = (typeof JOURNEY_STAGES)[number]['key'];

export interface JourneyPosition {
  /** Index of the current stage (0..4); -1 for draft. */
  index: number;
  /** Whether the current stage is finished (e.g. completed). */
  done: boolean;
  /** An off-path state shown as a branch badge. */
  branch?: { label: string; tone: StatusTone };
}

export function journeyPosition(status: CampaignStatus): JourneyPosition {
  switch (status) {
    case 'draft':
      return { index: -1, done: false };
    case 'submitted':
    case 'approved':
      return { index: 0, done: false };
    case 'changes_requested':
      return { index: 0, done: false, branch: { label: 'Changes requested', tone: 'warning' } };
    case 'rejected':
      return { index: 0, done: false, branch: { label: 'Not approved', tone: 'danger' } };
    case 'cancelled':
      return { index: 0, done: false, branch: { label: 'Cancelled', tone: 'neutral' } };
    case 'available_for_funding':
      return { index: 1, done: false };
    case 'failed':
      return { index: 1, done: false, branch: { label: 'Below minimum', tone: 'danger' } };
    case 'refund_pending':
      return { index: 1, done: false, branch: { label: 'Refund pending', tone: 'warning' } };
    case 'refunded':
      return { index: 1, done: false, branch: { label: 'Refunded', tone: 'neutral' } };
    case 'goal_reached':
    case 'funding_ended':
    case 'distribution_preparation':
      return { index: 2, done: false };
    case 'promoting':
      return { index: 3, done: false };
    case 'completed':
      return { index: 4, done: true };
  }
}

/** One-line "what happens next" for the current status, used in cards and banners. */
export function nextStepCopy(status: CampaignStatus): string {
  switch (status) {
    case 'draft':
      return 'Finish and submit for review';
    case 'submitted':
      return 'Reviewers typically respond in 2–3 days';
    case 'changes_requested':
      return 'Update the flagged items and resubmit';
    case 'approved':
      return 'Opening for funding';
    case 'available_for_funding':
      return 'Backers are funding distribution';
    case 'goal_reached':
      return 'Goal reached — ad setup comes next';
    case 'funding_ended':
      return 'Funding closed — ad setup comes next';
    case 'distribution_preparation':
      return 'Finalising targeting and ad setup';
    case 'promoting':
      return 'Ads are running';
    case 'completed':
      return 'Final report available';
    case 'rejected':
      return 'This campaign was not approved';
    case 'cancelled':
      return 'Cancelled by the creator';
    case 'failed':
      return 'Did not reach the minimum ad budget';
    case 'refund_pending':
      return 'Unspent funds are being refunded';
    case 'refunded':
      return 'Unspent funds were refunded';
  }
}
