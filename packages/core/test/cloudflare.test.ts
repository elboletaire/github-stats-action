import { describe, expect, it, vi } from 'vitest';
import { parseConfig } from '../src/config';
import { cloudflareChunks, cloudflareClient, cloudflareRange, cloudflareSql, fetchCloudflareSeries, releasedFilter } from '../src/collectors/cloudflare';
import type { Logger, CloudflareDay, CloudflareSeries, SnapshotRelease } from '../src/types';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const logger = (): Logger => ({ info: vi.fn<(m: string) => void>(), warning: vi.fn<(m: string) => void>() });

const ACCOUNT = '0123456789abcdef0123456789abcdef';

/** A fetch that answers each SQL query (the request body) with `answer`, and records the queries. */
function fakeCloudflare(answer: (sql: string) => unknown, status = 200) {
  const sqls: string[] = [];
  const headers: Headers[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    headers.push(request.headers);
    sqls.push(await request.text());
    return json(answer(sqls.at(-1)!), status);
  });
  return { fetch: fn as unknown as typeof fetch, sqls, headers };
}

const release = (tag: string, publishedAt: string, prerelease = false): SnapshotRelease => ({
  tag,
  publishedAt,
  prerelease,
  assets: [],
});

const stored = (days: CloudflareDay[]): CloudflareSeries => ({ schema: 1, dataset: 'checks', days });
const day = (date: string, users: number): CloudflareDay => ({ date, users, events: users, by: { client: { gui: { users, events: users } } } });

const plain = parseConfig(`cloudflare: { account-id: ${ACCOUNT}, dataset: checks }\n`).cloudflare!;
const dimensioned = parseConfig(`
cloudflare:
  account-id: ${ACCOUNT}
  dataset: manga_downloader_checks
  day: blob5
  dimensions:
    client: { column: blob1 }
    version: { column: blob2, kind: semver, released: true }
`).cloudflare!;

describe('cloudflareRange', () => {
  it('backfills 90 days when nothing is stored', () => {
    expect(cloudflareRange([], '2026-10-26')).toEqual({ start: '2026-07-28', end: '2026-10-26' });
  });

  it('refetches from 3 days before the last stored day', () => {
    expect(cloudflareRange([day('2026-10-19', 1), day('2026-10-20', 1)], '2026-10-26')).toEqual({
      start: '2026-10-17',
      end: '2026-10-26',
    });
  });

  it('never starts before the 90-day window', () => {
    expect(cloudflareRange([day('2026-01-01', 1)], '2026-10-26')).toEqual({ start: '2026-07-28', end: '2026-10-26' });
  });
});

describe('cloudflareChunks', () => {
  it('splits a range into pieces of 7 days, the last one short', () => {
    expect(cloudflareChunks('2026-10-01', '2026-10-11')).toEqual([
      { start: '2026-10-01', end: '2026-10-08' },
      { start: '2026-10-08', end: '2026-10-11' },
    ]);
  });

  it('gives nothing for an empty range', () => {
    expect(cloudflareChunks('2026-10-01', '2026-10-01')).toEqual([]);
  });
});

describe('releasedFilter', () => {
  const releases = [
    release('v1.2.3', '2026-10-20T12:00:00Z'),
    release('v1.3.0', '2026-10-22T08:30:00Z', true),
    release('v1.4.0-beta.1', '2026-10-23T08:30:00Z'),
    release('nightly', '2026-10-24T08:30:00Z'),
    release('1.5.0', '2026-10-25T08:30:00Z'),
  ];

  it('keeps the published semver versions from their publish time, the v dropped', () => {
    expect(releasedFilter(dimensioned, releases)).toBe(
      " AND ((blob2 = '1.2.3' AND timestamp >= toDateTime('2026-10-20 12:00:00')) OR (blob2 = '1.5.0' AND timestamp >= toDateTime('2026-10-25 08:30:00')))",
    );
  });

  it('matches nothing when no release qualifies', () => {
    expect(releasedFilter(dimensioned, [release('v1.3.0', '2026-10-22T08:30:00Z', true)])).toBe(' AND false');
  });

  it('skips a release whose publish time is not a plain ISO timestamp, since it goes into the SQL', () => {
    expect(releasedFilter(dimensioned, [release('v1.2.3', "2026-10-20 12:00:00'); DROP")])).toBe(' AND false');
  });

  it('adds no filter without a released dimension', () => {
    expect(releasedFilter(plain, releases)).toBe('');
  });
});

describe('cloudflareSql', () => {
  const range = { start: '2026-10-17', end: '2026-10-24' };

  it('counts the day of the timestamp for the totals when there is no day blob', () => {
    expect(cloudflareSql(plain, range, '')).toBe(
      "SELECT formatDateTime(timestamp, '%Y-%m-%d') AS day, count(DISTINCT index1) AS users, sum(_sample_interval) AS events FROM checks WHERE timestamp >= toDateTime('2026-10-17 00:00:00') AND timestamp < toDateTime('2026-10-24 00:00:00') GROUP BY day ORDER BY day FORMAT JSON",
    );
  });

  it('groups a dimension by its value, and widens the window by a day around the day blob', () => {
    expect(cloudflareSql(dimensioned, range, ' AND false', 'blob1')).toBe(
      "SELECT blob5 AS day, blob1 AS value, count(DISTINCT index1) AS users, sum(_sample_interval) AS events FROM manga_downloader_checks WHERE timestamp >= toDateTime('2026-10-16 00:00:00') AND timestamp < toDateTime('2026-10-25 00:00:00') AND false GROUP BY day, value ORDER BY day FORMAT JSON",
    );
  });
});

