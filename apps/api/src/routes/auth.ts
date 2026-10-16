import { Router } from 'express';
import { z } from 'zod';
import type { Db, Queryable } from '../db/index.js';
import { hashPassword, newId, requireUser, signToken, toUserDTO, verifyPassword } from '../lib/auth.js';
import { ah, conflict, notFound, parse, unauthorized } from '../lib/errors.js';
import { notify } from '../services/notifications.js';
import { clock } from '../lib/clock.js';

export const DEMO_ACCOUNTS = {
  creator: { email: 'maya@demo.amplify', name: 'Maya Okafor', role: 'user' as const },
  backer: { email: 'sam@demo.amplify', name: 'Sam Rivera', role: 'user' as const },
  reviewer: { email: 'reviewer@demo.amplify', name: 'Priya Natarajan', role: 'reviewer' as const },
};
export const DEMO_PASSWORD = 'amplify-demo';

/** Move everything a guest created on this device into their account. */
export async function claimGuest(q: Queryable, guestId: string | null, userId: string) {
  if (!guestId) return;
  const g = `g:${guestId}`;
  const u = `u:${userId}`;
  await q.query('UPDATE campaigns SET creator_key = $2, creator_user_id = $3 WHERE creator_key = $1', [g, u, userId]);
  await q.query('UPDATE contributions SET owner_key = $2, user_id = $3 WHERE owner_key = $1', [g, u, userId]);
  for (const table of ['follows', 'saves']) {
    await q.query(
      `INSERT INTO ${table} (owner_key, campaign_id, at) SELECT $2, campaign_id, at FROM ${table} WHERE owner_key = $1 ON CONFLICT DO NOTHING`,
      [g, u],
    );
    await q.query(`DELETE FROM ${table} WHERE owner_key = $1`, [g]);
  }
  await q.query(
    `INSERT INTO feedback_votes (owner_key, campaign_id, question, answer)
       SELECT $2, campaign_id, question, answer FROM feedback_votes WHERE owner_key = $1 ON CONFLICT DO NOTHING`,
    [g, u],
  );
  await q.query('DELETE FROM feedback_votes WHERE owner_key = $1', [g]);
  await q.query(
    `INSERT INTO notifications (id, owner_key, type, audience, campaign_id, title, body, dedupe_key, read_at, at)
       SELECT gen_random_uuid(), $2, type, audience, campaign_id, title, body, dedupe_key, read_at, at FROM notifications WHERE owner_key = $1
       ON CONFLICT DO NOTHING`,
    [g, u],
  );
  await q.query('DELETE FROM notifications WHERE owner_key = $1', [g]);
}

async function session(db: Db, user: any, guestId: string | null) {
  await db.tx(async (t) => {
    await claimGuest(t, guestId, user.id);
    await notify(t, [`u:${user.id}`], {
      type: 'security',
      audience: 'account',
      title: 'New sign-in',
      body: 'Your account was signed in on a new device. If this wasn’t you, change your password.',
      dedupeKey: `signin:${clock.now().toISOString().slice(0, 13)}`,
    });
  });
  return { token: signToken(user), user: toUserDTO(user) };
}

const credentials = z.object({
  email: z.email('Enter a valid email').transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export function authRoutes(db: Db) {
  const r = Router();

  r.post(
    '/auth/signup',
    ah(async (req, res) => {
      const body = parse(credentials.extend({ name: z.string().trim().min(1, 'Add your name').max(60) }), req.body);
      const [exists] = await db.query('SELECT 1 FROM users WHERE email = $1', [body.email]);
      if (exists) throw conflict('EMAIL_TAKEN', 'An account with that email already exists. Sign in instead.');
      const [user] = await db.query(
        `INSERT INTO users (id, email, password_hash, name) VALUES ($1,$2,$3,$4) RETURNING *`,
        [newId(), body.email, await hashPassword(body.password), body.name],
      );
      res.status(201).json(await session(db, user, req.principal.guestId));
    }),
  );

  r.post(
    '/auth/login',
    ah(async (req, res) => {
      const body = parse(credentials, req.body);
      const [user] = await db.query('SELECT * FROM users WHERE email = $1', [body.email]);
      if (!user || !(await verifyPassword(body.password, user.password_hash))) {
        throw unauthorized('That email and password don’t match.');
      }
      res.json(await session(db, user, req.principal.guestId));
    }),
  );

  // One-tap demo accounts so judges can switch between creator, backer and reviewer.
  r.post(
    '/auth/demo',
    ah(async (req, res) => {
      const { as } = parse(z.object({ as: z.enum(['creator', 'backer', 'reviewer']) }), req.body);
      const [user] = await db.query('SELECT * FROM users WHERE email = $1', [DEMO_ACCOUNTS[as].email]);
      if (!user) throw notFound('Demo account');
      res.json(await session(db, user, req.principal.guestId));
    }),
  );

  r.get(
    '/me',
    ah(async (req, res) => {
      const id = requireUser(req);
      const [user] = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      if (!user) throw unauthorized();
      res.json(toUserDTO(user));
    }),
  );

  r.patch(
    '/me',
    ah(async (req, res) => {
      const id = requireUser(req);
      const body = parse(
        z.object({ name: z.string().trim().min(1).max(60).optional(), showNameDefault: z.boolean().optional() }),
        req.body,
      );
      const [user] = await db.query(
        `UPDATE users SET name = COALESCE($2, name), show_name_default = COALESCE($3, show_name_default) WHERE id = $1 RETURNING *`,
        [id, body.name ?? null, body.showNameDefault ?? null],
      );
      res.json(toUserDTO(user));
    }),
  );

  return r;
}
