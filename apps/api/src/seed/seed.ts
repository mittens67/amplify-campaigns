import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { emptyContent, quote, CURRENT_REACH_MODEL, type Block, type CampaignContent } from '@amplify/domain';
import type { Db, Queryable } from '../db/index.js';
import { hashPassword, newId } from '../lib/auth.js';
import { clock, days } from '../lib/clock.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../routes/auth.js';
import { finishDistribution, tick } from '../services/engine.js';
import { notify } from '../services/notifications.js';
import { transitionCampaign } from '../services/transitions.js';
import { BACKER_NAMES, SEED, type SeedSpec } from './data.js';

const here = dirname(fileURLToPath(import.meta.url));
type Img = { url: string; width: number; height: number; credit: string };
const IMAGES: Record<string, Img[]> = JSON.parse(readFileSync(join(here, 'images.json'), 'utf8'));

/** Deterministic pseudo-random numbers so the demo looks the same after every reset. */
function rng(seed: string) {
  let i = 0;
  return () => {
    const h = createHash('sha256').update(`${seed}:${i++}`).digest();
    return h.readUInt32BE(0) / 0xffffffff;
  };
}

function buildContent(spec: SeedSpec): CampaignContent {
  const c = emptyContent();
  const imgs = IMAGES[spec.img] ?? [];
  const asset = (img?: Img) => (img ? { url: img.url, kind: 'image' as const, width: img.width, height: img.height } : undefined);
  const sources = spec.sources.map((s, i) => ({ id: `${spec.key}-s${i + 1}`, ...s }));
  const sid = (cite?: number[]) => (cite ?? []).map((n) => sources[n - 1]?.id).filter(Boolean) as string[];

  const blocks: Block[] = [];
  spec.sections.forEach((s, i) => {
    if (s.heading) blocks.push({ id: `${spec.key}-h${i}`, type: 'heading', text: s.heading });
    blocks.push({ id: `${spec.key}-p${i}`, type: 'paragraph', text: s.text, sourceIds: sid(s.cite) });
    if (i === 0 && spec.stat) {
      blocks.push({ id: `${spec.key}-stat`, type: 'stat', value: spec.stat.value, text: spec.stat.text, sourceIds: sid(spec.stat.cite) });
    }
    if (i === 0 && imgs[1]) {
      blocks.push({ id: `${spec.key}-img`, type: 'image', image: asset(imgs[1]), caption: spec.headline, credit: imgs[1].credit });
    }
  });
  if (spec.quote) blocks.push({ id: `${spec.key}-q`, type: 'quote', text: spec.quote.text, attribution: spec.quote.attribution });

  c.basics = {
    ...c.basics,
    title: spec.title,
    category: spec.category,
    creatorName: spec.creatorName,
    creatorType: spec.creatorType,
    summary: spec.summary,
    cover: asset(imgs[0]),
    prompts: { about: spec.summary, audience: spec.reach.locations.join(', '), why: spec.intro, evidence: spec.sources.map((s) => s.publisher).join(', ') },
  };
  c.story = { headline: spec.headline, intro: spec.intro, blocks, sources, actions: spec.actions };
  c.visuals = {
    adImages: [asset(imgs[2] ?? imgs[0])].filter(Boolean) as any,
    adHeadline: spec.ad.headline,
    adDescription: spec.ad.description,
    cta: spec.ad.cta,
  };
  c.reach = {
    locations: spec.reach.locations,
    interests: spec.reach.interests,
    channels: spec.reach.channels,
    split: spec.reach.split as Record<string, number>,
    durationDays: spec.reach.durationDays,
    ageMin: spec.reach.ageMin ?? 18,
    ageMax: spec.reach.ageMax ?? 65,
  };
  c.submit = { goalCents: spec.goal * 100, acceptedRules: spec.goal > 0, acceptedFunding: spec.goal > 0 };
  if (spec.plan.kind === 'draft') {
    // A realistic half-finished draft: basics done, story started.
    c.visuals = { adImages: [], adHeadline: '', adDescription: '', cta: 'Learn more' };
    c.story.blocks = [];
    c.submit = { acceptedRules: false, acceptedFunding: false };
  }
  return c;
}

const AMOUNTS = [5, 10, 10, 10, 15, 20, 25, 25, 25, 30, 50, 50, 75, 100, 100, 150, 250];

/**
 * Insert a believable set of successful contributions totalling `targetCents`, spread between
 * two dates, computing every fee split through the same `quote()` the live checkout uses.
 */
