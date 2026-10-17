import { Router } from 'express';
import { z } from 'zod';
import { reviewDecisionSchema, REVIEW_LAYERS } from '@amplify/domain';
import type { Db } from '../db/index.js';
import { newId, requireReviewer } from '../lib/auth.js';
import { clock, iso } from '../lib/clock.js';
import { ah, badRequest, conflict, parse } from '../lib/errors.js';
import { getCampaignDetail, toSummary } from '../services/campaigns.js';
import { settleDuePayments } from '../services/contributions.js';
import { finishDistribution, tick } from '../services/engine.js';
import { transitionCampaign } from '../services/transitions.js';
import { seedDemo } from '../seed/seed.js';

const QUEUES: Record<string, string[]> = {
  submitted: ['submitted'],
  changes: ['changes_requested'],
  funded: ['goal_reached', 'funding_ended', 'distribution_preparation'],
  live: ['available_for_funding', 'promoting'],
  closed: ['completed', 'rejected', 'failed', 'refund_pending', 'refunded', 'cancelled'],
};

export function reviewRoutes(db: Db) {
  const r = Router();

  r.get(
    '/review/queue',
    ah(async (req, res) => {
      requireReviewer(req);
      await tick(db);
      const tab = String(req.query.tab ?? 'submitted');
      if (tab === 'reports') {
        const rows = await db.query(
          `SELECT r.*, COALESCE(c.published_content, c.draft_content)->'basics'->>'title' AS title
             FROM campaign_reports r JOIN campaigns c ON c.id = r.campaign_id ORDER BY r.resolved, r.at DESC LIMIT 100`,
        );
        res.json(
          rows.map((x: any) => ({
            id: x.id,
            campaignId: x.campaign_id,
            campaignTitle: x.title,
            reason: x.reason,
            details: x.details,
            at: iso(x.at),
            resolved: x.resolved,
          })),
        );
        return;
      }
      const statuses = QUEUES[tab] ?? QUEUES.submitted;
      const rows = await db.query(
        `SELECT c.*, (SELECT COUNT(*)::int FROM campaign_reports r WHERE r.campaign_id = c.id AND NOT r.resolved) AS report_count
           FROM campaigns c WHERE status = ANY($1::text[]) ORDER BY submitted_at ASC NULLS LAST, updated_at DESC`,
        [statuses],
      );
      res.json(
        rows.map((row: any) => ({
          ...toSummary(row, row.status === 'submitted' || row.status === 'changes_requested'),
          submittedAt: iso(row.submitted_at),
          reportCount: row.report_count,
        })),
      );
    }),
  );

  r.get(
    '/review/counts',
    ah(async (req, res) => {
      requireReviewer(req);
      const rows = await db.query(`SELECT status, COUNT(*)::int AS n FROM campaigns GROUP BY status`);
      const [{ n: reports }] = await db.query(`SELECT COUNT(*)::int AS n FROM campaign_reports WHERE NOT resolved`);
      const by = Object.fromEntries(rows.map((x: any) => [x.status, x.n]));
      const out: Record<string, number> = { reports };
      for (const [tab, statuses] of Object.entries(QUEUES)) out[tab] = statuses.reduce((s, st) => s + (by[st] ?? 0), 0);
      res.json(out);
    }),
  );

  r.get(
    '/review/campaigns/:id',
    ah(async (req, res) => {
      requireReviewer(req);
      const detail = await getCampaignDetail(db, req.params.id as string, req.principal);
      const history = await db.query(
        `SELECT round, layer, outcome, notes, at FROM reviews WHERE campaign_id = $1 ORDER BY round DESC, at`,
        [req.params.id],
      );
      res.json({ ...detail, reviewHistory: history.map((h: any) => ({ ...h, at: iso(h.at) })) });
    }),
  );

  r.post(
    '/review/campaigns/:id/decision',
    ah(async (req, res) => {
      const reviewerId = requireReviewer(req);
      const body = parse(reviewDecisionSchema, req.body);
      const id = req.params.id as string;
      if (body.decision === 'approve') {
        const layers = new Set(body.layers.map((l) => l.layer));
        if (!REVIEW_LAYERS.every((l) => layers.has(l.key))) {
          throw badRequest('Record an outcome for all three review layers before approving', { layers: 'Incomplete' });
        }
        if (body.layers.some((l) => l.outcome === 'fail')) {
          throw badRequest('A failed layer can’t be approved. Request changes or reject instead.', { layers: 'Failed layer' });
        }
      }
      if (body.decision !== 'approve' && !body.message.trim()) {
        throw badRequest('Explain the decision to the creator', { message: 'Required' });
      }
      await db.tx(async (t) => {
        const [c] = await t.query('SELECT status FROM campaigns WHERE id = $1 FOR UPDATE', [id]);
        if (!c || c.status !== 'submitted') throw conflict('INVALID_STATE', 'This campaign is not awaiting review');
        const [{ round }] = await t.query<{ round: number }>(
          'SELECT COALESCE(MAX(round), 0)::int + 1 AS round FROM reviews WHERE campaign_id = $1',
          [id],
        );
        for (const l of body.layers) {
          await t.query(
            `INSERT INTO reviews (id, campaign_id, round, layer, outcome, notes, reviewer_id, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [newId(), id, round, l.layer, l.outcome, l.notes, reviewerId, clock.now()],
          );
        }
        if (body.decision === 'request_changes') {
          await t.query('UPDATE campaigns SET reviewer_notes = $2::text::jsonb, reviewer_message = $3 WHERE id = $1', [
            id,
            JSON.stringify(body.fieldNotes),
            body.message,
          ]);
        } else {
          await t.query('UPDATE campaigns SET reviewer_message = $2 WHERE id = $1', [id, body.message || null]);
        }
        await transitionCampaign(t, id, body.decision, { role: 'reviewer', key: req.principal.key }, { note: body.message || null });
      });
      res.json(await getCampaignDetail(db, id, req.principal));
    }),
  );

  const simple = (event: 'prepare' | 'halt', note?: string) =>
    ah(async (req, res) => {
      requireReviewer(req);
      const id = req.params.id as string;
      const msg = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : note;
      await db.tx((t) => transitionCampaign(t, id, event, { role: 'reviewer', key: req.principal.key }, { note: msg ?? null }));
      res.json(await getCampaignDetail(db, id, req.principal));
    });
  r.post('/review/campaigns/:id/prepare', simple('prepare', 'Distribution preparation started'));
  r.post('/review/campaigns/:id/halt', simple('halt', 'Halted by reviewer'));

  r.post(
    '/review/campaigns/:id/launch',
    ah(async (req, res) => {
      requireReviewer(req);
      const id = req.params.id as string;
      const body = parse(z.object({ adSetupConfirmed: z.literal(true, { message: 'Confirm the ad setup first' }) }), req.body);
      await db.tx(async (t) => {
        await t.query('UPDATE campaigns SET ad_setup_confirmed = $2 WHERE id = $1', [id, body.adSetupConfirmed]);
        await transitionCampaign(t, id, 'launch', { role: 'reviewer', key: req.principal.key }, { note: 'Ad setup confirmed; ads launched' });
      });
      res.json(await getCampaignDetail(db, id, req.principal));
    }),
  );

  r.post(
    '/review/campaigns/:id/finish',
    ah(async (req, res) => {
      requireReviewer(req);
      await finishDistribution(db, req.params.id as string, req.principal.key!);
      res.json(await getCampaignDetail(db, req.params.id as string, req.principal));
    }),
  );

  r.post(
    '/review/reports/:id/resolve',
    ah(async (req, res) => {
      requireReviewer(req);
      await db.query('UPDATE campaign_reports SET resolved = true WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    }),
  );

  /* ---------- Demo controls (reviewer only) ---------- */

  r.get(
    '/demo/state',
    ah(async (req, res) => {
      requireReviewer(req);
      const [{ pending }] = await db.query(`SELECT COUNT(*)::int AS pending FROM contributions WHERE status = 'pending'`);
      res.json({ clockOffsetDays: clock.offsetDays(), now: clock.now().toISOString(), pendingPayments: pending });
    }),
  );

  r.post(
    '/demo/advance',
    ah(async (req, res) => {
      requireReviewer(req);
      const { days } = parse(z.object({ days: z.number().int().min(1).max(30) }), req.body);
      await clock.advance(db, days);
      await tick(db, true);
      res.json({ clockOffsetDays: clock.offsetDays(), now: clock.now().toISOString() });
    }),
  );

  r.post(
    '/demo/settle',
    ah(async (req, res) => {
      requireReviewer(req);
      const settled = await settleDuePayments(db, { all: true });
      res.json({ settled });
    }),
  );

  r.post(
    '/demo/reset',
    ah(async (req, res) => {
      requireReviewer(req);
      await seedDemo(db);
      res.json({ ok: true });
    }),
  );

  return r;
}
