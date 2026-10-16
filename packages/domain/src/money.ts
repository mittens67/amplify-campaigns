/**
 * Money model. All amounts are integer cents.
 *
 * A backer chooses an amount A (the contribution). Of A:
 *   - 20% is the platform fee
 *   - the remainder (80%) is the advertising budget
 * Payment processing (2.9% + 30¢) is added on top, so the backer pays A + processing.
 */

export const FEES = {
  platformFeeBps: 2000, // 20%
  processingBps: 290, // 2.9%
  processingFixedCents: 30,
} as const;

export const CONTRIBUTION_LIMITS = {
  minCents: 100, // $1
  maxCents: 1_000_000, // $10,000
  presetsCents: [500, 1000, 2500, 5000],
} as const;

/** Round half up for non-negative values. */
function bps(amountCents: number, basisPoints: number): number {
  return Math.floor((amountCents * basisPoints + 5000) / 10000);
}

export interface Quote {
  amountCents: number;
  platformFeeCents: number;
  adBudgetCents: number;
  processingCents: number;
  totalCents: number;
  estReach: number;
}

export function platformFee(amountCents: number): number {
  return bps(amountCents, FEES.platformFeeBps);
}

export function adBudget(amountCents: number): number {
  return amountCents - platformFee(amountCents);
}

export function processingFee(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return bps(amountCents, FEES.processingBps) + FEES.processingFixedCents;
}

export function quote(amountCents: number, peoplePerAdDollar: number): Quote {
  const amount = Math.max(0, Math.round(amountCents));
  const platformFeeCents = platformFee(amount);
  const adBudgetCents = amount - platformFeeCents;
  const processingCents = processingFee(amount);
  return {
    amountCents: amount,
    platformFeeCents,
    adBudgetCents,
    processingCents,
    totalCents: amount + processingCents,
    estReach: Math.round((adBudgetCents / 100) * peoplePerAdDollar),
  };
}

export function formatMoney(cents: number, opts: { compact?: boolean; cents?: boolean } = {}): string {
  const dollars = cents / 100;
  if (opts.compact && Math.abs(dollars) >= 1000) {
    return '$' + formatCompact(dollars);
  }
  const showCents = opts.cents ?? cents % 100 !== 0;
  return (
    '$' +
    dollars.toLocaleString('en-US', {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    })
  );
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, suffix: string) => {
    const s = v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, '');
    return s + suffix;
  };
  if (abs >= 1_000_000) return fmt(n / 1_000_000, 'M');
  if (abs >= 1_000) return fmt(n / 1_000, 'k');
  return Math.round(n).toLocaleString('en-US');
}

export function percentFunded(raisedCents: number, goalCents: number): number {
  if (goalCents <= 0) return 0;
  return Math.min(100, Math.floor((raisedCents / goalCents) * 100));
}
