import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChartsConfig, Dataset, MeasuredDay, NpmPackageStats, StarPoint } from '@github-stats-action/core';
import { renderCharts } from '../src/index';
import { clearOfEdges, EDGE_GAP } from '../src/svg';

const DAY = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const shift = (day: string, days: number): string => iso(Date.parse(`${day}T00:00:00Z`) + days * DAY);

const fixture = async (): Promise<Dataset> =>
  JSON.parse(await readFile(resolve(import.meta.dirname, '../../../fixtures/dataset.json'), 'utf8')) as Dataset;

const CHARTS: ChartsConfig = { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {} };

const withCharts = async (charts: Partial<ChartsConfig>): Promise<Dataset> => ({ ...(await fixture()), charts: { ...CHARTS, ...charts } });

function chart(files: { path: string; content: string }[], name: string): string {
  const file = files.find((f) => f.path === name);
  if (!file) throw new Error(`no ${name}`);
  return file.content;
}

/** The labels under the plot (the row at y 272), in order, with their anchor: `start` when the text has none. */
function xLabels(svg: string): { x: number; anchor: string; value: string }[] {
  return [...svg.matchAll(/<text x="([\d.]+)" y="272\.0" fill="[^"]*"(?: text-anchor="(middle|end)")?>([^<]*)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    anchor: m[2] ?? 'start',
    value: m[3] ?? '',
  }));
}

const segments = (svg: string): number => svg.match(/<path d="[^"]*" fill="[^"]*"><title>/g)?.length ?? 0;

const measured = (groups: Record<string, number>, days: number, end: string): MeasuredDay[] =>
  Array.from({ length: days }, (_, i) => ({ date: shift(end, i - (days - 1)), days: 1, groups, stars: 1, docker: null, counters: {} }));

/** Stars every `every` days from `from` to `to`, the last point on `to`. */
function starHistory(from: string, to: string, every: number): StarPoint[] {
  const points: StarPoint[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += every * DAY) {
    points.push({ date: iso(t), stars: points.length + 1 });
  }
  if (points.at(-1)?.date !== to) points.push({ date: to, stars: points.length + 1 });
  return points;
}

describe('stars window', () => {
  it('starts the axis at the window start and samples from it, the first sample at the count then', async () => {
    const svg = chart(renderCharts(await withCharts({ stars: { from: '2026-01-01' } })), 'charts/stars-light.svg');
    const labels = xLabels(svg);
    expect(labels[0]).toEqual({ x: 60, anchor: 'start', value: 'Jan 2026' });
    expect(labels.at(-1)).toEqual({ x: 776, anchor: 'end', value: 'Oct 2026' });
    // 4 stars on 1 Jan 2026, 18 at the end: the y axis tops out at 20, so 4 sits at 217.6 and 18 at 97.2
    expect(svg).toMatch(/<circle cx="60\.0" cy="217\.6" r="3" [^>]*><title>2026-01-01: 4 stars<\/title>/);
    expect(svg).toMatch(/<circle cx="776\.0" cy="97\.2" r="4"/);
    expect(svg.match(/<circle [^>]*r="3"[^>]*><title>/g)).toHaveLength(29);
  });

  it('shows days on a window of under four months', async () => {
    const labels = xLabels(chart(renderCharts(await withCharts({ stars: { range: '90d' } })), 'charts/stars-light.svg'));
    expect(labels[0]?.value).toBe('Jul 21');
    expect(labels.at(-1)?.value).toBe('Oct 18');
  });

  it('uses the whole history when the window reaches back past it', async () => {
    const whole = chart(renderCharts(await fixture()), 'charts/stars-light.svg');
    const longer = chart(renderCharts(await withCharts({ stars: { from: '2010-01-01' } })), 'charts/stars-light.svg');
    expect(longer).toBe(whole);
  });
});

