// The time window of a README chart: the days it covers, counted back from the data's latest day (UTC).

import { addDays } from './npm';

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