async function bulkContribute(
  q: Queryable,
  campaign: any,
  targetCents: number,
  from: Date,
  to: Date,
  sam: { id: string; amount: number } | null,
) {
  const r = rng(campaign.id);
  type Row = { owner: string; userId: string | null; amount: number; at: Date; name: string | null };
  const rows: Row[] = [];
  let total = 0;
  let n = 0;
  const samAt = sam ? Math.floor(r() * 2) : -1;
  while (total < targetCents) {
    let amount: number;
    let owner: string;
    let userId: string | null = null;
    if (n === samAt && sam) {
      amount = sam.amount * 100;
      owner = `u:${sam.id}`;
      userId = sam.id;
    } else {
      amount = AMOUNTS[Math.floor(r() * AMOUNTS.length)] * 100;
      owner = `g:seed${campaign.id.slice(0, 8)}${n}`;
    }
    if (total + amount > targetCents && targetCents - total >= 100 && owner.startsWith('g:')) amount = targetCents - total;
    rows.push({ owner, userId, amount, at: new Date(0), name: r() < 0.3 ? BACKER_NAMES[Math.floor(r() * BACKER_NAMES.length)] : null });
    total += amount;
    n++;
  }
  const span = to.getTime() - from.getTime();
  const stamps = rows.map(() => from.getTime() + Math.pow(r(), 0.8) * span).sort((a, b) => a - b);
  rows.forEach((row, i) => (row.at = new Date(stamps[i])));

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const params: unknown[] = [];
    const values = chunk.map((row) => {
      const qt = quote(row.amount, CURRENT_REACH_MODEL.peoplePerAdDollar);
      const v = [
        newId(),
        'AMP-' + createHash('md5').update(row.owner + row.at.toISOString()).digest('hex').slice(0, 8).toUpperCase(),
        campaign.id,
        row.owner,
        row.userId,
        qt.amountCents,
        qt.platformFeeCents,
        qt.adBudgetCents,
        qt.processingCents,
        qt.totalCents,
        qt.estReach,
        row.name,
        newId(),
        row.at,
      ];
      const base = params.length;
      params.push(...v);
      return `(${v.map((_, j) => `$${base + j + 1}`).join(',')},'succeeded','sim_seed')`;
    });
    await q.query(
      `INSERT INTO contributions (id, receipt_no, campaign_id, owner_key, user_id, amount_cents, platform_fee_cents, ad_budget_cents,
         processing_cents, total_cents, est_reach, public_name, idempotency_key, created_at, status, provider_ref)
       VALUES ${values.join(',')}`,
      params,
    );
  }
  const owners = new Set(rows.map((x) => x.owner));
  await q.query('UPDATE campaigns SET raised_cents = $2, backer_count = $3 WHERE id = $1', [campaign.id, total, owners.size]);
  if (sam && rows.some((x) => x.userId === sam.id)) {
    await q.query('INSERT INTO follows (owner_key, campaign_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [`u:${sam.id}`, campaign.id]);
  }

  // Milestone updates at the moment each threshold was crossed.
  let running = 0;
  const goal = campaign.goal_cents;
  for (const row of rows) {
    const before = Math.floor((running / goal) * 100);
    running += row.amount;
    const after = Math.floor((running / goal) * 100);
    for (const m of [25, 50, 75]) {
      if (before < m && after >= m) {
        clock.freeze(row.at);
        await q.query(`INSERT INTO campaign_updates (id, campaign_id, kind, title, body, at) VALUES ($1,$2,'milestone',$3,$4,$5)`, [
          newId(),
          campaign.id,
          `${m}% funded`,
          `Backers have funded ${m}% of the distribution goal.`,
          row.at,
        ]);
        await notify(q, [campaign.creator_key], {
          type: 'milestone',
          audience: 'creator',
          campaignId: campaign.id,
          title: `${m}% funded`,
          body: `“${campaign.draft_content.basics.title}” is ${m}% of the way to its distribution goal.`,
          dedupeKey: `${campaign.id}:milestone:${m}`,
        });
      }
    }
  }
  return total;
}

