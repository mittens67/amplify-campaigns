import { randomBytes } from 'node:crypto';
import {
  attributedReach,
  formatMoney,
  quote,
  reachModel,
  type ContributionDTO,
  type ContributionRequest,
} from '@amplify/domain';
import type { Db, Queryable } from '../db/index.js';
import { newId, type Principal } from '../lib/auth.js';
import { clock, iso } from '../lib/clock.js';
import { conflict, notFound } from '../lib/errors.js';
import { notify, supporterKeys } from './notifications.js';
import { payments } from './payments.js';
import { campaignTitle, transitionCampaign } from './transitions.js';

const MILESTONES = [25, 50, 75];

function receiptNo() {
  return 'AMP-' + randomBytes(4).toString('hex').toUpperCase();
}

export async function createContribution(
  db: Db,
  principal: Principal,
  input: ContributionRequest,
  idempotencyKey: string,
): Promise<ContributionDTO> {
  const ownerKey = principal.key!;
  // Idempotency: a retried request (flaky network, double tap) returns the original contribution.
  const [existing] = await db.query('SELECT id FROM contributions WHERE owner_key = $1 AND idempotency_key = $2', [
    ownerKey,
    idempotencyKey,
  ]);
  if (existing) return getContribution(db, existing.id, ownerKey);

  const [campaign] = await db.query('SELECT * FROM campaigns WHERE id = $1', [input.campaignId]);
  if (!campaign) throw notFound('Campaign');
  if (campaign.status !== 'available_for_funding') {
    throw conflict('NOT_FUNDING', 'This campaign is no longer accepting contributions.');
  }
  if (campaign.raised_cents >= campaign.goal_cents) {
    throw conflict('GOAL_REACHED', 'This campaign just reached its goal.');
  }

  const q = quote(input.amountCents, reachModel(campaign.reach_model_version).peoplePerAdDollar);
  const id = newId();
  const publicName = input.showName ? (input.publicName?.trim() || null) : null;
  await db.query(
    `INSERT INTO contributions (id, receipt_no, campaign_id, owner_key, user_id, email, amount_cents, platform_fee_cents,
       ad_budget_cents, processing_cents, total_cents, est_reach, status, public_name, idempotency_key, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,$14,$15)`,
    [
      id,
      receiptNo(),
      campaign.id,
      ownerKey,
      principal.userId,
      input.email ?? null,
      q.amountCents,
      q.platformFeeCents,
      q.adBudgetCents,
      q.processingCents,
      q.totalCents,
      q.estReach,
      publicName,
      idempotencyKey,
      clock.now(),
    ],
  );

  // Call the provider outside any transaction — never hold row locks across a network call.
  const result = await payments.charge({ amountCents: q.totalCents, currency: 'usd', outcome: input.outcome });

  if (result.status === 'succeeded') {
    await db.query('UPDATE contributions SET provider_ref = $2 WHERE id = $1', [id, result.providerRef]);
    await db.tx((t) => settleSuccess(t, id));
  } else if (result.status === 'pending') {
    await db.query(
      `UPDATE contributions SET provider_ref = $2, settle_at = $3, pending_outcome = $4 WHERE id = $1`,
      [id, result.providerRef, result.settleAt, result.pendingOutcome],
    );
  } else {
    await db.tx((t) => settleFailure(t, id, result.status as 'failed' | 'cancelled', result.failureReason ?? null));
  }
  return getContribution(db, id, ownerKey);
}

/**
 * Mark a pending contribution as succeeded and count it toward the campaign — atomically.
 * The conditional UPDATE makes settlement idempotent; the campaign row lock serialises
 * concurrent contributions so totals and milestones are exact.
 */
export async function settleSuccess(q: Queryable, contributionId: string) {
  const now = clock.now();
  const [c] = await q.query(
    `UPDATE contributions SET status = 'succeeded', settled_at = $2 WHERE id = $1 AND status = 'pending' RETURNING *`,
    [contributionId, now],
  );
  if (!c) return; // already settled

  const [campaign] = await q.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [c.campaign_id]);
  if (campaign.status !== 'available_for_funding') {
    await q.query(`UPDATE contributions SET status = 'voided', failure_reason = $2 WHERE id = $1`, [
      c.id,
      'This campaign closed for funding before your payment completed. You have not been charged.',
    ]);
    return;
  }

  const [{ prior }] = await q.query<{ prior: number }>(
    `SELECT COUNT(*)::int AS prior FROM contributions WHERE campaign_id = $1 AND owner_key = $2 AND status = 'succeeded' AND id <> $3`,
    [c.campaign_id, c.owner_key, c.id],
  );
  const [updated] = await q.query(
    `UPDATE campaigns SET raised_cents = raised_cents + $2, backer_count = backer_count + $3, updated_at = $4
      WHERE id = $1 RETURNING raised_cents, goal_cents, creator_key`,
    [c.campaign_id, c.amount_cents, prior === 0 ? 1 : 0, now],
  );
  await q.query('INSERT INTO follows (owner_key, campaign_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    c.owner_key,
    c.campaign_id,
  ]);

  const title = campaignTitle(campaign);
  await notify(q, [c.owner_key], {
    type: 'contribution_succeeded',
    audience: 'backer',
    campaignId: c.campaign_id,
    title: 'Contribution confirmed',
    body: `${formatMoney(c.amount_cents)} toward “${title}”. Receipt ${c.receipt_no}.`,
    dedupeKey: `contribution:${c.id}`,
  });

  const before = Math.floor(((updated.raised_cents - c.amount_cents) / updated.goal_cents) * 100);
  const after = Math.floor((updated.raised_cents / updated.goal_cents) * 100);
  for (const m of MILESTONES) {
    if (before < m && after >= m) {
      await q.query(`INSERT INTO campaign_updates (id, campaign_id, kind, title, body, at) VALUES ($1,$2,'milestone',$3,$4,$5)`, [
        newId(),
        c.campaign_id,
        `${m}% funded`,
        `Backers have funded ${m}% of the distribution goal.`,
        now,
      ]);
      const supporters = await supporterKeys(q, c.campaign_id, updated.creator_key);
      const msg = {
        type: 'milestone' as const,
        campaignId: c.campaign_id,
        title: `${m}% funded`,
        body: `“${title}” is ${m}% of the way to its distribution goal.`,
        dedupeKey: `${c.campaign_id}:milestone:${m}`,
      };
      await notify(q, [updated.creator_key], { ...msg, audience: 'creator' });
      await notify(q, supporters, { ...msg, audience: 'backer' });
    }
  }
  if (updated.raised_cents >= updated.goal_cents) {
    await q.query(`INSERT INTO campaign_updates (id, campaign_id, kind, title, body, at) VALUES ($1,$2,'milestone',$3,$4,$5)`, [
      newId(),
      c.campaign_id,
      'Fully funded',
      'The distribution goal was reached. Ad setup comes next.',
      now,
    ]);
    await transitionCampaign(q, c.campaign_id, 'goal_reached', { role: 'system' });
  }
}

