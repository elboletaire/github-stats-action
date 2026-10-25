import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildCloudflareData,
  parseConfig,
  type CloudflareRule,
  type CloudflareSeries,
  type Dataset,
} from '@github-stats-action/core';
import { renderCharts } from '../src/index';

const fixture = async (): Promise<Dataset> =>
  JSON.parse(await readFile(resolve(import.meta.dirname, '../../../fixtures/dataset.json'), 'utf8')) as Dataset;

const RULE: CloudflareRule = {
  accountId: '0'.repeat(32),
  dataset: 'manga_downloader_checks',
  label: 'Update checks',
  users: 'index1',
  dimensions: [{ name: 'client', label: 'App vs CLI', column: 'blob1' }],
};

/** `count` days ending on `latest`: users rise a day, and each user makes two checks. */
function series(count: number, latest = '2026-10-18'): CloudflareSeries {
  const days = Array.from({ length: count }, (_, i) => {
    const users = 10 + i;
    return {
      date: addDays(latest, i - count + 1),
      users,
      events: users * 2,
      by: { client: { gui: { users, events: users * 2 } } },
    };
  });
  return { schema: 1, dataset: RULE.dataset, days };
}

/** The fixture dataset with `count` Cloudflare days, and the chart options of `config`. */
async function withUsers(count = 14, config = ''): Promise<Dataset> {
  const cloudflare = buildCloudflareData(RULE, series(count))!;
  return { ...(await fixture()), cloudflare, charts: parseConfig(config || 'charts: {}').charts };
}

const chart = (dataset: Dataset, theme: 'light' | 'dark' = 'light'): string =>
  renderCharts(dataset).find((f) => f.path === `charts/cloudflare-users-${theme}.svg`)!.content;

describe('cloudflare users chart', () => {
  it('writes light and dark files only with Cloudflare days', async () => {
    const base = await fixture();
    expect(renderCharts(base).map((f) => f.path).some((p) => p.includes('cloudflare'))).toBe(false);
    const paths = renderCharts(await withUsers()).map((f) => f.path);
    expect(paths).toContain('charts/cloudflare-users-light.svg');
    expect(paths).toContain('charts/cloudflare-users-dark.svg');
  });

  it('labels the headline users as approximate next to the events', async () => {
    const svg = chart(await withUsers());
    expect(svg).toContain('>Daily users (approx.)</text>');
    expect(svg).toContain('>Update checks</text>');
    expect(svg).toContain('Approximate users per day, 14 days to 2026-10-18');
    expect(svg).toContain('approximate.</desc>');
  });

  it('draws a single day without dividing by a zero span', async () => {
    const svg = chart(await withUsers(1));
    expect(svg).toContain('Approximate users per day, 1 day to 2026-10-18');
    expect(svg).not.toContain('NaN');
  });

  it('cuts to its window: from the first day in it, to the latest stored day', async () => {
    const svg = chart(await withUsers(14, 'charts:\n  cloudflare-users: { from: "2026-10-12" }\n'));
    expect(svg).toContain('Approximate users per day, 7 days to 2026-10-18');
  });

  it('says so when the window holds no day', async () => {
    const svg = chart(await withUsers(14, 'charts:\n  cloudflare-users: { from: "2030-01-01" }\n'));
    expect(svg).toContain('>No days in this window</text>');
    expect(svg).toContain('no days in this window.</desc>');
  });

  it('hides the title when charts.titles is off, keeping the legend', async () => {
    const svg = chart(await withUsers(14, 'charts:\n  titles: false\n'));
    expect(svg).not.toContain('>Daily users</text>');
    expect(svg).toContain('>Daily users (approx.)</text>');
  });

  it('animates by default, and only with animate on', async () => {
    expect(chart(await withUsers())).toContain('class="gs-draw"');
    expect(chart(await withUsers(14, 'charts:\n  animate: false\n'))).not.toContain('<style');
  });
});
