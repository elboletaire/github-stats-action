// UTC day axes: day indices from an origin day, their labels and ticks, and the zoom window maths.

export const DAY_MS = 864e5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DayAxis {
  /** Day index of a timestamp (UTC), counted from the origin day. */
  indexOf(ms: number): number;
  date(index: number): Date;
  iso(index: number): string;
  /** `Oct 18` */
  short(index: number): string;
  /** `Oct 18, 2026` */
  long(index: number): string;
  year(index: number): number;
  /** Year times 12 plus the month (0-11), so consecutive months differ by one. */
  month(index: number): number;
}

/** A `YYYY-MM-DD` day as `Oct 18, 2026`. */
export function longDate(iso: string): string {
  return dayAxis(iso).long(0);
}

/** A day axis whose index 0 is `startIso` (YYYY-MM-DD, UTC). */
export function dayAxis(startIso: string): DayAxis {
  const origin = Date.parse(`${startIso}T00:00:00Z`);
  const date = (index: number): Date => new Date(origin + index * DAY_MS);
  const short = (index: number): string => `${MONTHS[date(index).getUTCMonth()]} ${date(index).getUTCDate()}`;
  return {
    indexOf: (ms) => Math.round((ms - origin) / DAY_MS),
    date,
    iso: (index) => date(index).toISOString().slice(0, 10),
    short,
    long: (index) => `${short(index)}, ${date(index).getUTCFullYear()}`,
    year: (index) => date(index).getUTCFullYear(),
    month: (index) => date(index).getUTCFullYear() * 12 + date(index).getUTCMonth(),
  };
}

/**
 * Ticks for the days a..b: days while the span is short, month starts up to 400 days, years beyond.
 * Each step is the finest one that leaves at most `max` labels.
 */
export function xTicks(axis: DayAxis, a: number, b: number, max: number): Array<[number, string]> {
  const span = b - a;
  const out: Array<[number, string]> = [];
  if (span <= 45) {
    const step = Math.ceil(span / max);
    for (let i = a + step; i <= b; i += step) out.push([i, axis.short(i)]);
  } else if (span <= 400) {
    const months: Array<[number, number]> = [];
    for (let m = axis.month(a) + 1; m <= axis.month(b); m++) {
      const i = axis.indexOf(Date.UTC(Math.floor(m / 12), m % 12, 1));
      if (i > a && i <= b) months.push([m, i]);
    }
    const step = [1, 2, 3, 6, 12].find((k) => months.filter(([m]) => m % k === 0).length <= max) ?? 12;
    months
      .filter(([m]) => m % step === 0)
      .forEach(([m, i], j) => out.push([i, j === 0 || m % 12 === 0 ? `${MONTHS[m % 12]} ${Math.floor(m / 12)}` : MONTHS[m % 12]!]));
  } else {
    const years: Array<[number, number]> = [];
    for (let y = axis.year(a) + 1; y <= axis.year(b); y++) {
      const i = axis.indexOf(Date.UTC(y, 0, 1));
      if (i > a && i <= b) years.push([y, i]);
    }
    const step = [1, 2, 5].find((k) => years.filter(([y]) => y % k === 0).length <= max) ?? 5;
    years.filter(([y]) => y % step === 0).forEach(([y, i]) => out.push([i, String(y)]));
  }
  return out;
}

/** A window of `len` days, clamped to the series 0..n-1 and at least `min` days long. */
export function clampView(a: number, b: number, n: number, min: number): { a: number; b: number } {
  const len = Math.min(n - 1, Math.max(min, Math.round(b - a)));
  const start = Math.max(0, Math.min(Math.round(a), n - 1 - len));
  return { a: start, b: start + len };
}

/** A window `len` days long around day `centre`, which keeps the fraction `t` of the window before it. */
export function zoomView(centre: number, t: number, len: number, n: number, min: number): { a: number; b: number } {
  const size = Math.round(len);
  return clampView(centre - t * size, centre - t * size + size, n, min);
}

/** First day index of a preset covering the last `days` days (0 means everything). */
export function presetStart(days: number, n: number): number {
  return days ? Math.max(0, n - days) : 0;
}
