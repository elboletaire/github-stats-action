// npm downloads: the package-name rules, the file slug and the Dataset's npm figures. Pure, no I/O.

import { DAY_MS, utcDate } from './estimate';
import type { NpmData, NpmDay, NpmPackageStats, NpmSeries, NpmTotals } from './types';

/** npm's name rules: an optional `@scope/`, then lowercase or legacy mixed-case letters, digits, `-._~`. */
export const NPM_NAME_RE = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/i;
export const NPM_NAME_MAX = 214;

/** The file name of a package: `@scope/name` becomes `scope--name` (names never hold `/`, so it's unambiguous). */
export function npmSlug(pkg: string): string {
  return pkg.replace(/^@/, '').replace('/', '--').toLowerCase();
}

/** The day `days` after `date` (YYYY-MM-DD, UTC); negative goes back. */
export function addDays(date: string, days: number): string {
  return utcDate(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
}

/** The day `months` after `date` (YYYY-MM-DD, UTC); a day past the month's end rolls over, as Date does. */
export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const dayNumber = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

/** Totals over the days ending on `latest`: its own day, the last 7 and 30 days, and everything stored. */
export function npmTotals(days: readonly NpmDay[], latest: string): NpmTotals {
  const end = dayNumber(latest);
  const totals: NpmTotals = { lastDay: 0, last7: 0, last30: 0, all: 0 };
  for (const day of days) {
    const ago = end - dayNumber(day.date);
    totals.all += day.downloads;
    if (ago === 0) totals.lastDay += day.downloads;
    if (ago < 7) totals.last7 += day.downloads;
    if (ago < 30) totals.last30 += day.downloads;
  }
  return totals;
}

export interface NpmInput {
  label: string;
  series: NpmSeries;
}

/** The dataset's npm figures from the stored series, in config order; undefined when none has a day. */
export function buildNpmData(inputs: readonly NpmInput[]): NpmData | undefined {
  const stored = inputs.flatMap((input, color) => (input.series.days.length > 0 ? [{ ...input, color }] : []));
  if (stored.length === 0) return undefined;
  const latest = stored.map((i) => i.series.days.at(-1)!.date).sort().at(-1)!;
  const first = stored.map((i) => i.series.days[0]!.date).sort()[0]!;
  const packages: NpmPackageStats[] = stored.map(({ label, color, series }) => ({
    package: series.package,
    label,
    color,
    slug: npmSlug(series.package),
    first: series.days[0]!.date,
    totals: npmTotals(series.days, latest),
    days: series.days,
  }));
  const totals: NpmTotals = { lastDay: 0, last7: 0, last30: 0, all: 0 };
  for (const pkg of packages) {
    totals.lastDay += pkg.totals.lastDay;
    totals.last7 += pkg.totals.last7;
    totals.last30 += pkg.totals.last30;
    totals.all += pkg.totals.all;
  }
  return { latest, first, totals, packages };
}
