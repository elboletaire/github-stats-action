import { describe, expect, it } from 'vitest';
import { mergeTrafficDays } from '../src/traffic';

describe('mergeTrafficDays', () => {
  it('keeps the stored days, replaces a day fetched again, and sorts by date', () => {
    const existing = [
      { date: '2026-10-16', count: 5, uniques: 3 },
      { date: '2026-10-17', count: 7, uniques: 4 },
    ];
    const incoming = [
      { date: '2026-10-17', count: 9, uniques: 5 },
      { date: '2026-10-18', count: 2, uniques: 1 },
    ];
    expect(mergeTrafficDays(existing, incoming)).toEqual([
      { date: '2026-10-16', count: 5, uniques: 3 },
      { date: '2026-10-17', count: 9, uniques: 5 },
      { date: '2026-10-18', count: 2, uniques: 1 },
    ]);
  });

  it('does not duplicate a day when the same window is merged twice', () => {
    const window = [{ date: '2026-10-18', count: 2, uniques: 1 }];
    expect(mergeTrafficDays(window, window)).toEqual(window);
  });
});
