import { describe, expect, it } from 'vitest';
import {
  attributedReach,
  canTransition,
  emptyContent,
  estimateReach,
  estimateReachAtGoal,
  journeyPosition,
  normalizeContent,
  peoplePerContributedDollar,
  quote,
  validateAll,
  validateStep,
  CAMPAIGN_STATUSES,
  TRANSITIONS,
  effectiveAdHeadline,
} from './index';

describe('quote', () => {
  it('splits $10 into 20% fee and 80% ad budget with processing on top', () => {
    const q = quote(1000, 33.75);
    expect(q).toEqual({
      amountCents: 1000,
      platformFeeCents: 200,
      adBudgetCents: 800,
      processingCents: 59,
      totalCents: 1059,
      estReach: 270,
    });
  });

  it('fee parts always sum exactly to the amount', () => {
    for (let a = 100; a < 20000; a += 37) {
      const q = quote(a, 33.75);
      expect(q.platformFeeCents + q.adBudgetCents).toBe(a);
      expect(q.totalCents).toBe(a + q.processingCents);
    }
  });

  it('reach headline numbers are consistent', () => {
    expect(peoplePerContributedDollar()).toBe(27);
    expect(estimateReach(1000)).toBe(270);
    expect(estimateReachAtGoal(1_000_000)).toBe(270_000);
  });

  it('attributes reach proportionally', () => {
    expect(attributedReach(2500, 10000, 40000)).toBe(10000);
    expect(attributedReach(100, 0, 500)).toBe(0);
  });
});

describe('lifecycle', () => {
  const ctx = { raisedCents: 0, goalCents: 100000 };

  it('follows the happy path', () => {
    const path: [string, string, any, any?][] = [
      ['draft', 'submit', 'creator'],
      ['submitted', 'approve', 'reviewer', { reviewComplete: true }],
      ['approved', 'open_funding', 'system'],
      ['available_for_funding', 'goal_reached', 'system', { raisedCents: 100000 }],
      ['goal_reached', 'prepare', 'reviewer'],
      ['distribution_preparation', 'launch', 'reviewer', { adSetupConfirmed: true }],
      ['promoting', 'complete', 'system'],
    ];
    for (const [from, ev, actor, extra] of path) {
      const r = canTransition(from as any, ev as any, actor, { ...ctx, ...extra });
      expect(r.ok, `${from} --${ev}-->`).toBe(true);
    }
  });

  it('funding goal never auto-launches', () => {
    expect(TRANSITIONS.goal_reached.to).toBe('goal_reached');
    const r = canTransition('distribution_preparation', 'launch', 'reviewer', { ...ctx, adSetupConfirmed: false });
    expect(r.ok).toBe(false);
  });

  it('rejects wrong actors and states', () => {
    expect(canTransition('submitted', 'approve', 'creator', ctx)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(canTransition('draft', 'approve', 'reviewer', ctx)).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    expect(canTransition('submitted', 'approve', 'reviewer', { ...ctx, reviewComplete: false })).toMatchObject({
      ok: false,
      code: 'GUARD',
    });
  });

  it('period end picks funding_ended or failed by minimum ad budget', () => {
    const enough = { raisedCents: 12500, goalCents: 100000 }; // ad budget exactly $100
    const short = { raisedCents: 12400, goalCents: 100000 };
    expect(canTransition('available_for_funding', 'period_ended', 'system', enough).ok).toBe(true);
    expect(canTransition('available_for_funding', 'funding_failed', 'system', enough).ok).toBe(false);
    expect(canTransition('available_for_funding', 'period_ended', 'system', short).ok).toBe(false);
    expect(canTransition('available_for_funding', 'funding_failed', 'system', short).ok).toBe(true);
  });

  it('every status has a journey position', () => {
    for (const s of CAMPAIGN_STATUSES) expect(journeyPosition(s)).toBeDefined();
  });
});

describe('content', () => {
  it('empty content has defaults in every section', () => {
    const c = emptyContent();
    expect(c.basics.title).toBe('');
    expect(c.basics.prompts.about).toBe('');
    expect(c.story.blocks).toEqual([]);
    expect(c.visuals.cta).toBe('Learn more');
    expect(c.reach.durationDays).toBe(30);
  });

  it('a malformed section does not wipe the rest of the draft', () => {
    const c = normalizeContent({ basics: { title: 'Keep me', category: 'Not a category' }, story: { intro: 'Hi' } });
    expect(c.story.intro).toBe('Hi');
  });

  it('half-typed sources survive as drafts but fail validation', () => {
    const c = normalizeContent({ story: { intro: 'x', sources: [{ id: 's1', title: 'CDC', url: 'htt' }] } });
    expect(c.story.sources[0].url).toBe('htt');
    expect(validateStep('story', c)['story.sources.0.url']).toBeDefined();
  });

  it('validates required basics', () => {
    const e = validateStep('basics', emptyContent());
    expect(Object.keys(e)).toEqual(
      expect.arrayContaining(['basics.title', 'basics.category', 'basics.creatorName', 'basics.creatorType']),
    );
  });

  it('enforces the 60 character title limit', () => {
    const c = emptyContent();
    c.basics.title = 'x'.repeat(61);
    expect(validateStep('basics', c)['basics.title']).toMatch(/60/);
  });

  it('requires budget split to total 100', () => {
    const c = emptyContent();
    c.reach.locations = ['Ohio'];
    c.reach.channels = ['meta', 'youtube'];
    c.reach.split = { meta: 60, youtube: 30 };
    expect(validateStep('reach', c)['reach.split']).toMatch(/90/);
    c.reach.split.youtube = 40;
    expect(validateStep('reach', c)['reach.split']).toBeUndefined();
  });

  it('goal must be set by the creator', () => {
    expect(validateAll(emptyContent())['submit.goalCents']).toBeDefined();
  });

  it('falls back to the title start for the ad headline', () => {
    const c = emptyContent();
    c.basics.title = 'Clean rivers need neighbours who show up every single weekend';
    expect(effectiveAdHeadline(c).length).toBeLessThanOrEqual(40);
    c.visuals.adHeadline = 'Custom';
    expect(effectiveAdHeadline(c)).toBe('Custom');
  });
});
