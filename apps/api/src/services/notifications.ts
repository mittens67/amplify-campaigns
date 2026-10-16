import type { NotificationDTO, NotificationType } from '@amplify/domain';
import type { Queryable } from '../db/index.js';
import { newId } from '../lib/auth.js';
import { clock, iso } from '../lib/clock.js';

export const NOTIFICATION_CATEGORIES = [
  { key: 'review', label: 'Review decisions', description: 'Submission received, approved, changes requested' },
  { key: 'funding', label: 'Funding & payments', description: 'Contributions, milestones, deadlines, refunds' },
  { key: 'distribution', label: 'Distribution & reports', description: 'Promotion started, progress, final reports' },
  { key: 'updates', label: 'Campaign updates', description: 'Updates posted by creators you follow' },
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]['key'] | 'account';

const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  submission_received: 'review',
  approved: 'review',
  changes_requested: 'review',
  rejected: 'review',
  funding_open: 'funding',
  milestone: 'funding',
  deadline: 'funding',
  contribution_succeeded: 'funding',
  contribution_failed: 'funding',
  goal_reached: 'funding',
  funding_ended: 'funding',
  refund: 'funding',
  promotion_started: 'distribution',
  distribution_progress: 'distribution',
  completed: 'distribution',
  report_ready: 'distribution',
  update: 'updates',
  security: 'account',
};

export interface NewNotification {
  type: NotificationType;
  audience: 'creator' | 'backer' | 'account';
  campaignId?: string | null;
  title: string;
  body: string;
  /** Unique per recipient: repeated events with the same key are dropped (no duplicate spam). */
  dedupeKey: string;
}

export async function notify(q: Queryable, recipients: (string | null | undefined)[], n: NewNotification) {
  const keys = [...new Set(recipients.filter((k): k is string => !!k))];
  if (keys.length === 0) return;
  const category = CATEGORY_OF[n.type];
  let muted = new Set<string>();
  if (category !== 'account') {
    const rows = await q.query<{ owner_key: string }>(
      'SELECT owner_key FROM notification_prefs WHERE category = $1 AND enabled = false AND owner_key = ANY($2::text[])',
      [category, keys],
    );
    muted = new Set(rows.map((r) => r.owner_key));
  }
  const targets = keys.filter((k) => !muted.has(k));
  if (targets.length === 0) return;
  // One statement for every recipient (fan-out to hundreds of backers stays a single round-trip).
  await q.query(
    `INSERT INTO notifications (id, owner_key, type, audience, campaign_id, title, body, dedupe_key, at)
     SELECT gen_random_uuid(), k, $2, $3, $4, $5, $6, $7, $8 FROM unnest($1::text[]) AS k
     ON CONFLICT (owner_key, dedupe_key) DO NOTHING`,
    [targets, n.type, n.audience, n.campaignId ?? null, n.title, n.body, n.dedupeKey, clock.now()],
  );
}

/** Everyone who should hear about a campaign as a supporter: backers + followers (minus the creator). */
export async function supporterKeys(q: Queryable, campaignId: string, excludeKey?: string): Promise<string[]> {
  const rows = await q.query<{ owner_key: string }>(
    `SELECT DISTINCT owner_key FROM contributions WHERE campaign_id = $1 AND status IN ('succeeded','refund_pending','refunded')
     UNION SELECT owner_key FROM follows WHERE campaign_id = $1`,
    [campaignId],
  );
  return rows.map((r) => r.owner_key).filter((k) => k !== excludeKey);
}

export async function listNotifications(q: Queryable, ownerKey: string): Promise<NotificationDTO[]> {
  const rows = await q.query(
    `SELECT n.*, c.draft_content->'basics'->>'title' AS draft_title, c.published_content->'basics'->>'title' AS pub_title,
            COALESCE(c.published_content->'basics'->'cover'->>'url', c.draft_content->'basics'->'cover'->>'url') AS cover
       FROM notifications n LEFT JOIN campaigns c ON c.id = n.campaign_id
      WHERE n.owner_key = $1 ORDER BY n.at DESC LIMIT 200`,
    [ownerKey],
  );
  return rows.map((r: any) => ({
    id: r.id,
    type: r.type,
    group: CATEGORY_OF[r.type as NotificationType] === 'account' ? 'account' : r.audience === 'creator' ? 'campaigns' : 'backing',
    title: r.title,
    body: r.body,
    campaignId: r.campaign_id,
    campaignTitle: r.pub_title ?? r.draft_title ?? null,
    campaignCoverUrl: r.cover ?? null,
    read: !!r.read_at,
    at: iso(r.at)!,
    audience: r.audience,
  }));
}

export async function getPrefs(q: Queryable, ownerKey: string) {
  const rows = await q.query<{ category: string; enabled: boolean }>(
    'SELECT category, enabled FROM notification_prefs WHERE owner_key = $1',
    [ownerKey],
  );
  const map = new Map(rows.map((r) => [r.category, r.enabled]));
  return NOTIFICATION_CATEGORIES.map((c) => ({ ...c, enabled: map.get(c.key) ?? true }));
}

export async function setPref(q: Queryable, ownerKey: string, category: string, enabled: boolean) {
  await q.query(
    `INSERT INTO notification_prefs (owner_key, category, enabled) VALUES ($1,$2,$3)
     ON CONFLICT (owner_key, category) DO UPDATE SET enabled = EXCLUDED.enabled`,
    [ownerKey, category, enabled],
  );
}
