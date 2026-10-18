import { describe, expect, it } from 'vitest';
import type { StarPoint } from '../src/types';
import { monotoneCurve, monotonePath, sampleStars, STAR_SAMPLES } from '../src/stars';

const DAY = 86_400_000;
const dateOf = (i: number, from = '2024-01-01'): string => new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10);

/** One star per day for `total` days, starting `from`. */
const oneADay = (total: number, from = '2024-01-01'): StarPoint[] =>
  Array.from({ length: total }, (_, i) => ({ date: dateOf(i, from), stars: i + 1 }));

const dayOfDate = (date: string): number => Date.parse(date) / DAY;

/** The cumulative count on `date`: the last point on or before it. */
const countOn = (points: readonly StarPoint[], date: string): number =>
  points.filter((p) => p.date <= date).at(-1)!.stars;

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

  it('gives one point when every star landed on one day and the series stops there', () => {
    expect(sampleStars([{ date: '2024-01-01', stars: 9 }])).toEqual([{ date: '2024-01-01', stars: 9 }]);
  });

  it('gives every day of a series that stays on one count, from the first star to the last point', () => {
    const points = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ date: dateOf(i), stars: 9 }));
    const samples = sampleStars(points);
    expect(samples).toHaveLength(10);
    expect(samples.map((p) => p.stars)).toEqual(points.map(() => 9));
    expect(samples[0]!.date).toBe('2024-01-01');
    expect(samples.at(-1)!.date).toBe('2024-01-10');
  });

  it('gives one point per day when the span is shorter than the sample count', () => {
    const samples = sampleStars(oneADay(10));
    expect(samples).toEqual(oneADay(10));
  });

  it('spaces the dates evenly in time, within a day of each other', () => {
    const samples = sampleStars(oneADay(100));
    expect(samples).toHaveLength(STAR_SAMPLES);
    const gaps = samples.slice(1).map((p, i) => dayOfDate(p.date) - dayOfDate(samples[i]!.date));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
  });

  it('includes the first star and the last date exactly', () => {
    const points = oneADay(100);
    const samples = sampleStars(points);
    expect(samples[0]).toEqual(points[0]);
    expect(samples.at(-1)).toEqual(points.at(-1));
  });

  it('gives the cumulative count on each sampled date', () => {
    // stars come in bursts, so the count between two bursts is the one before them
    const points: StarPoint[] = [
      { date: '2024-01-01', stars: 2 },
      { date: '2024-02-10', stars: 9 },
      { date: '2024-02-11', stars: 40 },
      { date: '2024-06-01', stars: 41 },
      { date: '2024-06-30', stars: 80 },
    ];
    const samples = sampleStars(points);
    expect(samples).toHaveLength(STAR_SAMPLES);
    for (const p of samples) expect(p.stars).toBe(countOn(points, p.date));
  });

  it('holds the count through days with no change', () => {
    // 3 stars, then 5 more 10 days later, then 2 more 10 days after that: no point on the days between
    const points: StarPoint[] = [
      { date: '2024-01-01', stars: 3 },
      { date: '2024-01-11', stars: 8 },
      { date: '2024-01-21', stars: 10 },
    ];
    const samples = sampleStars(points);
    expect(samples).toHaveLength(21);
    expect(samples.find((p) => p.date === '2024-01-05')).toEqual({ date: '2024-01-05', stars: 3 });
    expect(samples.find((p) => p.date === '2024-01-15')).toEqual({ date: '2024-01-15', stars: 8 });
    expect(samples.at(-1)).toEqual({ date: '2024-01-21', stars: 10 });
  });

  it('shows a dip at its date, and the peak still sets the scale', () => {
    const points = [
      { date: '2024-01-01', stars: 1 },
      { date: '2024-01-02', stars: 50 },
      { date: '2024-01-03', stars: 60 },
      { date: '2024-01-04', stars: 10 },
    ];
    expect(sampleStars(points)).toEqual(points);
  });

  it('takes at most 30 points, and fewer than 30 only when the span is shorter', () => {
    expect(sampleStars(oneADay(100))).toHaveLength(STAR_SAMPLES);
    expect(sampleStars(oneADay(5))).toHaveLength(5);
  });

  it('never picks the same date twice', () => {
    const dates = sampleStars(oneADay(31)).map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('samples a long, sparse series without going backwards', () => {
    // a year of stars that slow down: one change every few weeks
    const points: StarPoint[] = [];
    let stars = 0;
    for (let i = 0; i < 400; i += 17) {
      stars += 1 + (i % 5);
      points.push({ date: dateOf(i), stars });
    }
    const samples = sampleStars(points);
    expect(samples).toHaveLength(STAR_SAMPLES);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.stars).toBeGreaterThanOrEqual(samples[i - 1]!.stars);
      expect(samples[i]!.date > samples[i - 1]!.date).toBe(true);
    }
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

  it('never overshoots a dip either: each segment stays between its end points', () => {
    const ys = [0, 5, 3, 8, 8, 2, 9];
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
