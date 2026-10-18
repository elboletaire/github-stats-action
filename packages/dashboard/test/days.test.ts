import { describe, expect, it } from 'vitest';
import { clampView, dayAxis, longDate, presetStart, xTicks, zoomView } from '../src/days';

describe('day axis', () => {
  const axis = dayAxis('2026-10-01');

  it('indexes days from the origin in UTC', () => {
    expect(axis.indexOf(Date.parse('2026-10-18T00:00:00Z'))).toBe(17);
    expect(axis.iso(17)).toBe('2026-10-18');
    expect(axis.short(17)).toBe('Oct 18');
    expect(axis.long(17)).toBe('Oct 18, 2026');
    expect(axis.iso(-1)).toBe('2026-09-30');
  });

  it('formats an ISO day as a long date', () => {
    expect(longDate('2025-01-02')).toBe('Jan 2, 2025');
  });

  it('labels short spans by day and longer ones by month or year', () => {
    const short = xTicks(axis, 0, 30, 10);
    expect(short.length).toBeLessThanOrEqual(10);
    expect(short[0]).toEqual([3, 'Oct 4']);
    const months = dayAxis('2024-01-01');
    const labels = xTicks(months, 0, 300, 12).map(([, t]) => t);
    expect(labels).toContain('Feb 2024');
    expect(labels).toContain('Oct');
  });

  it('labels multi-year spans by year', () => {
    const years = dayAxis('2020-01-01');
    const labels = xTicks(years, 0, 2200, 5).map(([, t]) => t);
    expect(labels.every((t) => /^\d{4}$/.test(t))).toBe(true);
    expect(labels).toContain('2022');
  });
});

describe('zoom window', () => {
  it('clamps a window inside the series and keeps its minimum length', () => {
    expect(clampView(-5, 10, 100, 6)).toEqual({ a: 0, b: 15 });
    expect(clampView(95, 101, 100, 6)).toEqual({ a: 93, b: 99 });
    expect(clampView(-5, 200, 100, 6)).toEqual({ a: 0, b: 99 });
    expect(clampView(10, 11, 100, 6)).toEqual({ a: 10, b: 16 });
  });

  it('zooms around a centre that keeps its fraction of the window', () => {
    expect(zoomView(50, 0.5, 40, 200, 6)).toEqual({ a: 30, b: 70 });
    expect(zoomView(50, 0.5, 200, 200, 6)).toEqual({ a: 0, b: 199 });
  });

  it('starts presets at the last N days, or at the first day for all', () => {
    expect(presetStart(0, 500)).toBe(0);
    expect(presetStart(90, 500)).toBe(410);
    expect(presetStart(90, 30)).toBe(0);
  });
});
