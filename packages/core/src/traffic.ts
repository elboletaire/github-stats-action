// Traffic series accumulate across runs: GitHub only keeps 14 days, so each run merges
// its days into the stored series.

import type { TrafficDay } from './types';

/** Days by date; a day fetched again replaces the stored one (its count can still grow). */
export function mergeTrafficDays(existing: readonly TrafficDay[], incoming: readonly TrafficDay[]): TrafficDay[] {
  const byDate = new Map<string, TrafficDay>();
  for (const day of existing) byDate.set(day.date, day);
  for (const day of incoming) byDate.set(day.date, day);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
