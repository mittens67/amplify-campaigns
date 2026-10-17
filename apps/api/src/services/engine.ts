import { createHash } from 'node:crypto';
import {
  adBudget,
  normalizeContent,
  reachModel,
  DEADLINE_WARNING_DAYS,
  MIN_AD_BUDGET_CENTS,
} from '@amplify/domain';
import type { Db, Queryable } from '../db/index.js';
import { addDays, clock, days } from '../lib/clock.js';
import { settleDuePayments } from './contributions.js';
import { notify, supporterKeys } from './notifications.js';
import { campaignTitle, transitionCampaign } from './transitions.js';

/**
 * Distribution provider boundary. The prototype simulates ad delivery so reports run
 * through real data paths; a real integration (e.g. Meta Marketing API) would report
 * the same daily metrics.
 */
export interface DistributionProvider {
  deliverDay(input: { campaignId: string; day: number; budgetCents: number; spentCents: number; durationDays: number; reachModelVersion: number }): {
    spendCents: number;
    impressions: number;
    reach: number;
    clicks: number;
  };
}

function rand(seed: string): number {
  const h = createHash('sha256').update(seed).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

export const simulatedDistribution: DistributionProvider = {
  deliverDay({ campaignId, day, budgetCents, spentCents, durationDays, reachModelVersion }) {
    const model = reachModel(reachModelVersion);
    const remaining = Math.max(0, budgetCents - spentCents);
    const r = (k: string) => rand(`${campaignId}:${day}:${k}`);
    const perDay = budgetCents / durationDays;
    const spendCents = day >= durationDays ? remaining : Math.min(remaining, Math.round(perDay * (0.8 + 0.4 * r('spend'))));
    const reach = Math.round((spendCents / 100) * model.peoplePerAdDollar * (0.85 + 0.25 * r('reach')));
    const impressions = Math.round(reach * model.frequency * (0.9 + 0.2 * r('freq')));
    const clicks = Math.round(impressions * model.ctr * (0.7 + 0.6 * r('ctr')));
    return { spendCents, impressions, reach, clicks };
  },
};

async function simulateThrough(q: Queryable, c: any, uptoDay: number) {
  const content = normalizeContent(c.published_content ?? c.draft_content);
  const duration = Math.max(1, content.reach.durationDays);
  const [{ budget }] = await q.query<{ budget: number }>(
    `SELECT COALESCE(SUM(ad_budget_cents),0)::int AS budget FROM contributions WHERE campaign_id = $1 AND status = 'succeeded'`,
    [c.id],
  );
  const [{ maxday, spent }] = await q.query<{ maxday: number; spent: number }>(
    `SELECT COALESCE(MAX(day),0)::int AS maxday, COALESCE(SUM(spend_cents),0)::int AS spent FROM distribution_metrics WHERE campaign_id = $1`,
    [c.id],
  );
  let spentSoFar = spent;
  const last = Math.min(uptoDay, duration);
  for (let day = maxday + 1; day <= last; day++) {
    const m = simulatedDistribution.deliverDay({
      campaignId: c.id,
      day,
      budgetCents: budget,
      spentCents: spentSoFar,
      durationDays: duration,
      reachModelVersion: c.reach_model_version,
    });
    spentSoFar += m.spendCents;
    await q.query(
      `INSERT INTO distribution_metrics (campaign_id, day, date, spend_cents, impressions, reach, clicks)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [c.id, day, addDays(new Date(c.launched_at), day - 1), m.spendCents, m.impressions, m.reach, m.clicks],
    );
  }
  const title = campaignTitle(c);
  if (last >= Math.ceil(duration / 2) && maxday < Math.ceil(duration / 2)) {
    const supporters = await supporterKeys(q, c.id, c.creator_key);
    const msg = {
      type: 'distribution_progress' as const,
      campaignId: c.id,
      title: 'Halfway through the ad run',
      body: `“${title}” has spent about half its ad budget. Measured reach is in the dashboard.`,
      dedupeKey: `${c.id}:halfway`,
    };
    await notify(q, [c.creator_key], { ...msg, audience: 'creator' });
    await notify(q, supporters, { ...msg, audience: 'backer' });
  }
  return { finished: last >= duration };
}

/** Run every remaining distribution day now and complete the campaign (reviewer "finish run"). */
export async function finishDistribution(db: Db, campaignId: string, actorKey: string) {
  return db.tx(async (t) => {
    const [c] = await t.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [campaignId]);
    if (!c || c.status !== 'promoting') return c;
    await simulateThrough(t, c, Number.MAX_SAFE_INTEGER);
    return transitionCampaign(t, campaignId, 'complete', { role: 'reviewer', key: actorKey }, { note: 'Ad run finished' });
  });
}

let lastTick = 0;
let ticking: Promise<void> | null = null;

/**
 * Evaluate time-based rules lazily (on reads and when the demo clock moves) instead of a cron job,
 * so nothing is missed if the server slept. Throttled; concurrent callers share one run.
 */
export function tick(db: Db, force = false): Promise<void> {
  if (ticking) return ticking;
  if (!force && Date.now() - lastTick < 15_000) return Promise.resolve();
  lastTick = Date.now();
  ticking = runTick(db)
    .catch((e) => console.error('[tick]', e))
    .finally(() => {
      ticking = null;
    });
  return ticking;
}

async function runTick(db: Db) {
  await settleDuePayments(db);
  const now = clock.now();

  // Funding period ended.
  const ended = await db.query(
    `SELECT id, raised_cents FROM campaigns WHERE status = 'available_for_funding' AND funding_ends_at <= $1`,
    [now],
  );
  for (const c of ended) {
    const event = adBudget(c.raised_cents) >= MIN_AD_BUDGET_CENTS ? 'period_ended' : 'funding_failed';
    await db.tx((t) => transitionCampaign(t, c.id, event, { role: 'system' }));
  }

  // Deadline approaching.
  const closing = await db.query(
    `SELECT * FROM campaigns c WHERE status = 'available_for_funding' AND funding_ends_at > $1 AND funding_ends_at <= $2
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.owner_key = c.creator_key AND n.dedupe_key = c.id || ':deadline')`,
    [now, new Date(now.getTime() + days(DEADLINE_WARNING_DAYS))],
  );
  for (const c of closing) {
    await db.tx(async (t) => {
      const supporters = await supporterKeys(t, c.id, c.creator_key);
      const title = campaignTitle(c);
      const msg = {
        type: 'deadline' as const,
        campaignId: c.id,
        title: 'Funding closes soon',
        body: `Less than ${DEADLINE_WARNING_DAYS} days left to fund “${title}”.`,
        dedupeKey: `${c.id}:deadline`,
      };
      await notify(t, [c.creator_key], { ...msg, audience: 'creator' });
      await notify(t, supporters.filter((k) => k !== c.creator_key), { ...msg, audience: 'backer' });
    });
  }

  // Ad delivery for running campaigns.
  // Only campaigns with at least one new delivery day due (one query instead of a transaction per campaign).
  const running = await db.query(
    `SELECT c.* FROM campaigns c
      WHERE c.status = 'promoting' AND c.launched_at IS NOT NULL
        AND floor(extract(epoch FROM ($1::timestamptz - c.launched_at)) / 86400) >
            COALESCE((SELECT MAX(day) FROM distribution_metrics m WHERE m.campaign_id = c.id), 0)`,
    [now],
  );
  for (const c of running) {
    const elapsed = Math.floor((now.getTime() - new Date(c.launched_at).getTime()) / days(1));
    if (elapsed < 1) continue;
    await db.tx(async (t) => {
      const [locked] = await t.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [c.id]);
      if (locked.status !== 'promoting') return;
      const { finished } = await simulateThrough(t, locked, elapsed);
      if (finished) await transitionCampaign(t, c.id, 'complete', { role: 'system' }, { note: 'Ad run finished' });
    });
  }

  // Refunds are issued one day after they start.
  const refunding = await db.query(
    `SELECT id FROM campaigns WHERE status = 'refund_pending' AND status_changed_at <= $1`,
    [new Date(now.getTime() - days(1))],
  );
  for (const c of refunding) {
    await db.tx((t) => transitionCampaign(t, c.id, 'refund_complete', { role: 'system' }));
  }
}
