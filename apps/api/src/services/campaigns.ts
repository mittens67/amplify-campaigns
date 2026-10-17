import {
  estimateReach,
  estimateReachAtGoal,
  normalizeContent,
  reachModel,
  PUBLIC_STATUSES,
  type AnalyticsDTO,
  type CampaignContent,
  type CampaignDetailDTO,
  type CampaignStatus,
  type CampaignSummaryDTO,
  type Page,
} from '@amplify/domain';
import type { Queryable } from '../db/index.js';
import { newId, type Principal } from '../lib/auth.js';
import { clock, iso } from '../lib/clock.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';

export function contentOf(row: any, preferDraft = false): CampaignContent {
  const raw = preferDraft ? row.draft_content : (row.published_content ?? row.draft_content);
  return normalizeContent(raw);
}

export function toSummary(row: any, preferDraft = false): CampaignSummaryDTO {
  const c = contentOf(row, preferDraft);
  const goal = row.goal_cents || c.submit.goalCents || 0;
  return {
    id: row.id,
    status: row.status,
    title: c.basics.title || 'Untitled campaign',
    summary: c.basics.summary,
    category: c.basics.category ?? null,
    creatorName: c.basics.creatorName,
    creatorType: c.basics.creatorType ?? null,
    coverUrl: c.basics.cover?.url ?? null,
    raisedCents: row.raised_cents,
    goalCents: goal,
    backerCount: row.backer_count,
    fundingEndsAt: iso(row.funding_ends_at),
    publishedAt: iso(row.published_at),
    estReachAtGoal: estimateReachAtGoal(goal, reachModel(row.reach_model_version)),
    featured: row.featured,
    isDemo: row.is_demo,
    updatedAt: iso(row.updated_at)!,
  };
}

export const STATUS_GROUPS: Record<string, CampaignStatus[]> = {
  funding: ['available_for_funding'],
  funded: ['goal_reached', 'funding_ended', 'distribution_preparation'],
  promoting: ['promoting'],
  completed: ['completed'],
};

export interface ListParams {
  q?: string;
  category?: string;
  status?: string;
  creatorType?: string;
  sort?: string;
  featured?: boolean;
  cursor?: string;
  limit?: number;
}

const PUB = `COALESCE(published_content, draft_content)`;

export async function listCampaigns(q: Queryable, p: ListParams): Promise<Page<CampaignSummaryDTO>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const statuses = p.status && STATUS_GROUPS[p.status] ? STATUS_GROUPS[p.status] : PUBLIC_STATUSES;
  where.push(`status = ANY(${add(statuses)}::text[])`);
  if (p.q?.trim()) {
    const term = add(`%${p.q.trim().replace(/[%_]/g, '')}%`);
    where.push(
      `(${PUB}->'basics'->>'title' ILIKE ${term} OR ${PUB}->'basics'->>'summary' ILIKE ${term} OR ${PUB}->'basics'->>'creatorName' ILIKE ${term} OR ${PUB}->'basics'->>'category' ILIKE ${term})`,
    );
  }
  if (p.category) where.push(`${PUB}->'basics'->>'category' = ${add(p.category)}`);
  if (p.creatorType) where.push(`${PUB}->'basics'->>'creatorType' = ${add(p.creatorType)}`);
  if (p.featured) where.push('featured = true');

  let order: string;
  switch (p.sort) {
    case 'newest':
      order = 'published_at DESC NULLS LAST';
      break;
    case 'almost':
      order = `(CASE WHEN status = 'available_for_funding' THEN raised_cents::float / NULLIF(goal_cents, 0) ELSE -1 END) DESC`;
      break;
    case 'ending':
      order = `(CASE WHEN status = 'available_for_funding' AND funding_ends_at > ${add(clock.now())} THEN funding_ends_at END) ASC NULLS LAST`;
      break;
    case 'reach':
      order = 'goal_cents DESC';
      break;
    default: // trending: active funding first, then by backer momentum
      order = `(status = 'available_for_funding') DESC, backer_count DESC`;
  }
  const limit = Math.min(Math.max(p.limit ?? 20, 1), 50);
  const offset = p.cursor ? Math.max(0, parseInt(Buffer.from(p.cursor, 'base64url').toString(), 10) || 0) : 0;
  const rows = await q.query(
    `SELECT * FROM campaigns WHERE ${where.join(' AND ')} ORDER BY ${order}, id LIMIT ${limit + 1} OFFSET ${offset}`,
    params,
  );
  const items = rows.slice(0, limit).map((r) => toSummary(r));
  return {
    items,
    nextCursor: rows.length > limit ? Buffer.from(String(offset + limit)).toString('base64url') : null,
  };
}

export async function getCampaignRow(q: Queryable, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Campaign');
  const [row] = await q.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  if (!row) throw notFound('Campaign');
  return row;
}

export function canView(row: any, p: Principal) {
  return PUBLIC_STATUSES.includes(row.status) || row.creator_key === p.key || p.role === 'reviewer';
}

