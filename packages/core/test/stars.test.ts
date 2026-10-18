import { describe, expect, it } from 'vitest';
import type { StarPoint } from '../src/types';
import { monotoneCurve, monotonePath, sampleStars, sampleTicks, starsSpacing, STAR_SAMPLES } from '../src/stars';

const DAY = 86_400_000;
const dateOf = (i: number, from = '2024-01-01'): string => new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10);

/** One star per day for `total` days, starting `from`. */
const oneADay = (total: number, from = '2024-01-01'): StarPoint[] =>
  Array.from({ length: total }, (_, i) => ({ date: dateOf(i, from), stars: i + 1 }));

describe('sampleStars', () => {
  it('gives nothing for no points', () => {
    expect(sampleStars([])).toEqual([]);
  });

  it('gives the one star when there is a single point', () => {
    expect(sampleStars([{ date: '2024-01-01', stars: 1 }])).toEqual([{ date: '2024-01-01', stars: 1 }]);
  });

  it('keeps both points of two stars on different days', () => {
    expect(sampleStars(oneADay(2))).toEqual(oneADay(2));
  });

  it('keeps the first star and the latest total when a single star is days old', () => {
    const points = [
      { date: '2024-01-01', stars: 1 },
      { date: '2024-01-02', stars: 1 },
      { date: '2024-01-03', stars: 1 },
    ];
    expect(sampleStars(points)).toEqual([points[0], points[2]]);
  });

  it('gives first and last when every star landed on one day', () => {
    const points = [0, 1, 2, 3].map((i) => ({ date: dateOf(i), stars: 7 }));
    expect(sampleStars(points)).toEqual([points[0], points[3]]);
  });

  it('gives the first and last of a single day with every star', () => {
    expect(sampleStars([{ date: '2024-01-01', stars: 9 }])).toEqual([{ date: '2024-01-01', stars: 9 }]);
  });

  it('takes at most 30 points, always the first star and the latest total', () => {
    const points = oneADay(100);
    const samples = sampleStars(points);
    expect(samples).toHaveLength(STAR_SAMPLES);
    expect(samples[0]).toEqual(points[0]);
    expect(samples.at(-1)).toEqual(points.at(-1));
  });

  it('spaces the picks evenly by star count, the first reach of each level', () => {
    const samples = sampleStars(oneADay(100));
    // with one star a day the level of a day is its own count, so the picks are the levels themselves
    const levels = samples.map((p) => p.stars);
    expect(levels[0]).toBe(1);
    expect(levels.at(-1)).toBe(100);
    const steps = levels.slice(1).map((l, i) => l - (levels[i] ?? 0));
    const expected = Math.max(...steps) - Math.min(...steps);
    expect(expected).toBeLessThanOrEqual(1);
    expect(levels.every((l, i) => i === 0 || l > (levels[i - 1] ?? 0))).toBe(true);
  });

  it('gives every sample a day of its own, and each day the count first reached', () => {
    // 60 stars over 3 days: the first day holds 30, so the early levels are all on day 0
    const points: StarPoint[] = [
      { date: '2024-01-01', stars: 30 },
      { date: '2024-01-02', stars: 45 },
      { date: '2024-01-03', stars: 60 },
    ];
    expect(sampleStars(points)).toEqual(points);
  });

  it('never picks the same day twice', () => {
    const points = [
      { date: '2024-01-01', stars: 1 },
      { date: '2024-01-02', stars: 50 },
      { date: '2024-01-03', stars: 100 },
    ];
    const dates = sampleStars(points).map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates[0]).toBe('2024-01-01');
    expect(dates.at(-1)).toBe('2024-01-03');
  });

  it('takes the whole series when there are fewer stars than samples', () => {
    expect(sampleStars(oneADay(5))).toHaveLength(5);
  });

  it('samples the fixture series without going backwards', () => {
    const points = oneADay(346).map((p, i) => ({ ...p, stars: Math.floor(i / 9) }));
    const samples = sampleStars(points);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.stars).toBeGreaterThanOrEqual(samples[i - 1]!.stars);
      expect(samples[i]!.date > samples[i - 1]!.date).toBe(true);
    }
  });
});

