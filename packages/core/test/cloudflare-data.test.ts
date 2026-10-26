import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { buildCloudflareData, counterPerUser, cloudflareUserSeries } from '../src/cloudflare';
import { SLOTS } from '../src/theme';
import { addDays } from '../src/npm';
import type { CloudflareDay, CloudflareSeries, MeasuredDay } from '../src/types';

const ACCOUNT = 'dd4d00309618abe546348e4b9cc7a893';

const rule = parseConfig(`
cloudflare:
  account-id: ${ACCOUNT}
  dataset: checks
  label: Update checks
  primary: { client: gui }
  dimensions:
    client:  { column: blob1, label: App vs CLI }
    version: { column: blob2, label: Version, kind: semver, released: true }
    os:      { column: blob3, label: OS }
`).cloudflare!;

const plain = parseConfig(`
cloudflare:
  account-id: ${ACCOUNT}
  dataset: checks
  dimensions:
    os: { column: blob3, label: OS }
`).cloudflare!;

const day = (date: string, users: number, events: number, by: CloudflareDay['by'] = {}): CloudflareDay => ({
  date,
  users,
  events,
  by,
});
const series = (days: CloudflareDay[]): CloudflareSeries => ({ schema: 1, dataset: 'checks', days });
/** `count` consecutive UTC days from `first`. */
const dates = (first: string, count: number): string[] => Array.from({ length: count }, (_, i) => addDays(first, i));
const byCount = (counts: Record<string, number>) =>
  Object.fromEntries(Object.entries(counts).map(([value, n]) => [value, { users: n, events: n }]));
const measured = (date: string, days: number, updates: number): MeasuredDay => ({
  date,
  days,
  groups: {},
  stars: 0,
  docker: null,
  counters: { updates },
});

describe('buildCloudflareData', () => {
  it('is undefined without stored days', () => {
    expect(buildCloudflareData(rule, series([]))).toBeUndefined();
  });

  it('takes the primary value as the headline, and the other events as the rest', () => {
    const data = buildCloudflareData(
      rule,
      series([
        day('2026-10-24', 10, 12, { client: { gui: { users: 4, events: 5 }, cli: { users: 6, events: 7 } } }),
        day('2026-10-25', 9, 10, { client: { gui: { users: 3, events: 4 }, cli: { users: 6, events: 6 } } }),
        day('2026-10-26', 8, 9, { client: { gui: { users: 2, events: 2 }, cli: { users: 6, events: 7 } } }),
      ]),
    )!;
    expect(data).toMatchObject({
      label: 'Update checks',
      latest: '2026-10-26',
      first: '2026-10-24',
      primary: { dimension: 'client', value: 'gui' },
    });
    expect(data.days.map((d) => d.headline)).toEqual([4, 3, 2]);
    expect(data.totals).toEqual({ usersLatest: 2, usersAvg7: 3, eventsLast30: 31, otherEvents7: 20 });
  });

  it('counts every row without a primary, and averages the last 7 days only', () => {
    const days = dates('2026-10-18', 9).map((date, i) => day(date, i + 1, 1));
    const data = buildCloudflareData(plain, series(days))!;
    expect(data).not.toHaveProperty('primary');
    expect(data.days.map((d) => d.headline)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(data.totals).toEqual({ usersLatest: 9, usersAvg7: 6, eventsLast30: 9, otherEvents7: 0 });
  });

  it('averages over the stored days when there are fewer than 7', () => {
    const data = buildCloudflareData(
      plain,
      series([day('2026-10-24', 2, 2), day('2026-10-25', 4, 4), day('2026-10-26', 6, 6)]),
    )!;
    expect(data.totals.usersAvg7).toBe(4);
  });

  it('lists the dimensions without their release flag', () => {
    const data = buildCloudflareData(rule, series([day('2026-10-26', 1, 1)]))!;
    expect(data.dimensions).toEqual([
      { name: 'client', label: 'App vs CLI' },
      { name: 'version', label: 'Version', kind: 'semver' },
      { name: 'os', label: 'OS' },
    ]);
  });

  it('folds the values past the top 8 into other, and leaves out days older than 30', () => {
    const counts = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`os${i}`, 10 - i]));
    const data = buildCloudflareData(
      plain,
      series([
        day('2026-09-25', 1000, 1000, { os: byCount({ old: 1000 }) }),
        day('2026-10-26', 0, 0, { os: byCount(counts) }),
      ]),
    )!;
    expect(data.shares.os!.map((s) => s.value)).toEqual([...Object.keys(counts).slice(0, 8), 'other']);
    expect(data.shares.os![0]).toEqual({ value: 'os0', users: 10, events: 10 });
    expect(data.shares.os!.at(-1)).toEqual({ value: 'other', users: 3, events: 3 });
  });

  it('orders semver values newest first, with the values that are not versions last', () => {
    const data = buildCloudflareData(
      rule,
      series([
        day('2026-10-26', 0, 0, {
          version: byCount({ '9.1.0': 1, '23.0.0': 1, '23.0.0-rc1': 1, nightly: 50 }),
        }),
      ]),
    )!;
    expect(data.shares.version!.map((s) => s.value)).toEqual(['23.0.0', '23.0.0-rc1', '9.1.0', 'nightly']);
  });
});

