import { describe, expect, it, vi } from 'vitest';
import { addMonths, buildNpmData, npmSlug, npmTotals } from '../src/npm';
import { fetchNpmSeries, npmPath, npmRange } from '../src/collectors/npm';
import { createClient } from '../src/collectors/client';
import type { Logger, NpmDay, NpmSeries } from '../src/types';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** npm's range answer: one count per day from `start` to `end`, both inclusive, `value(i)` for day i. */
function range(start: string, end: string, value: (i: number) => number = () => 1) {
  const days: { day: string; downloads: number }[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`), i = 0; t <= Date.parse(`${end}T00:00:00Z`); t += 864e5, i++) {
    days.push({ day: new Date(t).toISOString().slice(0, 10), downloads: value(i) });
  }
  return { start, end, package: 'pkg', downloads: days };
}

/** A fetch that records each request URL and answers every request with `body`. */
function fakeNpm(body: unknown, status = 200) {
  const urls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input instanceof Request ? input.url : input));
    return json(body, status);
  });
  return { fetch: fn as unknown as typeof fetch, urls };
}

const logger = (): Logger => ({ info: vi.fn<(m: string) => void>(), warning: vi.fn<(m: string) => void>() });
const npmApi = (fetchFn: typeof fetch) => createClient({ fetch: fetchFn, baseUrl: 'https://api.npmjs.org' });
const stored = (pkg: string, days: NpmDay[]): NpmSeries => ({ schema: 1, package: pkg, days });

describe('npm names and slugs', () => {
  it('slugs a scoped name without its @ or slash', () => {
    expect(npmSlug('@passcore/core')).toBe('passcore--core');
    expect(npmSlug('password-strength-meter')).toBe('password-strength-meter');
  });

  it('encodes each path segment, keeping the scope separator', () => {
    expect(npmPath('@passcore/core')).toBe('%40passcore/core');
    expect(npmPath('plain')).toBe('plain');
  });

  it('moves a month back by the calendar', () => {
    expect(addMonths('2026-10-18', -18)).toBe('2025-04-18');
  });
});

describe('npmRange', () => {
  it('backfills 18 months when nothing is stored', () => {
    expect(npmRange([], '2026-10-18')).toEqual({ start: '2025-04-18', end: '2026-10-18' });
  });

  it('starts no earlier than npm\'s window, after a gap longer than the window', () => {
    const days = [{ date: '2024-01-01', downloads: 1 }];
    expect(npmRange(days, '2026-10-18')).toEqual({ start: '2025-04-18', end: '2026-10-18' });
  });

  it('refetches from a week before the last stored day', () => {
    const days = [
      { date: '2026-10-10', downloads: 1 },
      { date: '2026-10-17', downloads: 2 },
    ];
    expect(npmRange(days, '2026-10-18')).toEqual({ start: '2026-10-10', end: '2026-10-18' });
  });
});

describe('fetchNpmSeries', () => {
  it('backfills the window on the first run, a scoped name encoded in the URL, and drops today', async () => {
    const fake = fakeNpm(range('2025-04-18', '2026-10-18'));
    const log = logger();
    const result = await fetchNpmSeries(npmApi(fake.fetch), '@passcore/core', undefined, '2026-10-18', log);
    expect(fake.urls).toEqual(['https://api.npmjs.org/downloads/range/2025-04-18:2026-10-18/%40passcore/core']);
    expect(result!.days[0]).toEqual({ date: '2025-04-18', downloads: 1 });
    expect(result!.days.at(-1)!.date).toBe('2026-10-17');
    expect(result!.days).toHaveLength(548);
    expect(log.info).toHaveBeenCalledWith('npm: @passcore/core 548 days fetched, 548 stored');
  });

  it('fetches only the overlap plus new days, and the newer count wins on the overlap', async () => {
    const old = stored('pkg', [
      { date: '2026-10-09', downloads: 5 },
      { date: '2026-10-10', downloads: 6 },
      { date: '2026-10-11', downloads: 7 },
    ]);
    const fake = fakeNpm(range('2026-10-04', '2026-10-18', (i) => (i < 10 ? 100 + i : 1)));
    const result = await fetchNpmSeries(npmApi(fake.fetch), 'pkg', old, '2026-10-18', logger());
    expect(fake.urls[0]).toMatch(/range\/2026-10-04:2026-10-18\/pkg$/);
    expect(result!.days.find((d) => d.date === '2026-10-09')!.downloads).toBe(105);
    const dates = result!.days.map((d) => d.date);
    expect(dates).toEqual([...new Set(dates)].sort());
    expect(result!.days.at(-1)!.date).toBe('2026-10-17');
  });

  it('keeps the stored days older than npm now reports', async () => {
    const old = stored('pkg', [{ date: '2024-01-01', downloads: 42 }]);
    const fake = fakeNpm(range('2026-09-01', '2026-10-18'));
    const result = await fetchNpmSeries(npmApi(fake.fetch), 'pkg', old, '2026-10-18', logger());
    expect(result!.days[0]).toEqual({ date: '2024-01-01', downloads: 42 });
  });

  it('turns a 404 into a warning and keeps the stored series', async () => {
    const old = stored('gone', [{ date: '2026-10-01', downloads: 3 }]);
    const fake = fakeNpm({ error: 'package gone not found' }, 404);
    const log = logger();
    expect(await fetchNpmSeries(npmApi(fake.fetch), 'gone', old, '2026-10-18', log)).toBe(old);
    expect(log.warning).toHaveBeenCalledWith(expect.stringContaining('gone downloads not collected'));
  });

  it('returns nothing, with a warning, when there is nothing stored and the fetch fails', async () => {
    const fake = fakeNpm({}, 500);
    const log = logger();
    expect(await fetchNpmSeries(npmApi(fake.fetch), 'pkg', undefined, '2026-10-18', log)).toBeUndefined();
    expect(log.warning).toHaveBeenCalledTimes(1);
  });
});

describe('npmTotals', () => {
  it('sums the latest day, the last 7 and 30 days ending on it, and everything stored', () => {
    const days = range('2026-08-01', '2026-10-17', (i) => i + 1).downloads.map((d) => ({
      date: d.day,
      downloads: d.downloads,
    }));
    const totals = npmTotals(days, '2026-10-17');
    expect(totals.lastDay).toBe(days.at(-1)!.downloads);
    expect(totals.last7).toBe(days.slice(-7).reduce((s, d) => s + d.downloads, 0));
    expect(totals.last30).toBe(days.slice(-30).reduce((s, d) => s + d.downloads, 0));
    expect(totals.all).toBe(days.reduce((s, d) => s + d.downloads, 0));
  });
});

describe('buildNpmData', () => {
  const a = stored('@passcore/core', [
    { date: '2026-10-16', downloads: 10 },
    { date: '2026-10-17', downloads: 20 },
  ]);
  const b = stored('plain', [
    { date: '2026-10-01', downloads: 5 },
    { date: '2026-10-17', downloads: 1 },
  ]);

  it('gives the latest and first stored day across packages, and the summed totals', () => {
    const data = buildNpmData([
      { label: 'Core', series: a },
      { label: 'plain', series: b },
    ])!;
    expect(data.latest).toBe('2026-10-17');
    expect(data.first).toBe('2026-10-01');
    expect(data.packages.map((p) => [p.label, p.slug, p.first])).toEqual([
      ['Core', 'passcore--core', '2026-10-16'],
      ['plain', 'plain', '2026-10-01'],
    ]);
    expect(data.packages[0]!.totals).toEqual({ lastDay: 20, last7: 30, last30: 30, all: 30 });
    expect(data.totals).toEqual({ lastDay: 21, last7: 31, last30: 36, all: 36 });
  });

  it('leaves out packages without stored days, and gives nothing when none has any', () => {
    const data = buildNpmData([
      { label: 'empty', series: stored('empty', []) },
      { label: 'Core', series: a },
    ])!;
    expect(data.packages.map((p) => p.package)).toEqual(['@passcore/core']);
    expect(buildNpmData([{ label: 'empty', series: stored('empty', []) }])).toBeUndefined();
  });
});
