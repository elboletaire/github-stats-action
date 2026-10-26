// Cloudflare Analytics Engine: daily aggregates of a dataset, through its SQL API. Only complete UTC
// days are fetched, so a day's figures don't move while it is still open.

import type { CloudflareDimensionRule, CloudflareRule } from '../config';
import { addDays } from '../npm';
import type { CloudflareCount, CloudflareDay, CloudflareSeries, Logger, SnapshotRelease } from '../types';
import { createClient, type Client, type FetchFn } from './client';

// Engine keeps about 3 months: the first run backfills 90 days, later runs refetch from 3 days before
// the last stored day for late points. Queries cover 7 days each.
const WINDOW_DAYS = 90;
const OVERLAP_DAYS = 3;
const CHUNK_DAYS = 7;

interface DayRange {
  /** First day, YYYY-MM-DD. */
  start: string;
  /** Day after the last one. */
  end: string;
}

/** One row of a query: the day, the grouped value (absent for totals) and the figures as strings. */
interface SqlRow {
  day: string;
  value?: string;
  users: string;
  events: string;
}

/**
 * The days to fetch, ending today: the full window when nothing is stored, else from a few days before
 * the last stored day.
 */
export function cloudflareRange(stored: readonly CloudflareDay[], today: string): DayRange {
  const floor = addDays(today, -WINDOW_DAYS);
  const last = stored.at(-1)?.date;
  const start = last ? addDays(last, -OVERLAP_DAYS) : floor;
  return { start: start < floor ? floor : start, end: today };
}

/** The range split into pieces of at most 7 days. */
export function cloudflareChunks(start: string, end: string): DayRange[] {
  const pieces: DayRange[] = [];
  for (let from = start; from < end; from = addDays(from, CHUNK_DAYS)) {
    const to = addDays(from, CHUNK_DAYS);
    pieces.push({ start: from, end: to < end ? to : end });
  }
  return pieces;
}

/**
 * The AND clause that keeps only the rows of published versions, from each release's publish time on,
 * so test builds of an unreleased version are dropped (Engine can't delete them). '' without a `released`
 * dimension; ` AND false` when no release qualifies (the API rejects `AND 0`).
 */
export function releasedFilter(rule: CloudflareRule, releases: readonly SnapshotRelease[]): string {
  const released = rule.dimensions.find((d) => d.released);
  if (!released) return '';
  const terms = releases.flatMap((r) => {
    const version = r.tag.replace(/^v/, '');
    // the publish time goes into the SQL, so only a plain ISO timestamp may pass
    if (r.prerelease || !/^\d+\.\d+\.\d+$/.test(version)) return [];
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(r.publishedAt)) return [];
    const since = r.publishedAt.replace('T', ' ').slice(0, 19);
    return [`(${released.column} = '${version}' AND timestamp >= toDateTime('${since}'))`];
  });
  return terms.length > 0 ? ` AND (${terms.join(' OR ')})` : ' AND false';
}

/**
 * One query over `range`: the day's totals, or each day's figures per value of `dimension`, over the rows
 * its `where` keeps. `filter` is releasedFilter's output.
 */
export function cloudflareSql(rule: CloudflareRule, range: DayRange, filter: string, dimension?: CloudflareDimensionRule): string {
  // a point's blob day can sit a day off its timestamp, so the window widens by a day; rows are filtered after parsing
  const pad = rule.day ? 1 : 0;
  const from = addDays(range.start, -pad);
  const to = addDays(range.end, pad);
  const dayExpr = rule.day ?? "formatDateTime(timestamp, '%Y-%m-%d')";
  const value = dimension ? `, ${dimension.column} AS value` : '';
  const group = dimension ? 'day, value' : 'day';
  // the values come from the config, which only lets quote-free text through
  const where = Object.entries(dimension?.where ?? {})
    .map(([name, text]) => ` AND ${rule.dimensions.find((d) => d.name === name)!.column} = '${text}'`)
    .join('');
  return `SELECT ${dayExpr} AS day${value}, count(DISTINCT ${rule.users}) AS users, sum(_sample_interval) AS events FROM ${rule.dataset} WHERE timestamp >= toDateTime('${from} 00:00:00') AND timestamp < toDateTime('${to} 00:00:00')${filter}${where} GROUP BY ${group} ORDER BY day FORMAT JSON`;
}

/** The Analytics Engine SQL API; the token needs Account Analytics: Read. */
export function cloudflareClient(fetchFn: FetchFn, token: string): Client {
  return createClient({
    fetch: fetchFn,
    baseUrl: 'https://api.cloudflare.com/client/v4',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Runs one query. The SQL is the body, and the API only takes it with `FORMAT JSON`. */
async function query(api: Client, accountId: string, sql: string): Promise<SqlRow[]> {
  const body = await api<{ data: SqlRow[] }>(`/accounts/${accountId}/analytics_engine/sql`, {
    method: 'POST',
    body: sql,
  });
  return body.data;
}

/** The days of one chunk: the totals first, then each dimension's values under the days that have totals. */
async function fetchChunk(api: Client, rule: CloudflareRule, accountId: string, filter: string, piece: DayRange): Promise<CloudflareDay[]> {
  const days = new Map<string, CloudflareDay>();
  for (const row of await query(api, accountId, cloudflareSql(rule, piece, filter))) {
    // the widened window also returns the neighbouring days, which their own chunk fetches
    if (row.day < piece.start || row.day >= piece.end) continue;
    // values come from the API, so a `__proto__` value must become an ordinary key, not the prototype
    const by: CloudflareDay['by'] = Object.fromEntries(rule.dimensions.map((d) => [d.name, Object.create(null)]));
    days.set(row.day, { date: row.day, users: Number(row.users), events: Number(row.events), by });
  }
  for (const dimension of rule.dimensions) {
    for (const row of await query(api, accountId, cloudflareSql(rule, piece, filter, dimension))) {
      const day = days.get(row.day);
      if (!day) continue;
      const counts: CloudflareCount = { users: Number(row.users), events: Number(row.events) };
      day.by[dimension.name]![row.value!] = counts;
    }
  }
  return [...days.values()];
}

/**
 * The dataset's stored days brought up to `today`: every chunk is fetched first, then merged by day with
 * the fetched days replacing the stored ones. A failed query logs a warning and returns the stored series.
 */
export async function fetchCloudflareSeries(
  api: Client,
  rule: CloudflareRule,
  accountId: string,
  releases: readonly SnapshotRelease[],
  stored: CloudflareSeries | undefined,
  today: string,
  log: Logger,
): Promise<CloudflareSeries | undefined> {
  const range = cloudflareRange(stored?.days ?? [], today);
  const filter = releasedFilter(rule, releases);
  const fetched: CloudflareDay[] = [];
  try {
    for (const piece of cloudflareChunks(range.start, range.end)) fetched.push(...(await fetchChunk(api, rule, accountId, filter, piece)));
  } catch (error) {
    log.warning(`cloudflare: ${rule.dataset} not collected (${(error as Error).message})`);
    return stored;
  }
  const byDate = new Map((stored?.days ?? []).map((d) => [d.date, d]));
  for (const day of fetched) byDate.set(day.date, day);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  log.info(`cloudflare: ${rule.dataset} ${fetched.length} days fetched, ${days.length} stored`);
  return { schema: 1, dataset: rule.dataset, days };
}