describe('downloads per day window', () => {
  it('starts the estimate at the window start', async () => {
    const svg = chart(renderCharts(await withCharts({ 'downloads-per-day': { from: '2026-01-01' } })), 'charts/downloads-per-day-light.svg');
    expect(svg).toContain('Estimated');
    expect(svg).toMatch(/<path d="M60\.0 /);
    const labels = xLabels(svg);
    expect(labels[0]?.value).toBe('Jan 2026');
    expect(labels.at(-1)?.value).toBe('Oct 2026');
  });

  it('draws the measured bars of the window only, with day labels on a short window', async () => {
    const data = await withCharts({ 'downloads-per-day': { range: '20d' } });
    const svg = chart(renderCharts({ ...data, measuredDaily: measured({ app: 2, cli: 3 }, 30, '2026-10-18') }), 'charts/downloads-per-day-light.svg');
    expect(svg).toContain('Measured, change between daily snapshots (20 days)');
    expect(segments(svg)).toBe(40);
    const labels = xLabels(svg);
    expect(labels[0]?.value).toBe('Sep 29');
    expect(labels.at(-1)?.value).toBe('Oct 18');
  });
});

describe('downloads per release window', () => {
  it('draws the releases published in the window and hides the epochs before it', async () => {
    const data = await withCharts({ 'downloads-per-release': { from: '2026-10-01' } });
    const svg = chart(renderCharts(data), 'charts/downloads-per-release-light.svg');
    const inside = data.releases.filter((r) => r.publishedAt.slice(0, 10) >= '2026-10-01');
    expect(svg).toContain(`${inside.length} releases, stacked by group`);
    expect(segments(svg)).toBe(inside.reduce((n, r) => n + data.groups.filter((g) => (r.groups[g.name] ?? 0) > 0).length, 0));
    expect(svg).not.toContain('<title>v1.0.0,');
    expect(svg).not.toContain('<title>v1.0.0 ');
    expect(svg).toContain(`${data.epochs[1]!.version} ${data.epochs[1]!.label}`);
  });

  it('draws the last N releases', async () => {
    const data = await withCharts({ 'downloads-per-release': { last: 20 } });
    const svg = chart(renderCharts(data), 'charts/downloads-per-release-light.svg');
    const kept = data.releases.slice(-20);
    expect(svg).toContain('20 releases, stacked by group');
    expect(svg).toContain(`<title>${kept[0]!.tag}, `);
    expect(svg).not.toContain(`<title>${data.releases[data.releases.length - 21]!.tag}, `);
    // the first epoch began before the last 20, so its marker goes; the second began inside them
    expect(svg).not.toContain(`<title>${data.epochs[0]!.version} `);
    expect(svg).toContain(`<title>${data.epochs[1]!.version} `);
  });
});

describe('npm window', () => {
  /** A year-old npm series of one package at 10 downloads a day, ending on the 17th. */
  const npmData = (): Dataset => {
    const days = Array.from({ length: 655 }, (_, i) => ({ date: shift('2025-01-01', i), downloads: 10 }));
    const pkg: NpmPackageStats = {
      package: 'acme',
      label: 'acme',
      color: 0,
      slug: 'acme',
      first: '2025-01-01',
      totals: { lastDay: 10, last7: 70, last30: 300, all: 6550 },
      days,
    };
    return { ...({} as Dataset), npm: { latest: '2026-10-17', first: '2025-01-01', totals: pkg.totals, packages: [pkg] } } as unknown as Dataset;
  };

  it('draws the weeks of the window from its first day, ending on the latest day', async () => {
    const base = await fixture();
    const dataset = { ...base, npm: npmData().npm, charts: { ...CHARTS, 'npm-downloads': { range: '1y' as const } } };
    const svg = chart(renderCharts(dataset), 'charts/npm-downloads-light.svg');
    // the bars' paths hold one segment per week (moving) or all of a package's weeks (still): either way, the weeks are the M's
    const bars = [...svg.matchAll(/<path d="(M[^"]*)" fill="[^"]*"\/>/g)].map((m) => m[1]).join('');
    // 2025-10-18 to 2026-10-17 is 365 days: 52 whole weeks and a first one of a single day
    expect(bars.match(/M/g)).toHaveLength(53);
    const labels = xLabels(svg);
    expect(labels[0]?.value).toBe('Oct 2025');
    expect(labels.at(-1)?.value).toBe('Oct 2026');
  });
});