export async function getCampaignDetail(q: Queryable, id: string, p: Principal): Promise<CampaignDetailDTO> {
  const row = await getCampaignRow(q, id);
  if (!canView(row, p)) throw notFound('Campaign');
  const isOwner = !!p.key && row.creator_key === p.key;
  const privileged = isOwner || p.role === 'reviewer';
  const viewerKey = p.key ?? '';

  const [reviews, events, updates, backers, metrics, votes, viewer] = await Promise.all([
    q.query(
      `SELECT layer, outcome, notes, at FROM reviews WHERE campaign_id = $1
         AND round = (SELECT COALESCE(MAX(round), 0) FROM reviews WHERE campaign_id = $1) ORDER BY at`,
      [id],
    ),
    q.query('SELECT * FROM campaign_events WHERE campaign_id = $1 ORDER BY at, id', [id]),
    q.query('SELECT * FROM campaign_updates WHERE campaign_id = $1 ORDER BY at DESC', [id]),
    q.query(
      `SELECT public_name FROM contributions WHERE campaign_id = $1 AND status = 'succeeded' AND public_name IS NOT NULL
        ORDER BY created_at DESC LIMIT 12`,
      [id],
    ),
    q.query(
      `SELECT COUNT(*)::int AS days, COALESCE(SUM(spend_cents),0)::int AS spend, COALESCE(SUM(impressions),0)::int AS impressions,
              COALESCE(SUM(reach),0)::int AS reach, COALESCE(SUM(clicks),0)::int AS clicks
         FROM distribution_metrics WHERE campaign_id = $1`,
      [id],
    ),
    q.query(
      `SELECT question, answer, COUNT(*)::int AS n FROM feedback_votes WHERE campaign_id = $1 GROUP BY question, answer`,
      [id],
    ),
    q.query(
      `SELECT
         EXISTS(SELECT 1 FROM saves WHERE owner_key = $2 AND campaign_id = $1) AS saved,
         EXISTS(SELECT 1 FROM follows WHERE owner_key = $2 AND campaign_id = $1) AS following,
         (SELECT COALESCE(SUM(amount_cents),0)::int FROM contributions WHERE owner_key = $2 AND campaign_id = $1 AND status = 'succeeded') AS contributed,
         (SELECT json_object_agg(question, answer) FROM feedback_votes WHERE owner_key = $2 AND campaign_id = $1) AS feedback`,
      [id, viewerKey],
    ),
  ]);

  const feedback = {
    visuals: { no: 0, somewhat: 0, yes: 0 },
    mind: { no: 0, somewhat: 0, yes: 0 },
  } as CampaignDetailDTO['feedback'];
  for (const v of votes as any[]) (feedback as any)[v.question][v.answer] = v.n;

  const m = (metrics as any[])[0];
  const v = (viewer as any[])[0];
  const showDraft = privileged && !row.published_content;
  const detail: CampaignDetailDTO = {
    ...toSummary(row, showDraft),
    content: contentOf(row, showDraft),
    reachModelVersion: row.reach_model_version,
    reviews: (reviews as any[]).map((r) => ({ layer: r.layer, outcome: r.outcome, notes: r.notes, reviewedAt: iso(r.at)! })),
    timeline: (events as any[])
      .filter((e) => privileged || PUBLIC_STATUSES.includes(e.to_status) || ['approved'].includes(e.to_status))
      .map((e) => ({
        id: e.id,
        event: e.event,
        from: e.from_status,
        to: e.to_status,
        note: privileged ? e.note : null,
        actorRole: e.actor_role,
        at: iso(e.at)!,
      })),
    updates: (updates as any[]).map((u) => ({ id: u.id, title: u.title, body: u.body, kind: u.kind, at: iso(u.at)! })),
    publicBackers: (backers as any[]).map((b) => b.public_name),
    delivery: m.days > 0 ? { days: m.days, spendCents: m.spend, impressions: m.impressions, reach: m.reach, clicks: m.clicks } : null,
    feedback,
    viewer: {
      isOwner,
      saved: !!v?.saved,
      following: !!v?.following,
      contributedCents: v?.contributed ?? 0,
      feedback: v?.feedback ?? {},
    },
  };
  if (privileged) {
    detail.draft = {
      content: normalizeContent(row.draft_content),
      version: row.version,
      reviewerNotes: row.reviewer_notes ?? {},
      reviewerMessage: row.reviewer_message,
    };
  }
  return detail;
}

/* ---------------- Drafts ---------------- */

export const EDITABLE: CampaignStatus[] = ['draft', 'changes_requested'];

export async function createDraft(q: Queryable, p: Principal, content: unknown) {
  const id = newId();
  const now = clock.now();
  const [row] = await q.query(
    `INSERT INTO campaigns (id, creator_key, creator_user_id, draft_content, created_at, updated_at, status_changed_at)
     VALUES ($1,$2,$3,$4::text::jsonb,$5,$5,$5) RETURNING *`,
    [id, p.key, p.userId, JSON.stringify(normalizeContent(content)), now],
  );
  await q.query(
    `INSERT INTO campaign_events (id, campaign_id, event, from_status, to_status, actor_key, actor_role, at)
     VALUES ($1,$2,'create',NULL,'draft',$3,'creator',$4)`,
    [newId(), id, p.key, now],
  );
  return row;
}

