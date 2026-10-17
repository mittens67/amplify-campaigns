import {
  canTransition,
  normalizeContent,
  validateAll,
  CURRENT_REACH_MODEL,
  FUNDING_WINDOW_DAYS,
  REVIEW_LAYERS,
  STATUS_LABEL,
  type Actor,
  type CampaignEvent,
  type CampaignStatus,
} from '@amplify/domain';
import type { Queryable } from '../db/index.js';
import { newId } from '../lib/auth.js';
import { addDays, clock } from '../lib/clock.js';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { notify, supporterKeys } from './notifications.js';

export interface ActorRef {
  role: Actor;
  key?: string | null;
}

export function campaignTitle(row: any): string {
  return row.published_content?.basics?.title || row.draft_content?.basics?.title || 'Untitled campaign';
}

async function lock(q: Queryable, id: string) {
  const [row] = await q.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [id]);
  if (!row) throw notFound('Campaign');
  return row;
}

async function reviewComplete(q: Queryable, campaignId: string): Promise<boolean> {
  const rows = await q.query<{ layer: string; outcome: string }>(
    `SELECT layer, outcome FROM reviews WHERE campaign_id = $1
       AND round = (SELECT COALESCE(MAX(round), 0) FROM reviews WHERE campaign_id = $1)`,
    [campaignId],
  );
  const layers = new Set(rows.map((r) => r.layer));
  return REVIEW_LAYERS.every((l) => layers.has(l.key)) && rows.every((r) => r.outcome !== 'fail');
}

/**
 * Apply one lifecycle event to a campaign inside the caller's transaction:
 * row lock → guard check against the shared state machine → state write → audit event → notifications.
 * Chained system events (approve → open funding, failed → refund) are applied in the same transaction.
 */
