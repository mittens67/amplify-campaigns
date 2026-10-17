import { AsyncLocalStorage } from 'node:async_hooks';
import type { Queryable } from '../db/index.js';

/**
 * Demo clock. Campaign time (funding deadlines, distribution days) runs on
 * real time + an offset that reviewers can advance from the Demo Controls, so the full
 * lifecycle can be shown in minutes. Payment settlement uses real time.
 */
const DAY = 86_400_000;
let offsetDays = 0;
let frozen: Date | null = null;
/** Per-task frozen time, so several campaigns can be seeded in parallel with different clocks. */
const scoped = new AsyncLocalStorage<{ at: Date | null }>();

export const clock = {
  now(): Date {
    const local = scoped.getStore();
    if (local?.at) return new Date(local.at);
    if (frozen) return new Date(frozen);
    return new Date(Date.now() + offsetDays * DAY);
  },
  offsetDays: () => offsetDays,
  async load(db: Queryable) {
    const [row] = await db.query<{ clock_offset_days: number }>('SELECT clock_offset_days FROM demo_state WHERE id = 1');
    offsetDays = row?.clock_offset_days ?? 0;
  },
  async advance(db: Queryable, days: number) {
    const [row] = await db.query<{ clock_offset_days: number }>(
      'UPDATE demo_state SET clock_offset_days = clock_offset_days + $1 WHERE id = 1 RETURNING clock_offset_days',
      [days],
    );
    offsetDays = row.clock_offset_days;
  },
  async reset(db: Queryable) {
    await db.query('UPDATE demo_state SET clock_offset_days = 0 WHERE id = 1');
    offsetDays = 0;
  },
  /** Seed helper: pin the clock to a specific instant. */
  freeze(at: Date | null) {
    const local = scoped.getStore();
    if (local) local.at = at;
    else frozen = at;
  },
  /** Run fn with its own freezable clock (used by the seed to build campaigns concurrently). */
  isolated<T>(fn: () => Promise<T>): Promise<T> {
    return scoped.run({ at: null }, fn);
  },
};

export const days = (n: number) => n * DAY;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
