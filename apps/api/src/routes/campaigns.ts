import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  contributionRequestSchema,
  normalizeContent,
  validateAll,
  PUBLIC_STATUSES,
} from '@amplify/domain';
import type { Db } from '../db/index.js';
import { newId, requireKey, requireUser } from '../lib/auth.js';
import { clock } from '../lib/clock.js';
import { ah, badRequest, conflict, forbidden, parse } from '../lib/errors.js';
import { aiStatus, draftFromInterview, interviewSchema, transcribe } from '../services/ai.js';
import {
  analytics,
  canView,
  createDraft,
  deleteDraft,
  getCampaignDetail,
  getCampaignRow,
  listCampaigns,
  myCampaigns,
  saveDraft,
  toSummary,
} from '../services/campaigns.js';
import { createContribution, getContribution, listContributions, settleDuePayments } from '../services/contributions.js';
import { tick } from '../services/engine.js';
import { getPrefs, listNotifications, notify, setPref, supporterKeys } from '../services/notifications.js';
import { storeUpload, UPLOAD_RULES } from '../services/storage.js';
import { campaignTitle, transitionCampaign } from '../services/transitions.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: UPLOAD_RULES.video.maxBytes, files: 1 } });
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

export function campaignRoutes(db: Db) {
  const r = Router();

  /* ---------- Discovery ---------- */

  r.get(
    '/campaigns',
    ah(async (req, res) => {
      void tick(db); // time-based rules run in the background; reads never wait for them
      const qs = req.query as Record<string, string | undefined>;
      res.json(
        await listCampaigns(db, {
          q: qs.q,
          category: qs.category,
          status: qs.status,
          creatorType: qs.creatorType,
          sort: qs.sort,
          featured: qs.featured === 'true',
          cursor: qs.cursor,
          limit: qs.limit ? Number(qs.limit) : undefined,
        }),
      );
    }),
  );

  r.get(
    '/campaigns/:id',
    ah(async (req, res) => {
      void tick(db); // time-based rules run in the background; reads never wait for them
      res.json(await getCampaignDetail(db, req.params.id as string, req.principal));
    }),
  );

  /* ---------- Drafts & submission ---------- */

  r.post(
    '/campaigns',
    ah(async (req, res) => {
      requireKey(req);
      const row = await createDraft(db, req.principal, req.body?.content ?? {});
      res.status(201).json({ id: row.id, version: row.version, status: row.status });
    }),
  );

  r.put(
    '/campaigns/:id/draft',
    ah(async (req, res) => {
      requireKey(req);
      const body = parse(
        z.object({ content: z.unknown(), version: z.number().int(), step: z.enum(['basics', 'story', 'visuals', 'reach', 'submit']).optional() }),
        req.body,
      );
      const row = await db.tx((t) => saveDraft(t, req.params.id as string, req.principal, body));
      res.json({ id: row.id, version: row.version, status: row.status, savedAt: row.updated_at });
    }),
  );

  r.delete(
    '/campaigns/:id',
    ah(async (req, res) => {
      requireKey(req);
      await deleteDraft(db, req.params.id as string, req.principal);
      res.status(204).end();
    }),
  );

  r.post(
    '/campaigns/:id/submit',
    ah(async (req, res) => {
      requireUser(req);
      const row = await getCampaignRow(db, req.params.id as string);
      if (row.creator_key !== req.principal.key) throw forbidden('Only the creator can submit this campaign');
      const errors = validateAll(normalizeContent(row.draft_content));
      if (Object.keys(errors).length) throw badRequest('A few things need attention before submitting', errors);
      const event = row.status === 'changes_requested' ? 'resubmit' : 'submit';
      await db.tx((t) => transitionCampaign(t, row.id, event, { role: 'creator', key: req.principal.key }));
      res.json(await getCampaignDetail(db, row.id, req.principal));
    }),
  );

  r.post(
    '/campaigns/:id/cancel',
    ah(async (req, res) => {
      requireKey(req);
      await db.tx((t) => transitionCampaign(t, req.params.id as string, 'cancel', { role: 'creator', key: req.principal.key }));
      res.json(await getCampaignDetail(db, req.params.id as string, req.principal));
    }),
  );

  r.get(
    '/campaigns/:id/analytics',
    ah(async (req, res) => {
      requireKey(req);
      void tick(db); // time-based rules run in the background; reads never wait for them
      res.json(await analytics(db, req.params.id as string, req.principal));
    }),
  );

  r.post(
    '/campaigns/:id/updates',
    ah(async (req, res) => {
      requireUser(req);
      const body = parse(z.object({ title: z.string().trim().min(3).max(80), body: z.string().trim().min(1).max(2000) }), req.body);
      const row = await getCampaignRow(db, req.params.id as string);
      if (row.creator_key !== req.principal.key) throw forbidden('Only the creator can post updates');
      if (!PUBLIC_STATUSES.includes(row.status)) throw conflict('NOT_PUBLIC', 'Updates can be posted once the campaign is live');
      await db.tx(async (t) => {
        await t.query(`INSERT INTO campaign_updates (id, campaign_id, kind, title, body, at) VALUES ($1,$2,'creator',$3,$4,$5)`, [
          newId(),
          row.id,
          body.title,
          body.body,
          clock.now(),
        ]);
        await notify(t, await supporterKeys(t, row.id, row.creator_key), {
          type: 'update',
          audience: 'backer',
          campaignId: row.id,
          title: `Update: ${body.title}`,
          body: `${campaignTitle(row)} posted an update.`,
          dedupeKey: `${row.id}:update:${Date.now()}`,
        });
      });
      res.status(201).json(await getCampaignDetail(db, row.id, req.principal));
    }),
  );

  /* ---------- Audience actions ---------- */

  const toggle = (table: 'saves' | 'follows', field: 'saved' | 'following') =>
    ah(async (req, res) => {
      const key = requireKey(req);
      const on = parse(z.object({ [field]: z.boolean() }), req.body)[field] as boolean;
      const row = await getCampaignRow(db, req.params.id as string);
      if (!canView(row, req.principal)) throw forbidden();
      if (on) await db.query(`INSERT INTO ${table} (owner_key, campaign_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [key, row.id]);
      else await db.query(`DELETE FROM ${table} WHERE owner_key = $1 AND campaign_id = $2`, [key, row.id]);
      res.json({ [field]: on });
    });
  r.post('/campaigns/:id/save', toggle('saves', 'saved'));
  r.post('/campaigns/:id/follow', toggle('follows', 'following'));

  r.post(
    '/campaigns/:id/feedback',
    ah(async (req, res) => {
      const key = requireKey(req);
      const body = parse(z.object({ question: z.enum(['visuals', 'mind']), answer: z.enum(['no', 'somewhat', 'yes']) }), req.body);
      const row = await getCampaignRow(db, req.params.id as string);
      if (!PUBLIC_STATUSES.includes(row.status)) throw forbidden();
      await db.query(
        `INSERT INTO feedback_votes (owner_key, campaign_id, question, answer) VALUES ($1,$2,$3,$4)
         ON CONFLICT (owner_key, campaign_id, question) DO UPDATE SET answer = EXCLUDED.answer`,
        [key, row.id, body.question, body.answer],
      );
      res.json((await getCampaignDetail(db, row.id, req.principal)).feedback);
    }),
  );

  r.post(
    '/campaigns/:id/report',
    ah(async (req, res) => {
      const key = requireKey(req);
      const body = parse(
        z.object({
          reason: z.enum(['misleading', 'hateful', 'spam', 'copyright', 'other']),
          details: z.string().max(1000).default(''),
        }),
        req.body,
      );
      const row = await getCampaignRow(db, req.params.id as string);
      await db.query(`INSERT INTO campaign_reports (id, campaign_id, owner_key, reason, details, at) VALUES ($1,$2,$3,$4,$5,$6)`, [
        newId(),
        row.id,
        key,
        body.reason,
        body.details,
        clock.now(),
      ]);
      res.status(201).json({ ok: true });
    }),
  );

  /* ---------- Contributions ---------- */

  r.post(
    '/contributions',
    ah(async (req, res) => {
      requireKey(req);
      const idem = req.header('idempotency-key');
      if (!idem || idem.length < 8 || idem.length > 100) throw badRequest('Missing Idempotency-Key header');
      const body = parse(contributionRequestSchema, req.body);
      res.status(201).json(await createContribution(db, req.principal, body, idem));
    }),
  );

  r.get(
    '/contributions/:id',
    ah(async (req, res) => {
      const key = requireKey(req);
      // Only the payment poll needs fresh state; settle any due payment, nothing else.
      await settleDuePayments(db);
      res.json(await getContribution(db, req.params.id as string, key));
    }),
  );

  /* ---------- Me ---------- */

  r.get(
    '/me/contributions',
    ah(async (req, res) => {
      const key = requireKey(req);
      void tick(db); // time-based rules run in the background; reads never wait for them
      res.json(await listContributions(db, key));
    }),
  );

  r.get(
    '/me/campaigns',
    ah(async (req, res) => {
      requireKey(req);
      void tick(db); // time-based rules run in the background; reads never wait for them
      res.json(await myCampaigns(db, req.principal));
    }),
  );

  r.get(
    '/me/saved',
    ah(async (req, res) => {
      const key = requireKey(req);
      const rows = await db.query(
        `SELECT c.* FROM saves s JOIN campaigns c ON c.id = s.campaign_id WHERE s.owner_key = $1 AND c.status = ANY($2::text[]) ORDER BY s.at DESC`,
        [key, PUBLIC_STATUSES],
      );
      res.json(rows.map((row) => toSummary(row)));
    }),
  );

  /* ---------- Activity ---------- */

  r.get(
    '/activity',
    ah(async (req, res) => {
      const key = requireKey(req);
      void tick(db); // time-based rules run in the background; reads never wait for them
      res.json(await listNotifications(db, key));
    }),
  );

  r.post(
    '/activity/read',
    ah(async (req, res) => {
      const key = requireKey(req);
      const body = parse(z.object({ ids: z.array(z.string().uuid()).max(200).optional() }), req.body ?? {});
      if (body.ids?.length) {
        await db.query('UPDATE notifications SET read_at = $3 WHERE owner_key = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL', [
          key,
          body.ids,
          clock.now(),
        ]);
      } else {
        await db.query('UPDATE notifications SET read_at = $2 WHERE owner_key = $1 AND read_at IS NULL', [key, clock.now()]);
      }
      res.json({ ok: true });
    }),
  );

  r.get(
    '/activity/prefs',
    ah(async (req, res) => {
      res.json(await getPrefs(db, requireKey(req)));
    }),
  );

  r.put(
    '/activity/prefs',
    ah(async (req, res) => {
      const key = requireKey(req);
      const body = parse(z.object({ category: z.enum(['review', 'funding', 'distribution', 'updates']), enabled: z.boolean() }), req.body);
      await setPref(db, key, body.category, body.enabled);
      res.json(await getPrefs(db, key));
    }),
  );

  /* ---------- Uploads & AI ---------- */

  r.post(
    '/uploads',
    upload.single('file'),
    ah(async (req, res) => {
      const key = requireKey(req);
      if (!req.file) throw badRequest('Choose a file to upload');
      res.status(201).json(await storeUpload(key, req.file));
    }),
  );

  r.get('/ai/status', (_req, res) => {
    res.json(aiStatus());
  });

  r.post(
    '/ai/draft',
    ah(async (req, res) => {
      requireKey(req);
      res.json(await draftFromInterview(parse(interviewSchema, req.body)));
    }),
  );

  r.post(
    '/ai/transcribe',
    audioUpload.single('audio'),
    ah(async (req, res) => {
      requireKey(req);
      if (!req.file) throw badRequest('No audio received');
      res.json({ text: await transcribe(req.file) });
    }),
  );

  return r;
}
