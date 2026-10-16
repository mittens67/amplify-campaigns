/**
 * End-to-end API smoke test. Runs the full lifecycle against a running server:
 *   API_URL=http://localhost:4000 npm run smoke -w @amplify/api
 * Note: mutates data. Reset afterwards with the reviewer "Reset demo data" control or `npm run seed`.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { emptyContent } from '@amplify/domain';

const API = process.env.API_URL ?? 'http://localhost:4000';
let failures = 0;
const ok = (cond: unknown, label: string) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures++;
};

async function call(method: string, path: string, opts: { token?: string; guest?: string; body?: unknown; idem?: string } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.guest ? { 'X-Guest-Id': opts.guest } : {}),
      ...(opts.idem ? { 'Idempotency-Key': opts.idem } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
}

const guest = randomBytes(16).toString('hex');

const health = await call('GET', '/health');
ok(health.status === 200, 'health check');

const list = await call('GET', '/campaigns?sort=almost');
ok(list.body.items.length > 0, `public feed lists ${list.body.items.length} campaigns`);
ok(list.body.items.every((c: any) => !['draft', 'submitted', 'changes_requested'].includes(c.status)), 'feed hides drafts and review queue');
const search = await call('GET', '/campaigns?q=library');
ok(search.body.items.length === 1, 'search narrows results');
const cat = await call('GET', '/campaigns?category=Health');
ok(cat.body.items.every((c: any) => c.category === 'Health'), 'category filter works');

const target = list.body.items.find((c: any) => c.status === 'available_for_funding');
const detail = await call('GET', `/campaigns/${target.id}`, { guest });
ok(!/@/.test(JSON.stringify(detail.body.publicBackers)) && !('draft' in detail.body), 'public detail exposes no emails or draft');

// Contributions as a guest
const idem = randomUUID();
const c1 = await call('POST', '/contributions', { guest, idem, body: { campaignId: target.id, amountCents: 1000, outcome: 'succeed' } });
ok(c1.status === 201 && c1.body.status === 'succeeded', 'guest contribution succeeds');
ok(c1.body.platformFeeCents === 200 && c1.body.adBudgetCents === 800 && c1.body.totalCents === 1059 && c1.body.estReach === 270, 'fee split $10 → $2 fee, $8 ads, $10.59 total, ≈270 people');
const c1b = await call('POST', '/contributions', { guest, idem, body: { campaignId: target.id, amountCents: 1000, outcome: 'succeed' } });
ok(c1b.body.id === c1.body.id, 'retry with same Idempotency-Key returns the same contribution');
const after = await call('GET', `/campaigns/${target.id}`, { guest });
ok(after.body.raisedCents === target.raisedCents + 1000, 'raised total increased exactly once');
const declined = await call('POST', '/contributions', { guest, idem: randomUUID(), body: { campaignId: target.id, amountCents: 500, outcome: 'decline' } });
ok(declined.body.status === 'failed' && declined.body.failureReason, 'declined card → failed with reason');
const cancelled = await call('POST', '/contributions', { guest, idem: randomUUID(), body: { campaignId: target.id, amountCents: 500, outcome: 'cancel' } });
ok(cancelled.body.status === 'cancelled', 'cancelled checkout → cancelled');
const pending = await call('POST', '/contributions', { guest, idem: randomUUID(), body: { campaignId: target.id, amountCents: 500, outcome: 'verify' } });
ok(pending.body.status === 'pending', 'verification → pending');
await new Promise((r) => setTimeout(r, 4500));
const settled = await call('GET', `/contributions/${pending.body.id}`, { guest });
ok(settled.body.status === 'succeeded', 'pending payment settles after verification');
const bad = await call('POST', '/contributions', { guest, idem: randomUUID(), body: { campaignId: target.id, amountCents: 50 } });
ok(bad.status === 400 && bad.body.error.fields?.amountCents, 'amount below $1 rejected with field error');

// Roles
const reviewQ = await call('GET', '/review/queue', { guest });
ok(reviewQ.status === 401, 'review queue requires sign-in');
const creator = (await call('POST', '/auth/demo', { guest, body: { as: 'creator' } })).body;
const creatorReview = await call('GET', '/review/queue', { token: creator.token });
ok(creatorReview.status === 403, 'creator gets 403 on reviewer routes');
const reviewer = (await call('POST', '/auth/demo', { body: { as: 'reviewer' } })).body;
ok(reviewer.user.role === 'reviewer', 'reviewer demo login');

// Guest claim: the guest's contributions now belong to the creator account they signed into
const mine = await call('GET', '/me/contributions', { token: creator.token });
ok(mine.body.some((c: any) => c.id === c1.body.id), 'guest contributions are claimed on sign-in');

// Draft → submit validation → full submit
const created = await call('POST', '/campaigns', { token: creator.token, body: { content: {} } });
ok(created.status === 201, 'create draft');
const incomplete = await call('POST', `/campaigns/${created.body.id}/submit`, { token: creator.token });
ok(incomplete.status === 400 && incomplete.body.error.fields['basics.title'], 'incomplete submit returns field errors');
const content = emptyContent();
content.basics = { ...content.basics, title: 'Smoke test campaign', category: 'Community', creatorName: 'Smoke Co', creatorType: 'organization', summary: 'Testing', cover: { url: 'https://example.com/a.jpg', kind: 'image' } };
content.story = { ...content.story, intro: 'Hello world', sources: [{ id: 's1', title: 'Source', url: 'https://example.com' }] };
content.visuals = { ...content.visuals, adImages: [{ url: 'https://example.com/b.jpg', kind: 'image' }], cta: 'Learn more' };
content.reach = { ...content.reach, locations: ['Ohio'], channels: ['meta'], split: { meta: 100 }, durationDays: 7 };
content.submit = { goalCents: 10000, acceptedRules: true, acceptedFunding: true };
const saved = await call('PUT', `/campaigns/${created.body.id}/draft`, { token: creator.token, body: { content, version: created.body.version } });
ok(saved.status === 200 && saved.body.version === created.body.version + 1, 'autosave bumps version');
const stale = await call('PUT', `/campaigns/${created.body.id}/draft`, { token: creator.token, body: { content, version: created.body.version - 1 } });
ok(stale.status === 409, 'stale autosave rejected');
const submitted = await call('POST', `/campaigns/${created.body.id}/submit`, { token: creator.token });
ok(submitted.body.status === 'submitted', 'submit for review');
const locked = await call('PUT', `/campaigns/${created.body.id}/draft`, { token: creator.token, body: { content, version: saved.body.version } });
ok(locked.status === 409, 'content locked while under review');

// Review
const noLayers = await call('POST', `/review/campaigns/${created.body.id}/decision`, { token: reviewer.token, body: { decision: 'approve', layers: [] } });
ok(noLayers.status === 400, 'approve requires all three review layers');
const layers = ['fact_check', 'integrity', 'shared_reality'].map((layer) => ({ layer, outcome: 'pass', notes: 'ok' }));
const approved = await call('POST', `/review/campaigns/${created.body.id}/decision`, { token: reviewer.token, body: { decision: 'approve', layers } });
ok(approved.body.status === 'available_for_funding', 'approve → available for funding');
ok(approved.body.timeline.some((e: any) => e.to === 'approved'), 'timeline records the approval');

// Fund to goal; next contribution is refused; funding ≠ launch
const backer = (await call('POST', '/auth/demo', { body: { as: 'backer' } })).body;
const full = await call('POST', '/contributions', { token: backer.token, idem: randomUUID(), body: { campaignId: created.body.id, amountCents: 10000 } });
ok(full.body.status === 'succeeded', 'contribution reaching the goal');
const funded = await call('GET', `/campaigns/${created.body.id}`, { token: backer.token });
ok(funded.body.status === 'goal_reached', 'goal reached — but not launched');
const late = await call('POST', '/contributions', { token: backer.token, idem: randomUUID(), body: { campaignId: created.body.id, amountCents: 500 } });
ok(late.status === 409, 'contributions after funding closes → 409');

// Distribution
const launchEarly = await call('POST', `/review/campaigns/${created.body.id}/launch`, { token: reviewer.token, body: { adSetupConfirmed: true } });
ok(launchEarly.status === 409, 'cannot launch before distribution preparation');
await call('POST', `/review/campaigns/${created.body.id}/prepare`, { token: reviewer.token, body: {} });
const noConfirm = await call('POST', `/review/campaigns/${created.body.id}/launch`, { token: reviewer.token, body: {} });
ok(noConfirm.status === 400, 'launch requires ad setup confirmation');
const launched = await call('POST', `/review/campaigns/${created.body.id}/launch`, { token: reviewer.token, body: { adSetupConfirmed: true } });
ok(launched.body.status === 'promoting', 'launch → promoting');
await call('POST', '/demo/advance', { token: reviewer.token, body: { days: 3 } });
const mid = await call('GET', `/campaigns/${created.body.id}/analytics`, { token: creator.token });
ok(mid.body.delivery.daily.length === 3 && mid.body.delivery.impressions > 0, 'advancing the demo clock delivers simulated ad days');
const done = await call('POST', `/review/campaigns/${created.body.id}/finish`, { token: reviewer.token, body: {} });
ok(done.body.status === 'completed', 'finish run → completed');
const report = await call('GET', `/campaigns/${created.body.id}/analytics`, { token: creator.token });
ok(report.body.delivery.spentCents === report.body.funding.adBudgetCents, 'entire ad budget spent and reported');
const backerNotes = await call('GET', '/activity', { token: backer.token });
ok(backerNotes.body.some((n: any) => n.type === 'report_ready' && n.campaignId === created.body.id), 'backer notified that the report is ready');
const analyticsForbidden = await call('GET', `/campaigns/${created.body.id}/analytics`, { token: backer.token });
ok(analyticsForbidden.status === 403, 'analytics restricted to the creator');

await call('POST', '/demo/advance', { token: reviewer.token, body: { days: 0 + 1 } }).catch(() => undefined);
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