describe('label collisions', () => {
  it('drops a centred label whose text runs into a start or end label', () => {
    // "Mar 2017" spans 60 to 113, so "2018" centred on 121 (107 to 134) would touch it
    const kept = clearOfEdges([
      { x: 60, value: 'Mar 2017', anchor: 'start' },
      { x: 121, value: '2018', anchor: 'middle' },
      { x: 300, value: '2019', anchor: 'middle' },
    ]);
    expect(kept.map((l) => l.value)).toEqual(['Mar 2017', '2019']);
    const near = clearOfEdges([
      { x: 776, value: 'Oct 2026', anchor: 'end' },
      { x: 740, value: '2026', anchor: 'middle' },
    ]);
    expect(near.map((l) => l.value)).toEqual(['Oct 2026']);
    expect(EDGE_GAP).toBeGreaterThan(0);
  });

  it('keeps the year ticks clear of the start and end labels of a long stars history', async () => {
    const dataset = { ...(await fixture()), stars: starHistory('2017-03-10', '2026-10-18', 40) };
    const labels = xLabels(chart(renderCharts(dataset), 'charts/stars-light.svg')).map((l) => l.value);
    expect(labels[0]).toBe('Mar 2017');
    expect(labels.at(-1)).toBe('Oct 2026');
    expect(labels).not.toContain('2018');
    expect(labels).not.toContain('2026');
  });

  it('leaves no centred label within the gap of an edge label in any chart', async () => {
    const base = await fixture();
    const scenarios: Dataset[] = [
      base,
      { ...base, stars: starHistory('2017-03-10', '2026-10-18', 40) },
      { ...base, charts: { ...CHARTS, stars: { from: '2026-01-01' }, 'downloads-per-day': { range: '1y' } } },
      { ...base, measuredDaily: measured({ app: 1, cli: 2 }, 30, '2026-10-18'), charts: { ...CHARTS, 'downloads-per-day': { range: '30d' } } },
    ];
    for (const dataset of scenarios) {
      for (const { path, content } of renderCharts(dataset)) {
        const labels = xLabels(content).map((l) => ({ ...l, width: l.value.length * 11 * 0.6 }));
        const edges = labels.filter((l) => l.anchor !== 'middle');
        for (const label of labels.filter((l) => l.anchor === 'middle')) {
          const left = label.x - label.width / 2;
          const right = label.x + label.width / 2;
          for (const edge of edges) {
            const from = edge.anchor === 'start' ? edge.x : edge.x - edge.width;
            const to = edge.anchor === 'start' ? edge.x + edge.width : edge.x;
            expect(right + EDGE_GAP <= from || left >= to + EDGE_GAP, `${path}: ${label.value} near ${edge.value}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('mode and empty windows', () => {
  it('keeps the bars for a short window when the whole history has enough measured days', async () => {
    const data = await withCharts({ 'downloads-per-day': { range: '7d' } });
    const svg = chart(renderCharts({ ...data, measuredDaily: measured({ app: 2, cli: 3 }, 30, '2026-10-18') }), 'charts/downloads-per-day-light.svg');
    expect(svg).toContain('Measured, change between daily snapshots (7 days)');
    expect(svg).not.toContain('measured needs');
    expect(segments(svg)).toBe(14);
  });

  it('says the window holds no releases, not that there are none', async () => {
    const svg = chart(renderCharts(await withCharts({ 'downloads-per-release': { from: '2030-01-01' } })), 'charts/downloads-per-release-light.svg');
    expect(svg).toContain('No releases in this window');
    expect(svg).not.toContain('No releases yet');
  });

  it('says the window holds no downloads, for the estimate and for the bars', async () => {
    const estimate = chart(renderCharts(await withCharts({ 'downloads-per-day': { from: '2030-01-01' } })), 'charts/downloads-per-day-light.svg');
    expect(estimate).toContain('No downloads in this window');
    expect(estimate).not.toContain('No downloads yet');
    const data = await withCharts({ 'downloads-per-day': { from: '2030-01-01' } });
    const bars = chart(renderCharts({ ...data, measuredDaily: measured({ app: 2, cli: 3 }, 30, '2026-10-18') }), 'charts/downloads-per-day-light.svg');
    expect(bars).toContain('No downloads in this window');
    expect(bars).toContain('Measured, change between daily snapshots (0 days)');
  });

  it('says the window holds no stars, and keeps "no stars yet" for a repo without any', async () => {
    const svg = chart(renderCharts(await withCharts({ stars: { from: '2030-01-01' } })), 'charts/stars-light.svg');
    expect(svg).toContain('No stars in this window');
    const none = { ...(await withCharts({ stars: { from: '2030-01-01' } })), stars: [], totals: { ...(await fixture()).totals, stars: 0 } };
    expect(chart(renderCharts(none), 'charts/stars-light.svg')).toContain('No stars yet');
  });
});