describe('sampleTicks', () => {
  it('labels the first sample of each year', () => {
    const samples = [
      { date: '2023-11-20', stars: 1 },
      { date: '2024-01-03', stars: 2 },
      { date: '2024-06-01', stars: 3 },
      { date: '2025-01-09', stars: 4 },
    ];
    expect(sampleTicks(samples, 1)).toEqual([
      { index: 0, label: '2023' },
      { index: 1, label: '2024' },
      { index: 3, label: '2025' },
    ]);
  });

  it('uses month labels under a year, with the year on January', () => {
    const samples = [
      { date: '2025-11-02', stars: 1 },
      { date: '2025-12-20', stars: 2 },
      { date: '2026-01-05', stars: 3 },
      { date: '2026-02-11', stars: 4 },
    ];
    expect(sampleTicks(samples, 1)).toEqual([
      { index: 0, label: 'Nov 2025' },
      { index: 1, label: 'Dec' },
      { index: 2, label: 'Jan 2026' },
      { index: 3, label: 'Feb' },
    ]);
  });

  it('leaves out a label within the gap of the previous one', () => {
    const samples = [
      { date: '2024-12-30', stars: 1 },
      { date: '2025-01-02', stars: 2 },
      { date: '2025-02-01', stars: 3 },
    ];
    // under a year, so months: January is one sample after the first label, too close to keep
    expect(sampleTicks(samples, 2)).toEqual([
      { index: 0, label: 'Dec 2024' },
      { index: 2, label: 'Feb' },
    ]);
  });

  it('gives nothing without samples', () => {
    expect(sampleTicks([], 1)).toEqual([]);
  });
});

describe('monotoneCurve', () => {
  it('never leaves the range of its end points, so a cumulative count never overshoots', () => {
    // a jump, a flat run and a steep rise: the classic overshoot shape for an unconstrained spline
    const ys = [0, 0, 1, 1, 1, 9, 9.5, 30, 30];
    const points = ys.map((y, i) => [i * 10, y] as const);
    for (const seg of monotoneCurve(points)) {
      const lo = Math.min(seg.from[1], seg.to[1]);
      const hi = Math.max(seg.from[1], seg.to[1]);
      for (const c of [seg.c1[1], seg.c2[1]]) {
        expect(c).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(c).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  it('samples along the curve stay non-decreasing for non-decreasing data', () => {
    const ys = [0, 2, 2, 3, 10, 10, 11, 40];
    const points = ys.map((y, i) => [i * 7, y] as const);
    let previous = -Infinity;
    for (const seg of monotoneCurve(points)) {
      for (let k = 0; k <= 50; k++) {
        const t = k / 50;
        const u = 1 - t;
        const y = u ** 3 * seg.from[1] + 3 * u * u * t * seg.c1[1] + 3 * u * t * t * seg.c2[1] + t ** 3 * seg.to[1];
        expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = y;
      }
    }
  });

  it('keeps a flat run flat', () => {
    const curve = monotoneCurve([[0, 4], [10, 4], [20, 4]]);
    for (const seg of curve) expect([seg.c1[1], seg.c2[1]]).toEqual([4, 4]);
  });

  it('gives no curve for fewer than two points', () => {
    expect(monotoneCurve([[0, 1]])).toEqual([]);
    expect(monotonePath([])).toBe('');
  });

  it('writes the path as a move and one cubic per segment, one decimal', () => {
    expect(monotonePath([[0, 0], [30, 10]])).toBe('M0.0 0.0C10.0 3.3 20.0 6.7 30.0 10.0');
  });
});

describe('starsSpacing', () => {
  it('is even unless the config says time', () => {
    expect(starsSpacing(undefined)).toBe('even');
    expect(starsSpacing({ titles: true, stars: { spacing: 'time' }, 'downloads-per-day': {}, 'downloads-per-release': {} })).toBe('time');
  });
});
