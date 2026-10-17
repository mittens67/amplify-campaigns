import { serverNow } from './api';

const DAY = 86_400_000;

export function timeLeft(endsAt: string | null, now = serverNow()): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return 'Funding closed';
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `${hours} hour${hours === 1 ? '' : 's'} left`;
}

export function relativeTime(iso: string, now = serverNow()): string {
  const diff = now - new Date(iso).getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'just now';
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ago`;
  if (abs < DAY) return `${Math.floor(abs / 3_600_000)}h ago`;
  if (abs < 7 * DAY) return `${Math.floor(abs / DAY)}d ago`;
  return shortDate(iso);
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: undefined });
}

/** e.g. "Sep 27, 2026" */
export function mediumDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function dayBucket(iso: string, now = serverNow()): string {
  const d = new Date(iso);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / DAY);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

export const pct = (n: number) => `${Math.round(n)}%`;