async function upsertUser(q: Queryable, email: string, name: string, role: 'user' | 'reviewer', hash: string) {
  const [u] = await q.query(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash RETURNING *`,
    [newId(), email, hash, name, role],
  );
  return u;
}

async function seedCampaign(db: Db, spec: SeedSpec, ctx: { now: number; maya: any; sam: any; reviewer: any; orgs: Map<string, any> }) {
  const at = (daysAgo: number) => {
    const d = new Date(ctx.now - days(daysAgo));
    clock.freeze(d);
    return d;
  };
  const owner = spec.owner === 'maya' ? ctx.maya : ctx.orgs.get(spec.orgEmail!);
  const key = `u:${owner.id}`;
  const creator = { role: 'creator' as const, key };
  const reviewer = { role: 'reviewer' as const, key: `u:${ctx.reviewer.id}` };
  const content = buildContent(spec);
  const plan = spec.plan;

  const createdDaysAgo =
    plan.kind === 'draft'
      ? plan.ageDays
      : 'approvedDaysAgo' in plan
        ? plan.approvedDaysAgo + 3
        : plan.submittedDaysAgo + 1.5;
  const created = at(createdDaysAgo);
  const id = newId();
  await db.query(
    `INSERT INTO campaigns (id, creator_key, creator_user_id, draft_content, current_step, goal_cents, featured, is_demo,
       created_at, updated_at, status_changed_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,true,$8,$8,$8)`,
    [id, key, owner.id, JSON.stringify(content), plan.kind === 'draft' ? plan.step : 'submit', spec.goal * 100, !!spec.featured, created],
  );
  await db.query(
    `INSERT INTO campaign_events (id, campaign_id, event, from_status, to_status, actor_key, actor_role, at)
     VALUES ($1,$2,'create',NULL,'draft',$3,'creator',$4)`,
    [newId(), id, key, created],
  );
  if (plan.kind === 'draft') return;

  const submittedDaysAgo = 'submittedDaysAgo' in plan ? plan.submittedDaysAgo : plan.approvedDaysAgo + 2;
  at(submittedDaysAgo);
  await db.tx((t) => transitionCampaign(t, id, 'submit', creator));
  if (plan.kind === 'submitted') return;

  const review = async (outcomes: [string, string][], daysAgo: number) => {
    at(daysAgo);
    for (const [layer, outcome] of outcomes) {
      await db.query(
        `INSERT INTO reviews (id, campaign_id, round, layer, outcome, notes, reviewer_id, at) VALUES ($1,$2,1,$3,$4,$5,$6,$7)`,
        [
          newId(),
          id,
          layer,
          outcome,
          outcome === 'pass' ? REVIEW_NOTES[layer] : 'A key statistic is not yet supported by a cited source.',
          ctx.reviewer.id,
          clock.now(),
        ],
      );
    }
  };

  if (plan.kind === 'changes') {
    await review(
      [
        ['fact_check', 'concern'],
        ['integrity', 'pass'],
        ['shared_reality', 'pass'],
      ],
      plan.submittedDaysAgo - 1,
    );
    await db.query('UPDATE campaigns SET reviewer_notes = $2::jsonb, reviewer_message = $3 WHERE id = $1', [
      id,
      JSON.stringify(plan.notes),
      plan.message,
    ]);
    await db.tx((t) => transitionCampaign(t, id, 'request_changes', reviewer, { note: plan.message }));
    return;
  }

  await review(
    [
      ['fact_check', 'pass'],
      ['integrity', 'pass'],
      ['shared_reality', 'pass'],
    ],
    plan.approvedDaysAgo + 0.2,
  );
  const approved = at(plan.approvedDaysAgo);
  await db.tx((t) => transitionCampaign(t, id, 'approve', reviewer, { note: 'Meets review standards' }));
  const [row] = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  const sam = spec.samBacks ? { id: ctx.sam.id, amount: spec.samBacks } : null;

  if (plan.kind === 'funding') {
    await db.tx((t) => bulkContribute(t, row, Math.round((spec.goal * plan.pct) / 100) * 100, approved, new Date(ctx.now - days(0.05)), sam));
    return;
  }
  if (plan.kind === 'failed') {
    await db.tx((t) => bulkContribute(t, row, plan.raisedCents, approved, new Date(ctx.now - days(6)), sam));
    return; // the final tick closes funding below the minimum → refund
  }

  // Fully funded paths.
  const funded = new Date(ctx.now - days(plan.fundedDaysAgo));
  await db.tx((t) => bulkContribute(t, row, spec.goal * 100, approved, funded, sam));
  at(plan.fundedDaysAgo);
  await db.tx(async (t) => {
    await t.query(`INSERT INTO campaign_updates (id, campaign_id, kind, title, body, at) VALUES ($1,$2,'milestone',$3,$4,$5)`, [
      newId(),
      id,
      'Fully funded',
      'The distribution goal was reached. Ad setup comes next.',
      clock.now(),
    ]);
    await transitionCampaign(t, id, 'goal_reached', { role: 'system' });
  });
  at(plan.fundedDaysAgo - 0.5);
  await db.tx((t) => transitionCampaign(t, id, 'prepare', reviewer, { note: 'Targeting and placements finalised' }));
  if (plan.kind === 'prep') return;

  at(plan.launchedDaysAgo);
  await db.query('UPDATE campaigns SET ad_setup_confirmed = true WHERE id = $1', [id]);
  await db.tx((t) => transitionCampaign(t, id, 'launch', reviewer, { note: 'Ad setup confirmed; ads launched' }));
  if (spec.key === 'heat') {
    at(plan.launchedDaysAgo - 2);
    await db.query(`INSERT INTO campaign_updates (id, campaign_id, kind, title, body, at) VALUES ($1,$2,'creator',$3,$4,$5)`, [
      newId(),
      id,
      'Our first ads are running in Phoenix and Houston',
      'Thank you to every backer. The first week of ads is focused on construction and delivery workers. We’ll share measured reach as it comes in.',
      clock.now(),
    ]);
  }
  if (plan.kind === 'completed') {
    at(plan.launchedDaysAgo - spec.reach.durationDays);
    await finishDistribution(db, id, reviewer.key);
  }
}

const REVIEW_NOTES: Record<string, string> = {
  fact_check: 'Claims match the cited sources. Statistics are attributed.',
  integrity: 'Framing is calm and specific; no misleading emphasis.',
  shared_reality: 'Practical, non-partisan call to action that people across views can act on.',
};

/** Reset all campaign data to the demo baseline. Demo user accounts keep their ids. */
export async function seedDemo(db: Db) {
  const started = Date.now();
  await clock.reset(db);
  clock.freeze(null);
  const now = Date.now();
  await db.exec(
    `TRUNCATE campaigns, campaign_events, reviews, contributions, distribution_metrics, campaign_updates, notifications,
       notification_prefs, follows, saves, feedback_votes, campaign_reports CASCADE`,
  );
  const hash = await hashPassword(DEMO_PASSWORD);
  const maya = await upsertUser(db, DEMO_ACCOUNTS.creator.email, DEMO_ACCOUNTS.creator.name, 'user', hash);
  const sam = await upsertUser(db, DEMO_ACCOUNTS.backer.email, DEMO_ACCOUNTS.backer.name, 'user', hash);
  const reviewer = await upsertUser(db, DEMO_ACCOUNTS.reviewer.email, DEMO_ACCOUNTS.reviewer.name, 'reviewer', hash);
  const orgs = new Map<string, any>();
  for (const s of SEED) {
    if (s.orgEmail && !orgs.has(s.orgEmail)) orgs.set(s.orgEmail, await upsertUser(db, s.orgEmail, s.creatorName, 'user', hash));
  }
  try {
    for (const spec of SEED) await seedCampaign(db, spec, { now, maya, sam, reviewer, orgs });
  } finally {
    clock.freeze(null);
  }

  // Audience feedback and a moderation report so every screen has realistic content.
  const r = rng('feedback');
  const live = await db.query(`SELECT id FROM campaigns WHERE status IN ('available_for_funding','promoting','completed','distribution_preparation')`);
  for (const c of live) {
    const voters = 12 + Math.floor(r() * 30);
    const keys: string[] = [];
    const questions: string[] = [];
    const answers: string[] = [];
    for (let i = 0; i < voters; i++) {
      for (const question of ['visuals', 'mind']) {
        const x = r();
        keys.push(`g:fb${i}`);
        questions.push(question);
        answers.push(x < 0.15 ? 'no' : x < 0.55 ? 'somewhat' : 'yes');
      }
    }
    await db.query(
      `INSERT INTO feedback_votes (owner_key, campaign_id, question, answer)
       SELECT k, $2, q, a FROM unnest($1::text[], $3::text[], $4::text[]) AS t(k, q, a) ON CONFLICT DO NOTHING`,
      [keys, c.id, questions, answers],
    );
  }
  const [housing] = await db.query(`SELECT id FROM campaigns WHERE draft_content->'basics'->>'title' LIKE 'Rent is eating%'`);
  if (housing) {
    await db.query(`INSERT INTO campaign_reports (id, campaign_id, owner_key, reason, details, at) VALUES ($1,$2,$3,'misleading',$4,$5)`, [
      newId(),
      housing.id,
      'g:reporter1',
      'The parking concerns are mentioned but not linked to any source.',
      new Date(now - days(0.5)),
    ]);
  }
  await db.query(`INSERT INTO saves (owner_key, campaign_id) SELECT $1, id FROM campaigns WHERE featured LIMIT 2 ON CONFLICT DO NOTHING`, [
    `u:${sam.id}`,
  ]);

  await tick(db, true);
  console.log(`[seed] demo data ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
