// The windows of the period badges: the last 7 or 30 UTC days ending on the data's latest day. Pure.

import { addDays, type MeasuredDay, type StarPoint } from '@github-stats-action/core';

/** The periods a badge can show, with their length in days. */
export const PERIODS = [
  { name: 'week', days: 7 },
  { name: 'month', days: 30 },
] as const;

/**
 * Sum of `value` over the `days` days ending on the latest measured day. Undefined unless the day before the
 * window is a snapshot and every day after it is measured, so a badge never shows a partial window. A gap inside
 * the window is fine: the snapshots at both ends still bound the sum exactly.
 */
export function measuredWindow(
  measured: readonly MeasuredDay[],
  days: number,
  value: (day: MeasuredDay) => number | null,
): number | undefined {
  const first = measured[0];
  const latest = measured.at(-1);
  if (!first || !latest) return undefined;
  const before = addDays(latest.date, -days);
  // each entry closes on a snapshot; the first one also opens on the snapshot before it
  const snapshots = new Set([addDays(first.date, -first.days), ...measured.map((day) => day.date)]);
  if (!snapshots.has(before)) return undefined;
  let sum = 0;
  for (const day of measured) {
    if (day.date <= before) continue;
    const count = value(day);
    if (count === null) return undefined;
    sum += count;
  }
  return sum;
}

/**
 * Stars gained over the `days` days ending on the last day of the series. Negative when more were removed.
 * Undefined when nobody has starred the repo.
 */
export function starsGained(points: readonly StarPoint[], days: number): number | undefined {
  const end = points.at(-1);
  if (!end) return undefined;
  const before = addDays(end.date, -days);
  // no point is on or before the window's start when the first star came after it, so the count was zero
  let atBefore = 0;
  for (const point of points) if (point.date <= before) atBefore = point.stars;
  return end.stars - atBefore;
}