async function settleFailure(q: Queryable, contributionId: string, status: 'failed' | 'cancelled', reason: string | null) {
  const [c] = await q.query(
    `UPDATE contributions SET status = $2, failure_reason = $3, settled_at = $4 WHERE id = $1 AND status = 'pending' RETURNING *`,
    [contributionId, status, reason, clock.now()],
  );
  if (c && status === 'failed') {
    const [campaign] = await q.query('SELECT * FROM campaigns WHERE id = $1', [c.campaign_id]);
    await notify(q, [c.owner_key], {
      type: 'contribution_failed',
      audience: 'backer',
      campaignId: c.campaign_id,
      title: 'Payment didn’t go through',
      body: `Your ${formatMoney(c.amount_cents)} contribution to “${campaignTitle(campaign)}” wasn't charged. You can try again.`,
      dedupeKey: `contribution:${c.id}`,
    });
  }
}

/** Resolve pending payments whose provider result is due (lazy, called on reads). */
export async function settleDuePayments(db: Db, opts: { all?: boolean } = {}) {
  const due = await db.query<{ id: string; pending_outcome: string }>(
    opts.all
      ? `SELECT id, pending_outcome FROM contributions WHERE status = 'pending' AND settle_at IS NOT NULL`
      : `SELECT id, pending_outcome FROM contributions WHERE status = 'pending' AND settle_at IS NOT NULL AND settle_at <= $1`,
    opts.all ? [] : [new Date()],
  );
  for (const c of due) {
    if (c.pending_outcome === 'failed') {
      await db.tx((t) => settleFailure(t, c.id, 'failed', 'Your bank could not verify the payment (simulated).'));
    } else {
      await db.tx((t) => settleSuccess(t, c.id));
    }
  }
  return due.length;
}

const SELECT_CONTRIBUTION = `
  SELECT k.*, c.status AS campaign_status, c.raised_cents AS c_raised, c.goal_cents AS c_goal, c.backer_count AS c_backers,
         COALESCE(c.published_content, c.draft_content) AS content,
         (SELECT COALESCE(SUM(reach), 0)::int FROM distribution_metrics m WHERE m.campaign_id = c.id) AS measured_reach,
         (SELECT COUNT(*)::int FROM distribution_metrics m WHERE m.campaign_id = c.id) AS metric_days
    FROM contributions k JOIN campaigns c ON c.id = k.campaign_id`;

function toDTO(r: any): ContributionDTO {
  const counted = ['succeeded', 'refund_pending', 'refunded'].includes(r.status);
  return {
    id: r.id,
    campaignId: r.campaign_id,
    campaignTitle: r.content?.basics?.title ?? 'Campaign',
    campaignCoverUrl: r.content?.basics?.cover?.url ?? null,
    campaignStatus: r.campaign_status,
    amountCents: r.amount_cents,
    platformFeeCents: r.platform_fee_cents,
    adBudgetCents: r.ad_budget_cents,
    processingCents: r.processing_cents,
    totalCents: r.total_cents,
    refundCents: r.refund_cents,
    status: r.status,
    estReach: r.est_reach,
    attributedReach:
      r.status === 'succeeded' && r.metric_days > 0 ? attributedReach(r.amount_cents, r.c_raised, r.measured_reach) : null,
    publicName: r.public_name,
    receiptNo: r.receipt_no,
    createdAt: iso(r.created_at)!,
    failureReason: r.failure_reason,
    campaign: counted || r.status === 'pending' ? { raisedCents: r.c_raised, goalCents: r.c_goal, backerCount: r.c_backers } : undefined,
  };
}

export async function getContribution(q: Queryable, id: string, ownerKey: string): Promise<ContributionDTO> {
  const [r] = await q.query(`${SELECT_CONTRIBUTION} WHERE k.id = $1 AND k.owner_key = $2`, [id, ownerKey]);
  if (!r) throw notFound('Contribution');
  return toDTO(r);
}

export async function listContributions(q: Queryable, ownerKey: string): Promise<ContributionDTO[]> {
  const rows = await q.query(`${SELECT_CONTRIBUTION} WHERE k.owner_key = $1 ORDER BY k.created_at DESC`, [ownerKey]);
  return rows.map(toDTO);
}