describe('cloudflareClient', () => {
  it('sends the token as a bearer header', async () => {
    const fake = fakeCloudflare(() => ({ data: [] }));
    await fetchCloudflareSeries(cloudflareClient(fake.fetch, 'secret'), plain, ACCOUNT, [], undefined, '2026-10-26', logger());
    expect(fake.headers[0]!.get('authorization')).toBe('Bearer secret');
  });
});

describe('fetchCloudflareSeries', () => {
  // the totals answer for 2026-10-25 and 2026-10-26, and the client dimension for 2026-10-25 only; each
  // chunk keeps the days it holds, so 2026-10-26 is dropped
  const answer = (sql: string) => {
    if (sql.includes('blob1 AS value')) return { data: [{ day: '2026-10-25', value: 'gui', users: '2', events: '3' }] };
    if (sql.includes('AS value')) return { data: [] };
    return { data: [{ day: '2026-10-25', users: '2', events: '3' }, { day: '2026-10-26', users: '9', events: '9' }] };
  };

  it('backfills in 7-day queries, parses the string numbers and drops today', async () => {
    const fake = fakeCloudflare(answer);
    const log = logger();
    const series = await fetchCloudflareSeries(cloudflareClient(fake.fetch, 't'), plain, ACCOUNT, [], undefined, '2026-10-26', log);
    expect(fake.sqls).toHaveLength(13);
    expect(series).toEqual({
      schema: 1,
      dataset: 'checks',
      days: [{ date: '2026-10-25', users: 2, events: 3, by: {} }],
    });
    expect(log.info).toHaveBeenCalledWith('cloudflare: checks 1 days fetched, 1 stored');
  });

  it('keeps a dimension value named __proto__ as a plain key, and the series still serialises', async () => {
    const fake = fakeCloudflare((sql) =>
      sql.includes('blob1 AS value') ? { data: [{ day: '2026-10-25', value: '__proto__', users: '1', events: '1' }] } : { data: [{ day: '2026-10-25', users: '1', events: '1' }] },
    );
    const series = await fetchCloudflareSeries(cloudflareClient(fake.fetch, 't'), dimensioned, ACCOUNT, [], undefined, '2026-10-26', logger());
    const client = series!.days[0]!.by.client!;
    expect(Object.getPrototypeOf(client)).toBeNull();
    expect(Object.keys(client)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).users).toBeUndefined();
    const json = JSON.parse(JSON.stringify(series));
    expect(Object.keys(json.days[0].by.client)).toEqual(['__proto__']);
    expect(json.days[0].by.client['__proto__']).toEqual({ users: 1, events: 1 });
  });

  it('fills each dimension under its day', async () => {
    const fake = fakeCloudflare(answer);
    const series = await fetchCloudflareSeries(cloudflareClient(fake.fetch, 't'), dimensioned, ACCOUNT, [], undefined, '2026-10-26', logger());
    expect(series!.days).toEqual([
      { date: '2026-10-25', users: 2, events: 3, by: { client: { gui: { users: 2, events: 3 } }, version: {} } },
    ]);
  });

  it('refetches the overlap and replaces the stored days it covers', async () => {
    const fake = fakeCloudflare(() => ({ data: [{ day: '2026-10-24', users: '5', events: '6' }] }));
    const old = stored([day('2026-10-20', 1), day('2026-10-24', 1)]);
    const series = await fetchCloudflareSeries(cloudflareClient(fake.fetch, 't'), plain, ACCOUNT, [], old, '2026-10-26', logger());
    expect(fake.sqls[0]).toContain("toDateTime('2026-10-21 00:00:00')");
    expect(series!.days).toEqual([day('2026-10-20', 1), { date: '2026-10-24', users: 5, events: 6, by: {} }]);
  });

  it('keeps the stored series, with a warning, when the API refuses the query', async () => {
    const fake = fakeCloudflare(() => ({ errors: [{ code: 10000, message: 'bad sql' }] }), 400);
    const old = stored([day('2026-10-20', 1)]);
    const log = logger();
    expect(await fetchCloudflareSeries(cloudflareClient(fake.fetch, 't'), plain, ACCOUNT, [], old, '2026-10-26', log)).toBe(old);
    expect(log.warning).toHaveBeenCalledWith(expect.stringContaining('checks not collected'));
  });

  it('returns nothing, with a warning, when nothing is stored and the query fails', async () => {
    const fake = fakeCloudflare(() => ({}), 500);
    const log = logger();
    expect(await fetchCloudflareSeries(cloudflareClient(fake.fetch, 't'), plain, ACCOUNT, [], undefined, '2026-10-26', log)).toBeUndefined();
    expect(log.warning).toHaveBeenCalledTimes(1);
  });
});