export async function saveDraft(
  q: Queryable,
  id: string,
  p: Principal,
  body: { content: unknown; version: number; step?: string },
) {
  const [row] = await q.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [id]);
  if (!row) throw notFound('Draft');
  if (row.creator_key !== p.key) throw forbidden('This draft belongs to someone else');
  if (!EDITABLE.includes(row.status)) {
    throw conflict('LOCKED', 'This campaign is under review or published, so its content is locked.');
  }
  if (body.version < row.version) {
    throw conflict('STALE', 'This draft was changed on another device. Reload to get the latest version.');
  }
  const content = normalizeContent(body.content);
  const [updated] = await q.query(
    `UPDATE campaigns SET draft_content = $2::text::jsonb, version = version + 1, current_step = COALESCE($3, current_step),
            goal_cents = CASE WHEN status = 'draft' THEN COALESCE($4, goal_cents) ELSE goal_cents END, updated_at = $5
      WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(content), body.step ?? null, content.submit.goalCents ?? null, clock.now()],
  );
  return updated;
}

export async function deleteDraft(q: Queryable, id: string, p: Principal) {
  const [row] = await q.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  if (!row) throw notFound('Draft');
  if (row.creator_key !== p.key) throw forbidden();
  if (row.status !== 'draft') throw conflict('LOCKED', 'Only drafts can be deleted');
  await q.query('DELETE FROM campaigns WHERE id = $1', [id]);
}

export async function myCampaigns(q: Queryable, p: Principal) {
  const rows = await q.query(
    `SELECT c.*, (SELECT COUNT(*)::int FROM campaign_reports r WHERE r.campaign_id = c.id) AS report_count
       FROM campaigns c WHERE creator_key = $1 ORDER BY updated_at DESC`,
    [p.key],
  );
  return rows.map((r: any) => ({
    ...toSummary(r, EDITABLE.includes(r.status)),
    currentStep: r.current_step,
    version: r.version,
    reviewerMessage: r.reviewer_message,
    hasReviewerNotes: Object.keys(r.reviewer_notes ?? {}).length > 0,
  }));
}

/* ---------------- Analytics ---------------- */

export async function analytics(q: Queryable, id: string, p: Principal): Promise<AnalyticsDTO> {
  const row = await getCampaignRow(q, id);
  if (row.creator_key !== p.key && p.role !== 'reviewer') throw forbidden('Only the creator can see analytics');
  const content = contentOf(row);
  const model = reachModel(row.reach_model_version);
  const [agg] = await q.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(platform_fee_cents),0)::int AS fee, COALESCE(SUM(ad_budget_cents),0)::int AS budget
       FROM contributions WHERE campaign_id = $1 AND status IN ('succeeded')`,
    [id],
  );
  const daily = await q.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, SUM(amount_cents)::int AS value
       FROM contributions WHERE campaign_id = $1 AND status = 'succeeded' GROUP BY 1 ORDER BY 1`,
    [id],
  );
  const metrics = await q.query(
    `SELECT day, to_char(date, 'YYYY-MM-DD') AS date, spend_cents, impressions, reach, clicks FROM distribution_metrics
      WHERE campaign_id = $1 ORDER BY day`,
    [id],
  );
  const spent = metrics.reduce((s: number, m: any) => s + m.spend_cents, 0);
  const impressions = metrics.reduce((s: number, m: any) => s + m.impressions, 0);
  const reach = metrics.reduce((s: number, m: any) => s + m.reach, 0);
  const clicks = metrics.reduce((s: number, m: any) => s + m.clicks, 0);
  return {
    campaignId: id,
    status: row.status,
    funding: {
      raisedCents: row.raised_cents,
      goalCents: row.goal_cents,
      backerCount: row.backer_count,
      contributionCount: agg.n,
      averageCents: agg.n ? Math.round(row.raised_cents / agg.n) : 0,
      daily: daily.map((d: any) => ({ day: d.day, value: d.value })),
      platformFeeCents: agg.fee,
      adBudgetCents: agg.budget,
    },
    delivery: {
      allocatedCents: agg.budget,
      spentCents: spent,
      impressions,
      reach,
      clicks,
      ctr: impressions ? clicks / impressions : null,
      cpmCents: impressions ? Math.round((spent / impressions) * 1000) : null,
      daily: metrics.map((m: any) => ({
        day: m.date,
        spendCents: m.spend_cents,
        impressions: m.impressions,
        reach: m.reach,
        clicks: m.clicks,
      })),
    },
    estimates: {
      reachAtGoal: estimateReachAtGoal(row.goal_cents, model),
      reachForRaised: estimateReach(row.raised_cents, model),
    },
    durationDays: content.reach.durationDays,
    fundingEndsAt: iso(row.funding_ends_at),
  };
}
