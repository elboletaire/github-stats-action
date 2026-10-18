// npm download counts: public and daily, no token. The first run backfills npm's whole 18-month
// window; later runs refetch the week before the last stored day, to pick up late corrections.

import type { Client } from './client';
import { addDays, addMonths } from '../npm';
import type { Logger, NpmDay, NpmSeries } from '../types';

const WINDOW_MONTHS = 18;
const OVERLAP_DAYS = 7;

interface RangeResponse {
  downloads: { day: string; downloads: number }[];
}

/** The URL path of a package: each segment encoded, so a scope's `@` and `/` survive. */
export const npmPath = (pkg: string): string => pkg.split('/').map(encodeURIComponent).join('/');

/** The days to fetch, ending today: the full window when nothing is stored, else from a week before the last day. */
export function npmRange(stored: readonly NpmDay[], today: string): { start: string; end: string } {
  const last = stored.at(-1)?.date;
  return { start: last ? addDays(last, -OVERLAP_DAYS) : addMonths(today, -WINDOW_MONTHS), end: today };
}

/**
 * The package's stored series brought up to `today`. Today's count is partial, so only the days
 * before it are kept. A failed fetch logs a warning and returns the stored series unchanged.
 */
export async function fetchNpmSeries(
  api: Client,
  pkg: string,
  stored: NpmSeries | undefined,
  today: string,
  log: Logger,
): Promise<NpmSeries | undefined> {
  const { start, end } = npmRange(stored?.days ?? [], today);
  let fetched: NpmDay[];
  try {
    const body = await api<RangeResponse>(`/downloads/range/${start}:${end}/${npmPath(pkg)}`);
    fetched = body.downloads
      .filter((d) => d.day < today)
      .map((d) => ({ date: d.day, downloads: d.downloads }));
  } catch (error) {
    log.warning(`npm: ${pkg} downloads not collected (${(error as Error).message})`);
    return stored;
  }
  const byDay = new Map((stored?.days ?? []).map((d) => [d.date, d.downloads]));
  for (const day of fetched) byDay.set(day.date, day.downloads);
  const days = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, downloads]) => ({ date, downloads }));
  log.info(`npm: ${pkg} ${fetched.length} days fetched, ${days.length} stored`);
  return { schema: 1, package: pkg, days };
}
