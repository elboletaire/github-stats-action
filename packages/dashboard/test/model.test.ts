import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@github-stats-action/core';
import { countedGroups, periodName, periodShort, pivotColumns, platformTotals } from '../src/model';
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
});
