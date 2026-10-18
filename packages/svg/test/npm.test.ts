import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNpmData, parseConfig, type Dataset, type NpmDay } from '@github-stats-action/core';
import { renderCharts } from '../src/index';
import { legendRows, weeklySums } from '../src/npm';
import { textWidth } from '../src/svg';

const fixture = async (): Promise<Dataset> =>
  JSON.parse(await readFile(resolve(import.meta.dirname, '../../../fixtures/dataset.json'), 'utf8')) as Dataset;

/** Seven packages with 18 months of daily counts, the largest a pattern of its own. */
function npmData(days = 548) {
  const latest = Date.parse('2026-10-17T00:00:00Z');
  const series = (i: number): NpmDay[] =>
    Array.from({ length: days }, (_, k) => ({
      date: new Date(latest - (days - 1 - k) * 864e5).toISOString().slice(0, 10),
      downloads: ((k * (i + 3)) % 97) + i,
    }));
  return buildNpmData(
    Array.from({ length: 7 }, (_, i) => ({
      label: `pkg-${i}`,
      series: { schema: 1 as const, package: `pkg-${i}`, days: series(i) },
    })),
  );
}

describe('npm downloads chart', () => {
  it('sums the daily counts into weeks ending on the latest day', () => {
    const npm = npmData(10)!;
    const { ends, sums } = weeklySums(npm);
    expect(ends).toHaveLength(2);
    expect(ends.at(-1)).toBe(Date.parse('2026-10-17T00:00:00Z') / 864e5);
    const total = npm.packages.reduce((sum, p) => sum + p.totals.all, 0);
    expect(sums.flat().reduce((sum, v) => sum + v, 0)).toBe(total);
    expect(sums[0]).toHaveLength(2);
  });

  it('writes light and dark files that stay under 40 KB with seven packages over 18 months', async () => {
    const dataset = { ...(await fixture()), npm: npmData() };
    const files = renderCharts(dataset).filter((f) => f.path.startsWith('charts/npm-downloads-'));
    expect(files.map((f) => f.path)).toEqual(['charts/npm-downloads-light.svg', 'charts/npm-downloads-dark.svg']);
    for (const file of files) {
      expect(Buffer.byteLength(file.content)).toBeLessThan(40 * 1024);
      expect(file.content).toContain('npm downloads per week');
    }
  });

  it('hides the title when charts.npmDownloads says so, keeping the packages legend', async () => {
    const config = parseConfig('charts:\n  npmDownloads: { title: false }\n');
    const dataset = { ...(await fixture()), npm: npmData(), charts: config.charts };
    const svg = renderCharts(dataset).find((f) => f.path === 'charts/npm-downloads-light.svg')!.content;
    expect(svg).not.toContain('>npm downloads per week</text>');
    expect(svg).toContain('>pkg-0</text>');
  });

  it('is left out with no npm data, and the release charts with release downloads off', async () => {
    const base = await fixture();
    const plain = renderCharts({ ...base, npm: undefined }).map((f) => f.path);
    expect(plain.some((p) => p.startsWith('charts/npm-'))).toBe(false);
    const stars = renderCharts({ ...base, releaseDownloads: false, npm: npmData() }).map((f) => f.path);
    expect(stars).toContain('charts/stars-light.svg');
    expect(stars.some((p) => p.includes('downloads-per'))).toBe(false);
    expect(stars).toContain('charts/npm-downloads-light.svg');
  });

  it('wraps a long legend into rows that fit the width', () => {
    const keys = Array.from({ length: 7 }, (_, i) => ({ label: `@passcore/package-${i}`, color: '#000' }));
    const rows = legendRows(keys, 752);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.flat()).toEqual(keys);
    for (const row of rows) {
      const width = row.reduce((sum, k) => sum + 14 + textWidth(k.label, 12), 0) + 18 * (row.length - 1);
      expect(width).toBeLessThanOrEqual(752);
    }
  });
});
