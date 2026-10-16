import { adBudget, quote } from './money';

/**
 * Illustrative reach model used for every estimate in the product.
 * These are demo assumptions, not guarantees: actual delivery depends on
 * ad inventory, prices, targeting and performance.
 *
 * 33.75 people per ad dollar ≈ 27 people per contributed dollar after the 20% platform fee.
 */
export interface ReachModel {
  version: number;
  peoplePerAdDollar: number;
  /** Average impressions shown per unique person reached (frequency). */
  frequency: number;
  /** Expected click-through rate on impressions. */
  ctr: number;
}

export const REACH_MODELS: Record<number, ReachModel> = {
  1: { version: 1, peoplePerAdDollar: 33.75, frequency: 2.4, ctr: 0.011 },
};

export const CURRENT_REACH_MODEL = REACH_MODELS[1];

export function reachModel(version?: number | null): ReachModel {
  return (version && REACH_MODELS[version]) || CURRENT_REACH_MODEL;
}

/** Estimated people reached for a contribution amount (cents). */
export function estimateReach(amountCents: number, model: ReachModel = CURRENT_REACH_MODEL): number {
  return quote(amountCents, model.peoplePerAdDollar).estReach;
}

/** Estimated people reached if the campaign hits its goal. */
export function estimateReachAtGoal(goalCents: number, model: ReachModel = CURRENT_REACH_MODEL): number {
  return Math.round((adBudget(goalCents) / 100) * model.peoplePerAdDollar);
}

/** "$1 ≈ N people" — headline number for explanations. */
export function peoplePerContributedDollar(model: ReachModel = CURRENT_REACH_MODEL): number {
  return estimateReach(100, model);
}

/**
 * A backer's attributed share of a campaign's measured reach:
 * (their contribution / total raised) × measured reach.
 */
export function attributedReach(contributionCents: number, raisedCents: number, measuredReach: number): number {
  if (raisedCents <= 0) return 0;
  return Math.round((contributionCents / raisedCents) * measuredReach);
}