export async function transitionCampaign(
  q: Queryable,
  campaignId: string,
  event: CampaignEvent,
  actor: ActorRef,
  opts: { note?: string | null } = {},
): Promise<any> {
  const row = await lock(q, campaignId);
  const from = row.status as CampaignStatus;

  if (actor.role === 'creator' && actor.key !== row.creator_key) throw forbidden('Only the creator can do that');

  const ctx = {
    raisedCents: row.raised_cents,
    goalCents: row.goal_cents,
    adSetupConfirmed: row.ad_setup_confirmed,
    reviewComplete: event === 'approve' ? await reviewComplete(q, campaignId) : undefined,
    contentValid:
      event === 'submit' || event === 'resubmit'
        ? Object.keys(validateAll(normalizeContent(row.draft_content))).length === 0
        : undefined,
  };
  const check = canTransition(from, event, actor.role, ctx);
  if (!check.ok) {
    if (check.code === 'FORBIDDEN') throw forbidden(check.reason);
    if (check.code === 'GUARD') throw new ApiError(422, 'GUARD', check.reason);
    throw conflict('INVALID_STATE', check.reason);
  }
  const to = check.to;
  const now = clock.now();
  const title = campaignTitle(row);

  const sets: string[] = ['status = $2', 'status_changed_at = $3', 'updated_at = $3'];
  const params: unknown[] = [campaignId, to, now];
  const set = (col: string, value: unknown, cast = '') => {
    params.push(value);
    sets.push(`${col} = $${params.length}${cast}`);
  };

  switch (event) {
    case 'submit':
    case 'resubmit': {
      const content = normalizeContent(row.draft_content);
      set('submitted_at', now);
      set('goal_cents', content.submit.goalCents ?? 0);
      break;
    }
    case 'approve':
      set('published_content', JSON.stringify(row.draft_content), '::text::jsonb');
      set('reach_model_version', CURRENT_REACH_MODEL.version);
      set('reviewer_notes', '{}', '::text::jsonb');
      break;
    case 'open_funding':
      set('published_at', now);
      set('funding_ends_at', addDays(now, FUNDING_WINDOW_DAYS));
      break;
    case 'launch':
      set('launched_at', now);
      break;
    case 'complete':
      set('completed_at', now);
      break;
  }
  const [updated] = await q.query(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);

  await q.query(
    `INSERT INTO campaign_events (id, campaign_id, event, from_status, to_status, actor_key, actor_role, note, at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [newId(), campaignId, event, from, to, actor.key ?? null, actor.role, opts.note ?? null, now],
  );

  await sideEffects(q, updated, event, title);

  // Chained system events.
  if (event === 'approve') return transitionCampaign(q, campaignId, 'open_funding', { role: 'system' });
  if (event === 'funding_failed') return transitionCampaign(q, campaignId, 'halt', { role: 'system' }, { note: 'Below minimum ad budget' });
  return updated;
}

async function sideEffects(q: Queryable, c: any, event: CampaignEvent, title: string) {
  const creator = c.creator_key as string;
  const id = c.id as string;
  const dk = (s: string) => `${id}:${s}`;
  switch (event) {
    case 'submit':
    case 'resubmit':
      await notify(q, [creator], {
        type: 'submission_received',
        audience: 'creator',
        campaignId: id,
        title: 'Submitted for review',
        body: `“${title}” is with our reviewers. Most reviews take 2–3 days.`,
        dedupeKey: dk(`submitted:${c.submitted_at?.toISOString?.() ?? Date.now()}`),
      });
      break;
    case 'request_changes':
      await notify(q, [creator], {
        type: 'changes_requested',
        audience: 'creator',
        campaignId: id,
        title: 'Changes requested',
        body: `Reviewers left notes on “${title}”. Update the flagged items and resubmit.`,
        dedupeKey: dk(`changes:${Date.now()}`),
      });
      break;
    case 'reject':
      await notify(q, [creator], {
        type: 'rejected',
        audience: 'creator',
        campaignId: id,
        title: 'Campaign not approved',
        body: `“${title}” wasn't approved. See the reviewer's explanation.`,
        dedupeKey: dk('rejected'),
      });
      break;
    case 'approve':
      await notify(q, [creator], {
        type: 'approved',
        audience: 'creator',
        campaignId: id,
        title: 'Approved',
        body: `“${title}” passed review.`,
        dedupeKey: dk('approved'),
      });
      break;
    case 'open_funding':
      await notify(q, [creator], {
        type: 'funding_open',
        audience: 'creator',
        campaignId: id,
        title: 'Now open for backing',
        body: `“${title}” is live. Share it so backers can fund its reach.`,
        dedupeKey: dk('funding_open'),
      });
      break;
    case 'goal_reached': {
      const supporters = await supporterKeys(q, id, creator);
      await notify(q, [creator], {
        type: 'goal_reached',
        audience: 'creator',
        campaignId: id,
        title: 'Funding goal reached',
        body: `“${title}” is fully funded. Our team will now prepare distribution.`,
        dedupeKey: dk('goal_reached'),
      });
      await notify(q, supporters, {
        type: 'goal_reached',
        audience: 'backer',
        campaignId: id,
        title: 'Fully funded',
        body: `“${title}” reached its goal. Ads start once setup is complete — we'll let you know.`,
        dedupeKey: dk('goal_reached'),
      });
      break;
    }
    case 'period_ended': {
      const supporters = await supporterKeys(q, id, creator);
      const msg = {
        type: 'funding_ended' as const,
        campaignId: id,
        title: 'Funding closed',
        body: `Funding for “${title}” has closed. Distribution is being prepared with the budget raised.`,
        dedupeKey: dk('funding_ended'),
      };
      await notify(q, [creator], { ...msg, audience: 'creator' });
      await notify(q, supporters, { ...msg, audience: 'backer' });
      break;
    }
    case 'launch': {
      const supporters = await supporterKeys(q, id, creator);
      const msg = {
        type: 'promotion_started' as const,
        campaignId: id,
        title: 'Ads are live',
        body: `“${title}” is now being shown to new audiences.`,
        dedupeKey: dk('launched'),
      };
      await notify(q, [creator], { ...msg, audience: 'creator' });
      await notify(q, supporters, { ...msg, audience: 'backer' });
      break;
    }
    case 'complete': {
      const supporters = await supporterKeys(q, id, creator);
      const msg = {
        type: 'report_ready' as const,
        campaignId: id,
        title: 'Final report ready',
        body: `“${title}” finished its run. See spend, impressions and measured reach.`,
        dedupeKey: dk('report_ready'),
      };
      await notify(q, [creator], { ...msg, audience: 'creator' });
      await notify(q, supporters, { ...msg, audience: 'backer' });
      break;
    }
    case 'halt': {
      // Every successful contribution becomes refundable in full (processing fees are not refundable).
      const rows = await q.query<{ owner_key: string }>(
        `UPDATE contributions SET status = 'refund_pending', refund_cents = amount_cents
          WHERE campaign_id = $1 AND status = 'succeeded' RETURNING owner_key`,
        [id],
      );
      await notify(q, [creator], {
        type: 'refund',
        audience: 'creator',
        campaignId: id,
        title: 'Campaign stopped — refunds started',
        body: `“${title}” won't run ads. Backers are being refunded.`,
        dedupeKey: dk('halt'),
      });
      await notify(
        q,
        rows.map((r) => r.owner_key),
        {
          type: 'refund',
          audience: 'backer',
          campaignId: id,
          title: 'Refund on the way',
          body: `“${title}” won't run ads, so your contribution is being refunded (processing fees excluded).`,
          dedupeKey: dk('refund_pending'),
        },
      );
      break;
    }
    case 'refund_complete': {
      const rows = await q.query<{ owner_key: string }>(
        `UPDATE contributions SET status = 'refunded' WHERE campaign_id = $1 AND status = 'refund_pending' RETURNING owner_key`,
        [id],
      );
      await notify(
        q,
        rows.map((r) => r.owner_key),
        {
          type: 'refund',
          audience: 'backer',
          campaignId: id,
          title: 'Refund complete',
          body: `Your refund for “${title}” has been issued.`,
          dedupeKey: dk('refunded'),
        },
      );
      break;
    }
  }
}

export function assertReviewer(role: string | null) {
  if (role !== 'reviewer') throw forbidden('Reviewer access only');
}

export const statusLabel = (s: CampaignStatus) => STATUS_LABEL[s];
export { badRequest };
