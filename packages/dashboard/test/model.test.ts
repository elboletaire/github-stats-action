import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCloudflareData, parseConfig, type Dataset } from '@github-stats-action/core';
import { cloudflareDaily, countedGroups, periodName, periodShort, pivotColumns, platformTotals } from '../src/model';
import { colorVar } from '../src/palette';

const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/dataset.json', import.meta.url), 'utf8')) as Dataset;

describe('model', () => {
  it('names periods after their epoch, and the span before the first one', () => {
    const [before, ...rest] = fixture.periods;
    expect(periodName(before!, fixture.epochs)).toBe('Before v1.0.0');
    expect(periodShort(before!, fixture.epochs)).toBe('<v1.0.0');
    expect(periodName(rest[0]!, fixture.epochs)).toBe('1.0 rewrite');
    expect(periodName({ ...before!, epoch: -1 }, [])).toBe('All releases');
  });

  it('sums platforms per group, largest first, without ignored files', () => {
    const cli = platformTotals(fixture, 'cli');
    expect(cli.length).toBeGreaterThan(0);
    expect(cli.every(([, v], i) => i === 0 || cli[i - 1]![1] >= v)).toBe(true);
    expect(cli.reduce((s, [, v]) => s + v, 0)).toBe(fixture.totals.groups.cli);
    expect(platformTotals(fixture, 'ignored').length).toBeGreaterThan(0);
  });

  it('builds pivot columns for counted groups only, in config order', () => {
    const columns = pivotColumns(fixture);
    expect(columns.some((c) => c.group.name === 'ignored')).toBe(false);
    const groups = columns.map((c) => c.group.name);
    expect(groups).toEqual([...groups].sort((a, b) => fixture.groups.findIndex((g) => g.name === a) - fixture.groups.findIndex((g) => g.name === b)));
    expect(countedGroups(fixture).map((g) => g.name)).not.toContain('ignored');
  });

  it('maps a group to a palette slot and folds extra groups into the last one', () => {
    expect(colorVar({ color: 0 })).toBe('var(--c0)');
    expect(colorVar({ color: 99 })).toBe('var(--c7)');
  });

  it('lays the users of each line on one day axis from the first stored day to the latest, zero where no day is stored', () => {
    const rule = parseConfig(`
cloudflare:
  account-id: dd4d00309618abe546348e4b9cc7a893
  dataset: checks
  dimensions:
    os: { column: blob3, label: OS }
`).cloudflare!;
    const day = (date: string, users: number) => ({ date, users, events: users, by: {} });
    const cf = buildCloudflareData(rule, { schema: 1, dataset: 'checks', days: [day('2026-10-24', 3), day('2026-10-26', 5)] })!;
    expect(cloudflareDaily(cf)).toEqual({ start: '2026-10-24', lines: [{ label: 'Total', values: [3, 0, 5] }] });
  });

  it('adds a line per primary value, on the same axis as Total', () => {
    const rule = parseConfig(`
cloudflare:
  account-id: dd4d00309618abe546348e4b9cc7a893
  dataset: checks
  primary: { client: gui }
  dimensions:
    client: { column: blob1, values: { gui: App, cli: CLI } }
`).cloudflare!;
    const day = (date: string, gui: number, cli: number) => ({
      date,
      users: gui + cli,
      events: gui + cli,
      by: { client: { gui: { users: gui, events: gui }, cli: { users: cli, events: cli } } },
    });
    const cf = buildCloudflareData(rule, { schema: 1, dataset: 'checks', days: [day('2026-10-24', 3, 1), day('2026-10-26', 0, 5)] })!;
    expect(cloudflareDaily(cf)).toEqual({
      start: '2026-10-24',
      lines: [
        { label: 'Total', values: [4, 0, 5] },
        { label: 'App', values: [3, 0, 0] },
        { label: 'CLI', values: [1, 0, 5] },
      ],
    });
  });
});
