// Measured days as slots: one per UTC day from the first snapshot change, a missing snapshot leaving its slot empty.

import type { MeasuredDay } from '@github-stats-action/core';
import { dayAxis, type DayAxis } from './days';

export interface MeasuredSeries {
  axis: DayAxis;
  /** Last slot index, counted from the first measured day (always 0). */
  last: number;
  byDay: Map<number, MeasuredDay>;
}

/** Slots for the measured days, or null when there are none. */
export function measuredSeries(entries: readonly MeasuredDay[]): MeasuredSeries | null {
  const first = entries[0];
  if (!first) return null;
  const axis = dayAxis(first.date);
  const byDay = new Map<number, MeasuredDay>();
  for (const entry of entries) byDay.set(axis.indexOf(Date.parse(`${entry.date}T00:00:00Z`)), entry);
  return { axis, last: Math.max(...byDay.keys()), byDay };
}

/**
 * Slots that get a label: one per day, or only month starts once slots are narrower than 8px.
 * A label is kept only if it clears the previous one by `minGap` pixels.
 */
export function slotLabelDays(series: MeasuredSeries, slotWidth: number, minGap = 56): number[] {
  const monthly = slotWidth < 8;
  const out: number[] = [];
  let lastX = -Infinity;
  for (let day = 0; day <= series.last; day++) {
    if (monthly && series.axis.date(day).getUTCDate() !== 1) continue;
    const x = day * slotWidth;
    if (x - lastX < minGap) continue;
    lastX = x;
    out.push(day);
  }
  return out;
}

/** The label of a slot: its short date, or the month (with the year in January) when slots are monthly. */
export function slotLabel(series: MeasuredSeries, day: number, slotWidth: number): string {
  if (slotWidth >= 8) return series.axis.short(day);
  const date = series.axis.date(day);
  const month = series.axis.short(day).split(' ')[0]!;
  return date.getUTCMonth() === 0 ? `${month} ${date.getUTCFullYear()}` : month;
}
