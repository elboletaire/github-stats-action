// Estimated downloads per UTC day: each release's downloads spread evenly over its live
// window, and the medians the periods report over whole days.

import type { EstimatedDaily, ReleaseRow } from './types';

export const DAY_MS = 86_400_000;

/** Midnight UTC of the day containing `ms`. */
export function utcMidnight(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface Estimate {
  /** Midnight UTC of day 0; `daily.start` is the same day as a date. */
  d0: number;
  daily: EstimatedDaily;
}

/** One value per UTC day from the first release's day to `now`'s day, inclusive. */
export function estimateDaily(releases: readonly ReleaseRow[], names: readonly string[], now: number): Estimate {
  const first = releases[0];
  const d0 = utcMidnight(first ? Date.parse(first.publishedAt) : now);
  const nd = Math.max(1, Math.floor((now - d0) / DAY_MS) + 1);
  const groups: Record<string, number[]> = Object.fromEntries(
    names.map((name) => [name, new Array<number>(nd).fill(0)]),
  );
  for (const release of releases) {
    if (release.days <= 0) continue;
    const pub = Date.parse(release.publishedAt);
    const end = Date.parse(release.end);
    for (let i = Math.max(0, Math.floor((pub - d0) / DAY_MS)); i < nd; i++) {
      const dayStart = d0 + i * DAY_MS;
      if (dayStart >= end) break;
      const overlap = (Math.min(end, dayStart + DAY_MS) - Math.max(pub, dayStart)) / DAY_MS;
      if (overlap <= 0) continue;
      for (const name of names) {
        groups[name]![i]! += ((release.groups[name] ?? 0) * overlap) / release.days;
      }
    }
  }
  return { d0, daily: { start: utcDate(d0), groups } };
}