describe('cloudflareUserSeries', () => {
  const labelled = parseConfig(`
cloudflare:
  account-id: ${ACCOUNT}
  dataset: checks
  primary: { client: gui }
  dimensions:
    client: { column: blob1, values: { gui: App, cli: CLI } }
`).cloudflare!;

  it('is Total alone without a primary, every row counted', () => {
    const data = buildCloudflareData(plain, series([day('2026-10-25', 3, 3, { os: byCount({ linux: 3 }) }), day('2026-10-26', 5, 5)]))!;
    expect(cloudflareUserSeries(data)).toEqual([
      {
        key: 'total',
        label: 'Total',
        values: [
          { date: '2026-10-25', users: 3 },
          { date: '2026-10-26', users: 5 },
        ],
      },
    ]);
  });

  it('adds a line per value of the primary dimension, the primary value first and then by users', () => {
    const data = buildCloudflareData(
      labelled,
      series([
        day('2026-10-25', 9, 9, { client: byCount({ cli: 6, gui: 3 }) }),
        day('2026-10-26', 8, 8, { client: byCount({ gui: 4, web: 2 }) }),
      ]),
    )!;
    const lines = cloudflareUserSeries(data);
    expect(lines.map((l) => [l.key, l.label])).toEqual([
      ['total', 'Total'],
      ['gui', 'App'],
      ['cli', 'CLI'],
      ['web', 'web'],
    ]);
    expect(lines[0]!.values.map((v) => v.users)).toEqual([9, 8]);
    expect(lines[1]!.values.map((v) => v.users)).toEqual([3, 4]);
  });

  it('caps the value lines so Total and them fit the palette, keeping the primary value and the top others', () => {
    const counts = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`v${i}`, 20 - i]));
    const data = buildCloudflareData(labelled, series([day('2026-10-26', 1, 1, { client: byCount({ gui: 1, ...counts }) })]))!;
    const lines = cloudflareUserSeries(data);
    expect(lines.length).toBe(SLOTS);
    expect(lines.slice(1).map((l) => l.key)).toEqual(['gui', 'v0', 'v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('counts a day without a value as 0 for that value', () => {
    const data = buildCloudflareData(labelled, series([day('2026-10-25', 6, 6, { client: byCount({ cli: 6 }) }), day('2026-10-26', 4, 4, { client: byCount({ gui: 4 }) })]))!;
    const cli = cloudflareUserSeries(data).find((l) => l.key === 'cli')!;
    expect(cli.values).toEqual([
      { date: '2026-10-25', users: 6 },
      { date: '2026-10-26', users: 0 },
    ]);
  });

  it('leaves out the primary value when no stored day has it', () => {
    const data = buildCloudflareData(labelled, series([day('2026-10-26', 6, 6, { client: byCount({ cli: 6 }) })]))!;
    expect(cloudflareUserSeries(data).map((l) => l.key)).toEqual(['total', 'cli']);
  });

  it('keeps a raw value as its label when the dimension names no label for it', () => {
    const data = buildCloudflareData(labelled, series([day('2026-10-26', 4, 4, { client: byCount({ gui: 2, beta: 2 }) })]))!;
    expect(cloudflareUserSeries(data).map((l) => l.label)).toEqual(['Total', 'App', 'beta']);
  });

  it('does not take a prototype property as a label', () => {
    const data = buildCloudflareData(labelled, series([day('2026-10-26', 1, 1, { client: byCount({ constructor: 1 }) })]))!;
    expect(cloudflareUserSeries(data)[1]!.label).toBe('constructor');
  });
});

describe('counterPerUser', () => {
  // Thirty Cloudflare days ending on 2026-10-26, one user each in the window, so the mean is the headline.
  const window = (users: number) =>
    buildCloudflareData(plain, series(dates('2026-09-27', 30).map((d) => day(d, users, users))))!;
  // Thirty measured days from 2026-09-27; the counter gains 1 on each of the last `gains` of them.
  const covered = (gains: number) =>
    dates('2026-09-27', 30).map((d, i) => measured(d, 1, i >= 30 - gains ? 1 : 0));

  it('divides the counter gain over the window by the mean daily users, to 2 decimals', () => {
    expect(counterPerUser(covered(10), 'updates', window(3))).toBe(3.33);
  });

  it('counts only the part of a gap that starts before the window', () => {
    // The gap 2026-09-17 to 10-06 is 20 days, 10 of them (from 09-27) in the window: half its gain counts.
    const straddle = [measured('2026-10-06', 20, 20), ...dates('2026-10-07', 20).map((d) => measured(d, 1, 1))];
    expect(counterPerUser(straddle, 'updates', window(3))).toBe(10);
  });

  it('is undefined with fewer than 14 Cloudflare days in the window', () => {
    const cf = buildCloudflareData(plain, series(dates('2026-10-14', 13).map((d) => day(d, 3, 3))))!;
    expect(counterPerUser(covered(10), 'updates', cf)).toBeUndefined();
  });

  it('is undefined when no snapshot is at or before the window start', () => {
    const late = dates('2026-10-05', 22).map((d) => measured(d, 1, 1));
    expect(counterPerUser(late, 'updates', window(3))).toBeUndefined();
  });

  it('is undefined with no measured day in the window', () => {
    expect(counterPerUser([measured('2026-08-01', 1, 5)], 'updates', window(3))).toBeUndefined();
  });

  it('is undefined when the mean users are zero', () => {
    expect(counterPerUser(covered(10), 'updates', window(0))).toBeUndefined();
  });
});
