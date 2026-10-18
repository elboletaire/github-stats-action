import { describe, expect, it } from 'vitest';
import type { MeasuredDay } from '@github-stats-action/core';
import { measuredSeries, slotLabel, slotLabelDays } from '../src/slots';

const entry = (date: string, days: number, docker: number | null = 1): MeasuredDay => ({
  date,
  days,
  groups: { app: 1, cli: 2 },
  stars: 0,
  docker,
  counters: {},
});

describe('measured slots', () => {
  it('places each change on its day and leaves a gap empty', () => {
    const series = measuredSeries([entry('2026-10-01', 1), entry('2026-10-02', 1), entry('2026-10-05', 3)]);
    expect(series).not.toBeNull();
    expect([...series!.byDay.keys()]).toEqual([0, 1, 4]);
    expect(series!.last).toBe(4);
    expect(series!.byDay.has(2)).toBe(false);
  });

  it('has no series without changes', () => {
    expect(measuredSeries([])).toBeNull();
  });

  it('labels every day while slots are wide, and month starts once narrow', () => {
    const entries = Array.from({ length: 60 }, (_, i) => entry(new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), 1));
    const series = measuredSeries(entries)!;
    const wide = slotLabelDays(series, 20);
    expect(wide.slice(0, 3)).toEqual([0, 3, 6]);
    expect(slotLabel(series, 0, 20)).toBe('Sep 1');
    const narrow = slotLabelDays(series, 4);
    expect(narrow.every((day) => series.axis.date(day).getUTCDate() === 1)).toBe(true);
    expect(slotLabel(series, narrow[1]!, 4)).toBe('Oct');
  });

  it('keeps labels a minimum distance apart', () => {
    const entries = Array.from({ length: 30 }, (_, i) => entry(new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), 1));
    const series = measuredSeries(entries)!;
    const days = slotLabelDays(series, 10, 56);
    for (let i = 1; i < days.length; i++) expect((days[i]! - days[i - 1]!) * 10).toBeGreaterThanOrEqual(56);
  });
});
