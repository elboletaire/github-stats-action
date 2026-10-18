// The stars chart's shared maths: the even samples, their axis labels and a monotone curve through
// them. Browser code imports this file alone (`@github-stats-action/core/stars`), so it stays free of Node imports.

import type { ChartsConfig } from './config';
import type { StarPoint } from './types';

export type { StarPoint };

export type StarsSpacing = 'even' | 'time';

export const DEFAULT_STARS_SPACING: StarsSpacing = 'even';

/** The number of points the even chart samples the series into (fewer when there are fewer stars). */
export const STAR_SAMPLES = 30;

/** The spacing the stars chart uses, the default when the config has none. */
export function starsSpacing(charts: ChartsConfig | undefined): StarsSpacing {
  return charts?.stars.spacing ?? DEFAULT_STARS_SPACING;
}

/** Up to `count` points evenly spaced by star count: the first star, the days the count reached the levels between, and the latest total. */
export function sampleStars(points: readonly StarPoint[], count = STAR_SAMPLES): StarPoint[] {
  const last = points.length - 1;
  if (last < 0) return [];
  const total = points[last]!.stars;
  const n = Math.max(1, Math.min(count, total));
  const indices = [0];
  let k = 0;
  for (let i = 1; i < n - 1; i++) {
    const level = 1 + Math.round((i * (total - 1)) / (n - 1));
    while (k < last && points[k]!.stars < level) k++;
    indices.push(k);
  }
  indices.push(last);
  return indices.filter((index, i) => i === 0 || index !== indices[i - 1]).map((index) => points[index]!);
}

export interface SampleTick {
  /** Index into the samples. */
  index: number;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Axis labels: the year at each year's first sample, or the month under a year's span. A newer label drops the one before it when they are within `minGap` samples; the first label stays. */
export function sampleTicks(samples: readonly StarPoint[], minGap: number): SampleTick[] {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last) return [];
  const monthly = Date.parse(last.date) - Date.parse(first.date) < 365 * 86_400_000;
  const candidates: SampleTick[] = [];
  let period: string | undefined;
  samples.forEach((p, index) => {
    const key = monthly ? p.date.slice(0, 7) : p.date.slice(0, 4);
    if (key === period) return;
    period = key;
    const year = p.date.slice(0, 4);
    const month = MONTHS[Number(p.date.slice(5, 7)) - 1] ?? '';
    const label = !monthly ? year : index === 0 || month === 'Jan' ? `${month} ${year}` : month;
    candidates.push({ index, label });
  });
  const ticks: SampleTick[] = [];
  for (const tick of candidates) {
    // the first label keeps its place, so a newer label that clashes with it is the one left out
    while (ticks.length > 1 && tick.index - ticks.at(-1)!.index < minGap) ticks.pop();
    const previous = ticks.at(-1);
    if (!previous || tick.index - previous.index >= minGap) ticks.push(tick);
  }
  return ticks;
}

/** A point in plot coordinates. */
export type CurvePoint = readonly [number, number];

/** A cubic Bezier from `from` to `to` with control points `c1` and `c2`. */
export interface CubicSegment {
  from: CurvePoint;
  c1: CurvePoint;
  c2: CurvePoint;
  to: CurvePoint;
}

/**
 * The monotone cubic through `points` (Fritsch-Carlson, as d3's curveMonotoneX): between two points the
 * curve never leaves their range, so a cumulative count never dips or overshoots. The x values must ascend.
 */
export function monotoneCurve(points: readonly CurvePoint[]): CubicSegment[] {
  const n = points.length;
  if (n < 2) return [];
  const slope = points.slice(0, -1).map(([x0, y0], i) => {
    const [x1, y1] = points[i + 1]!;
    return x1 > x0 ? (y1 - y0) / (x1 - x0) : 0;
  });
  const tangent = new Array<number>(n);
  tangent[0] = slope[0]!;
  tangent[n - 1] = slope[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  // Fritsch-Carlson: a segment whose end tangents leave the circle of radius 3 is scaled back onto it
  for (let i = 0; i < n - 1; i++) {
    const s = slope[i]!;
    if (s === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / s;
    const b = tangent[i + 1]! / s;
    const r = a * a + b * b;
    if (r > 9) {
      tangent[i] = (3 / Math.sqrt(r)) * a * s;
      tangent[i + 1] = (3 / Math.sqrt(r)) * b * s;
    }
  }
  return slope.map((_, i) => {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = (x1 - x0) / 3;
    return {
      from: [x0, y0],
      c1: [x0 + h, y0 + (tangent[i]! * h)],
      c2: [x1 - h, y1 - (tangent[i + 1]! * h)],
      to: [x1, y1],
    };
  });
}

/** The monotone curve as SVG path data (`M` then `C` per segment), coordinates to one decimal. */
export function monotonePath(points: readonly CurvePoint[]): string {
  const [first] = points;
  if (!first) return '';
  const f = (n: number): string => n.toFixed(1);
  const curves = monotoneCurve(points).map((s) => `C${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(s.to[0])} ${f(s.to[1])}`);
  return `M${f(first[0])} ${f(first[1])}${curves.join('')}`;
}
