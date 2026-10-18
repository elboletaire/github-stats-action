import { describe, expect, it } from 'vitest';
import { rangeStart } from '../src/window';

describe('rangeStart', () => {
  const END = '2026-10-18';

  it('counts days back, the end day included', () => {
    expect(rangeStart('1d', END)).toBe('2026-10-18');
    expect(rangeStart('30d', END)).toBe('2026-09-19');
    expect(rangeStart('90d', END)).toBe('2026-07-21');
  });

  it('counts months and years back, the day after the same date', () => {
    expect(rangeStart('6m', END)).toBe('2026-04-19');
    expect(rangeStart('1y', END)).toBe('2025-10-19');
    expect(rangeStart('2y', END)).toBe('2024-10-19');
  });

  it('clamps a month end to the shorter month', () => {
    expect(rangeStart('1m', '2026-03-31')).toBe('2026-03-01');
    expect(rangeStart('1m', '2026-03-29')).toBe('2026-03-01');
  });

  it('works in UTC across a year boundary and a leap day', () => {
    expect(rangeStart('30d', '2026-01-10')).toBe('2025-12-12');
    expect(rangeStart('1y', '2024-02-29')).toBe('2023-03-01');
  });
});
