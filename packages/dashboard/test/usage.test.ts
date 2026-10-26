import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCloudflareData, parseConfig, type CloudflareData, type CloudflareSeries, type Dataset } from '@github-stats-action/core';
import { subtitle } from '../src/app';
import { usage, usageHtml } from '../src/sections/usage';

const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/dataset.json', import.meta.url), 'utf8')) as Dataset;

const rule = parseConfig(`
cloudflare:
  account-id: dd4d00309618abe546348e4b9cc7a893
  dataset: checks
  label: Update checks
  primary: { client: gui }
  dimensions:
    client: { column: blob1, label: App vs CLI }
    os:     { column: blob3, label: OS }
`).cloudflare!;

const series: CloudflareSeries = {
  schema: 1,
  dataset: 'checks',
  days: [
    {
      date: '2026-10-25',
      users: 5,
      events: 6,
      by: {
        client: { gui: { users: 3, events: 4 }, cli: { users: 2, events: 2 } },
        os: { '<b>Mac': { users: 3, events: 4 }, Linux: { users: 2, events: 2 } },
      },
    },
    {
      date: '2026-10-26',
      users: 7,
      events: 7,
      by: {
        client: { gui: { users: 5, events: 5 }, cli: { users: 2, events: 2 } },
        os: { Linux: { users: 7, events: 7 } },
      },
    },
  ],
};

const cloudflare: CloudflareData = buildCloudflareData(rule, series)!;

describe('usage section', () => {
  it('is left out of the page when the dataset has no Cloudflare figures', () => {
    // returns before it touches the DOM, which this suite does not have
    expect(usage(fixture)).toBeNull();
  });

  it('shows the 7-day average of daily users, labelled approximate, with the events outside the primary value', () => {
    const html = usageHtml(cloudflare);
    expect(html).toContain('<h2>Usage<span class="est">approximate</span></h2>');
    expect(html).toContain('<div class="l">Daily users</div><div class="v">4</div><div class="d">7-day average, approx.</div>');
    expect(html).toContain('<div class="d">plus 4 update checks outside client gui, last 7 days</div>');
  });

  it('has no events subtext without a primary value', () => {
    const plain = buildCloudflareData({ ...rule, primary: undefined }, series)!;
    const html = usageHtml(plain);
    expect(html).not.toContain('plus ');
    // every row counts: the average of 5 and 7 users
    expect(html).toContain('<div class="v">6</div>');
  });

  it('has a share table per dimension, with users, events and the share of events', () => {
    const html = usageHtml(cloudflare);
    expect(html).toContain('<h3>App vs CLI, last 30 days</h3>');
    expect(html).toContain('<tr><td>gui</td><td>8</td><td>9</td><td>69%</td></tr>');
    expect(html).toContain('<tr><td>cli</td><td>4</td><td>4</td><td>31%</td></tr>');
    expect(html).toContain('<th>Users (approx.)</th><th>Events</th><th>Share</th>');
  });

  it('shows the configured label of each value in the share tables, and the raw value without one', () => {
    const labelled = buildCloudflareData(
      { ...rule, dimensions: [{ ...rule.dimensions[0]!, values: { gui: 'App', cli: '<i>CLI</i>' } }, rule.dimensions[1]!] },
      series,
    )!;
    const html = usageHtml(labelled);
    expect(html).toContain('<tr><td>App</td><td>8</td><td>9</td><td>69%</td></tr>');
    expect(html).toContain('<tr><td>&lt;i&gt;CLI&lt;/i&gt;</td><td>4</td><td>4</td><td>31%</td></tr>');
    expect(html).toContain('<tr><td>&lt;b&gt;Mac</td>');
  });

  it('escapes the dimension values and the note', () => {
    const html = usageHtml({ ...cloudflare, note: 'Checks & <i>only</i>' });
    expect(html).toContain('<td>&lt;b&gt;Mac</td>');
    expect(html).not.toContain('<b>Mac');
    expect(html).toContain('<p class="note">Checks &amp; &lt;i&gt;only&lt;/i&gt;</p>');
  });

  it('says so when a dimension has no events in the last 30 days', () => {
    const html = usageHtml({ ...cloudflare, shares: { ...cloudflare.shares, client: [] } });
    expect(html).toContain('<p class="note">No events in the last 30 days.</p>');
  });
});

describe('subtitle with Cloudflare figures', () => {
  it('names the Cloudflare dataset after the npm downloads, in the release sentence', () => {
    expect(subtitle({ ...fixture, cloudflare })).toBe(
      'GitHub release downloads for elboletaire/manga-downloader, split into Desktop app and CLI, and update checks from Cloudflare.',
    );
  });

  it('names it among the sources when release downloads are not shown', () => {
    const page = { ...fixture, releaseDownloads: false, groups: [], totals: { ...fixture.totals, docker: null }, cloudflare };
    expect(subtitle(page)).toBe('Stars and update checks from Cloudflare for elboletaire/manga-downloader.');
  });
});
