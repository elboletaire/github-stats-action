// The time window of a README chart: the days it covers, counted back from the data's latest day (UTC).

import { utcDate } from './estimate';
import { addDays } from './npm';
import type { ChartName } from './config';
import type { Dataset, StarPoint } from './types';

/** A length such as `30d`, `6m` or `1y`. */
export const RANGE_RE = /^(\d+)([dmy])$/;

/** `months` before `day` (YYYY-MM-DD), the day clamped to the month's length: Mar 31 less a month is Feb 28. */
function monthsBefore(day: string, months: number): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const target = year * 12 + (month - 1) - months;
  const y = Math.floor(target / 12);
  const m = target - y * 12;
  const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date, length))).toISOString().slice(0, 10);
}

/** The first day of a `range` window ending on `end` (YYYY-MM-DD): `30d` is 30 days including `end`, `1y` a year. */
export function rangeStart(range: string, end: string): string {
  const [, count = '0', unit = 'd'] = RANGE_RE.exec(range) ?? [];
  const n = Number(count);
  if (unit === 'd') return addDays(end, 1 - n);
  return addDays(monthsBefore(end, unit === 'y' ? 12 * n : n), 1);
}

/** The first and last day a chart covers, YYYY-MM-DD, both inclusive. */
export interface ChartWindow {
  start: string;
  end: string;
}

/** The days a chart covers: its `from`, or its `range` counted back from the end. Undefined shows all history. */
export function windowOf(dataset: Dataset, chart: ChartName): ChartWindow | undefined {
  const options = dataset.charts?.[chart];
  if (!options || (options.from === undefined && options.range === undefined)) return undefined;
  // the end is the data's latest day: the snapshot's, or the last stored day of npm or Cloudflare, where those charts end
  const end =
    chart === 'npm-downloads' && dataset.npm
      ? dataset.npm.latest
      : chart === 'cloudflare-users' && dataset.cloudflare
        ? dataset.cloudflare.latest
        : utcDate(Date.parse(dataset.snapshotAt));
  return { start: options.from ?? rangeStart(options.range!, end), end };
}

/** The curve starts at the count on the window's first day, or on the first star when the window reaches back past it. */
export function clipStars(stars: StarPoint[], w: ChartWindow): StarPoint[] {
  const first = stars[0];
  if (!first) return [];
  const from = w.start > first.date ? w.start : first.date;
  if (from > w.end) return [];
  const before = stars.filter((p) => p.date <= from).at(-1);
  return [{ date: from, stars: before?.stars ?? 0 }, ...stars.filter((p) => p.date > from && p.date <= w.end)];
}
