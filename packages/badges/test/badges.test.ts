import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addDays,
  buildCloudflareData,
  buildNpmData,
  type CloudflareRule,
  type CloudflareSeries,
  type Dataset,
  type MeasuredDay,
  pruneDerived,
  writeOutputFiles,
} from '@github-stats-action/core';
import { describe, expect, it } from 'vitest';
import { buildBadges, COLORS, endpointJson, renderBadges, unknownBadges } from '../src/badges';
import { flatSvg } from '../src/svg';

const fixture: Dataset = JSON.parse(readFileSync(join(import.meta.dirname, '../../../fixtures/dataset.json'), 'utf8'));
const LATEST = '2026-10-18';

function dataset(overrides: Partial<Dataset>): Dataset {
  return { ...fixture, ...overrides };
}

/** One measured day: `app` and `cli` downloads gained since the previous snapshot, `days` days after it. */
function entry(date: string, days = 1, app = 1, cli = 2, docker: number | null = null): MeasuredDay {
  return { date, days, groups: { app, cli }, stars: 0, docker, counters: {} };
}

/** `count` consecutive measured days ending on `latest`, each with one snapshot a day. */
function consecutive(count: number, latest = LATEST, docker: (i: number) => number | null = () => null): MeasuredDay[] {
  return Array.from({ length: count }, (_, i) => entry(addDays(latest, i - count + 1), 1, 1, 2, docker(i)));
}

/** Stars at the end of each of `count` days ending on `latest`: one more star a day. */
function starsRun(count: number, latest = LATEST): Dataset['stars'] {
  return Array.from({ length: count }, (_, i) => ({ date: addDays(latest, i - count + 1), stars: i + 1 }));
}

const message = (badges: ReturnType<typeof buildBadges>, name: string) => badges.find((b) => b.name === name)?.message;

describe('buildBadges', () => {
  it('produces the total, one per group, the latest release, stars, Docker and each counter', () => {
    const badges = buildBadges({ ...fixture, measuredDaily: [], stars: [] });
    expect(badges.map((b) => b.name)).toEqual([
      'downloads',
      'downloads-app',
      'downloads-cli',
      'release-latest',
      'stars',
      'docker-pulls',
      'counter-updates',
    ]);
    expect(badges[0]).toMatchObject({ label: 'downloads', message: '12.2k' });
    expect(badges[2]).toMatchObject({ label: 'downloads (CLI)', message: '11.8k' });
  });

  it('labels the latest release with its tag and skips prereleases', () => {
    const latest = fixture.releases.at(-1)!;
    const badge = buildBadges(fixture).find((b) => b.name === 'release-latest')!;
    expect(badge.label).toBe(`${latest.tag} downloads`);
    const withPrerelease = dataset({
      releases: [...fixture.releases, { ...latest, tag: 'v9.0.0-rc.1', prerelease: true }],
    });
    expect(buildBadges(withPrerelease).find((b) => b.name === 'release-latest')!.label).toBe(`${latest.tag} downloads`);
  });

  it('drops the Docker badge when no pulls were ever collected', () => {
    const badges = buildBadges(dataset({ totals: { ...fixture.totals, docker: null } }));
    expect(badges.some((b) => b.name === 'docker-pulls')).toBe(false);
  });

  it('gives a counter with no counted downloads a zero', () => {
    const badges = buildBadges(dataset({ totals: { ...fixture.totals, counters: {} } }));
    expect(badges.find((b) => b.name === 'counter-updates')!.message).toBe('0');
  });
});

describe('release period badges', () => {
  it('sums the last 7 and 30 measured days ending on the latest one, per group too', () => {
    const badges = buildBadges(dataset({ measuredDaily: consecutive(40), stars: [] }));
    expect(badges.find((b) => b.name === 'downloads-week')).toMatchObject({ label: 'downloads', message: '21/week' });
    expect(badges.find((b) => b.name === 'downloads-month')).toMatchObject({ message: '90/month' });
    expect(message(badges, 'downloads-app-week')).toBe('7/week');
    expect(message(badges, 'downloads-cli-month')).toBe('60/month');
    expect(badges.find((b) => b.name === 'downloads-app-week')!.label).toBe('downloads (Desktop app)');
  });

  it('counts a gap once: a delta over several days is in the window it ends in', () => {
    // snapshots on L-7, then L-4 (a 3-day delta), then daily: the week is the snapshot L-7 to L
    const measured = [entry(addDays(LATEST, -4), 3, 9, 0), ...consecutive(4)];
    const badges = buildBadges(dataset({ measuredDaily: measured, stars: [] }));
    expect(message(badges, 'downloads-app-week')).toBe('13/week');
  });

  it('leaves the week out with 6 measured days and the month out with 29', () => {
    const badges = buildBadges(dataset({ measuredDaily: consecutive(6), stars: [] }));
    expect(badges.some((b) => b.name.endsWith('-week') || b.name.endsWith('-month'))).toBe(false);
    const short = buildBadges(dataset({ measuredDaily: consecutive(29), stars: [] }));
    expect(short.find((b) => b.name === 'downloads-week')).toBeDefined();
    expect(short.find((b) => b.name === 'downloads-month')).toBeUndefined();
  });

  it('leaves a window out when a gap spans its first day', () => {
    // no snapshot on L-7: the delta from L-9 to L-5 covers it
    const measured = [entry(addDays(LATEST, -5), 4), ...consecutive(5).slice(1)];
    const badges = buildBadges(dataset({ measuredDaily: measured, stars: [] }));
    expect(badges.some((b) => b.name === 'downloads-week')).toBe(false);
  });

  it('shows no period badges without release downloads', () => {
    const badges = buildBadges({ ...fixture, releaseDownloads: false, groups: [], counters: [], releases: [], measuredDaily: consecutive(40), stars: [] });
    expect(badges.some((b) => b.name.startsWith('downloads'))).toBe(false);
  });

  it('hides a window that shrank, since a removed release makes its sum negative', () => {
    const measured = consecutive(10).map((day) => ({ ...day, groups: { app: -5, cli: 10 } }));
    const badges = buildBadges(dataset({ measuredDaily: measured, stars: [] }));
    expect(badges.some((b) => b.name === 'downloads-app-week')).toBe(false);
    expect(message(badges, 'downloads-week')).toBe('35/week');
  });
});

describe('stars period badges', () => {
  it('shows the stars gained over the last 7 and 30 days', () => {
    const badges = buildBadges(dataset({ measuredDaily: [], stars: starsRun(40) }));
    expect(badges.find((b) => b.name === 'stars-week')).toMatchObject({ label: 'stars', message: '+7 this week' });
    expect(badges.find((b) => b.name === 'stars-month')).toMatchObject({ message: '+30 this month' });
  });

  it('counts every star from the first one when the series starts inside the window', () => {
    expect(message(buildBadges(dataset({ measuredDaily: [], stars: starsRun(3) })), 'stars-week')).toBe('+3 this week');
  });

  it('shows a negative count when stars were removed', () => {
    const stars = [
      ...starsRun(8).slice(0, 1).map((p) => ({ ...p, stars: 8 })),
      ...Array.from({ length: 7 }, (_, i) => ({ date: addDays(LATEST, i - 6), stars: 5 })),
    ];
    expect(message(buildBadges(dataset({ measuredDaily: [], stars })), 'stars-week')).toBe('-3 this week');
  });

  it('drops the period badges without a star series', () => {
    const names = buildBadges(dataset({ measuredDaily: [], stars: [] })).map((b) => b.name);
    expect(names.some((n) => n.startsWith('stars-'))).toBe(false);
  });
});

describe('Docker month badge', () => {
  it('sums the pulls of the last 30 measured days', () => {
    const measured = consecutive(31, LATEST, () => 100);
    const badge = buildBadges(dataset({ measuredDaily: measured, stars: [] })).find((b) => b.name === 'docker-pulls-month');
    expect(badge).toMatchObject({ label: 'docker pulls', message: '3k/month' });
  });

  it('is left out when a day in the window has no Docker count', () => {
    const measured = consecutive(31, LATEST, (i) => (i === 25 ? null : 100));
    expect(buildBadges(dataset({ measuredDaily: measured, stars: [] })).some((b) => b.name === 'docker-pulls-month')).toBe(false);
  });
});

describe('endpointJson', () => {
  it('is the shields.io endpoint shape', () => {
    const json = JSON.parse(endpointJson({ name: 'stars', label: 'stars', message: '1.2k', color: 'yellow' }));
    expect(json).toEqual({ schemaVersion: 1, label: 'stars', message: '1.2k', color: 'yellow' });
  });
});

describe('badge colours', () => {
  const measured = dataset({ measuredDaily: consecutive(40), stars: [] });
  const colour = (badges: ReturnType<typeof buildBadges>, name: string) => badges.find((b) => b.name === name)?.color;

  it('keeps the default colours without a configuration', () => {
    expect(colour(buildBadges(measured), 'downloads')).toBe(COLORS.total);
    expect(colour(buildBadges(measured), 'downloads-week')).toBe(COLORS.total);
  });

  it('applies a configured colour to its badge only', () => {
    const badges = buildBadges(measured, { downloads: { color: '4cb70e' } });
    expect(colour(badges, 'downloads')).toBe('4cb70e');
    expect(colour(badges, 'downloads-app')).toBe(COLORS.group);
    expect(colour(badges, 'stars')).toBe(COLORS.stars);
  });

  it('gives a period badge its base badge colour', () => {
    const badges = buildBadges(measured, { downloads: { color: '4cb70e' } });
    expect(colour(badges, 'downloads-week')).toBe('4cb70e');
    expect(colour(badges, 'downloads-month')).toBe('4cb70e');
  });

  it('lets a period badge with its own entry keep it over its base', () => {
    const badges = buildBadges(measured, { downloads: { color: '4cb70e' }, 'downloads-week': { color: 'ff0000' } });
    expect(colour(badges, 'downloads-week')).toBe('ff0000');
    expect(colour(badges, 'downloads-month')).toBe('4cb70e');
  });

  it('does not colour a counter named like a period from its base', () => {
    const counters = [{ ...fixture.counters[0]!, name: 'x-week', label: 'x' }];
    const badges = buildBadges(dataset({ counters, measuredDaily: [], stars: [] }), { 'counter-x': { color: 'ff0000' } });
    expect(colour(badges, 'counter-x-week')).toBe(COLORS.counter);
    expect(unknownBadges(dataset({ counters, measuredDaily: [], stars: [] }), { 'counter-x': { color: 'ff0000' } })).toEqual(['counter-x']);
  });

  it('knows the period badges the history is too short for, so they are not reported', () => {
    const short = dataset({ measuredDaily: [], stars: [] });
    expect(message(buildBadges(short), 'downloads-week')).toBeUndefined();
    const configured = { 'downloads-week': { color: '000000' }, 'stars-month': { color: '000000' }, nope: { color: '000000' } };
    expect(unknownBadges(short, configured)).toEqual(['nope']);
  });

  it('reports the configured names that no badge could take', () => {
    const configured = { downloads: { color: '4cb70e' }, 'downloads-cli': { color: 'ff0000' }, nope: { color: '000000' } };
    expect(unknownBadges(measured, configured)).toEqual(['nope']);
  });
});

describe('renderBadges', () => {
  it('writes a JSON and an SVG per badge under badges/', () => {
    const files = renderBadges(fixture);
    const badges = buildBadges(fixture);
    expect(files).toHaveLength(badges.length * 2);
    expect(files.map((f) => f.path)).toContain('badges/downloads.json');
    expect(files.map((f) => f.path)).toContain('badges/downloads.svg');
    for (const file of files) expect(file.path).toMatch(/^badges\/[a-z0-9-]+\.(json|svg)$/);
  });

  it('names every badge the stored-file pruning keeps, so a stale one is removed and a hand-made one survives', async () => {
    const full = dataset({
      measuredDaily: consecutive(40, LATEST, () => 100),
      stars: starsRun(40),
      totals: { ...fixture.totals, docker: 1 },
      npm: buildNpmData([
        { label: 'Core', series: { schema: 1, package: '@passcore/core', days: [{ date: LATEST, downloads: 1 }] } },
      ]),
    });
    const names = renderBadges(full).map((f) => f.path);
    expect(names).toContain('badges/downloads-month.svg');
    expect(names).toContain('badges/docker-pulls-month.svg');
    expect(names).toContain('badges/stars-week.svg');
    expect(names).toContain('badges/npm-passcore--core-week.svg');

    const dir = await mkdtemp(join(tmpdir(), 'badges-prune-'));
    await writeOutputFiles(dir, renderBadges(full));
    await writeFile(join(dir, 'badges', 'stars-weekly.svg'), '<svg/>');
    await pruneDerived(dir, []);
    expect(await readdir(join(dir, 'badges'))).toEqual(['stars-weekly.svg']);
  });
});

describe('flatSvg', () => {
  it('has the label and message as escaped text and an aria-label', () => {
    const svg = flatSvg({ label: 'a < b', message: '1&2', color: 'blue' });
    expect(svg).toContain('aria-label="a &lt; b: 1&amp;2"');
    expect(svg).toContain('>a &lt; b</text>');
    expect(svg).toContain('>1&amp;2</text>');
    expect(svg).not.toContain('a < b');
  });

  it('resolves shields.io colour names and hex codes', () => {
    expect(flatSvg({ label: 'x', message: 'y', color: 'blue' })).toContain('fill="#007ec6"');
    expect(flatSvg({ label: 'x', message: 'y', color: '8957e5' })).toContain('fill="#8957e5"');
  });

  it('refuses a colour that is neither a name nor hex, so it cannot inject markup', () => {
    expect(() => flatSvg({ label: 'x', message: 'y', color: '"><script>' })).toThrow(/not a badge colour/);
  });

  it('sizes the two parts to their text plus padding', () => {
    const svg = flatSvg({ label: 'downloads', message: '12.2k', color: 'blue' });
    // 58.4px + 31.4px of text, 10px padding each part; shields.io rounds the same badge to 110.
    expect(svg).toMatch(/<svg [^>]*width="109"/);
    expect(svg).toContain('<rect x="68" width="41"');
  });
});

describe('npm and release badges', () => {
  const npm = buildNpmData([
    { label: 'Core', series: { schema: 1, package: '@passcore/core', days: [{ date: '2026-10-16', downloads: 90 }, { date: '2026-10-17', downloads: 10 }] } },
    { label: 'plain', series: { schema: 1, package: 'plain', days: [{ date: '2026-10-17', downloads: 1200 }] } },
  ]);

  it('adds the combined npm badges and one per package, after Docker', () => {
    const names = buildBadges({ ...fixture, npm, measuredDaily: [], stars: [] }).map((b) => b.name);
    expect(names.slice(names.indexOf('docker-pulls') + 1, names.indexOf('counter-updates'))).toEqual([
      'npm-downloads',
      'npm-downloads-week',
      'npm-downloads-total',
      'npm-passcore--core',
      'npm-passcore--core-week',
      'npm-plain',
      'npm-plain-week',
    ]);
    const badges = buildBadges({ ...fixture, npm, measuredDaily: [], stars: [] });
    expect(badges.find((b) => b.name === 'npm-downloads')).toMatchObject({ label: 'npm downloads/month', message: '1.3k' });
    expect(badges.find((b) => b.name === 'npm-downloads-week')).toMatchObject({ label: 'npm downloads/week', message: '1.3k' });
    expect(badges.find((b) => b.name === 'npm-downloads-total')).toMatchObject({ label: 'npm downloads', message: '1.3k total' });
    expect(message(badges, 'npm-passcore--core')).toBe('100');
    expect(message(badges, 'npm-plain-week')).toBe('1.2k');
  });

  it('leaves out the release badges without release downloads, keeping stars and npm', () => {
    const badges = buildBadges({ ...fixture, releaseDownloads: false, groups: [], counters: [], releases: [], npm, measuredDaily: [], stars: [] });
    expect(badges.map((b) => b.name)).toEqual([
      'stars',
      'docker-pulls',
      'npm-downloads',
      'npm-downloads-week',
      'npm-downloads-total',
      'npm-passcore--core',
      'npm-passcore--core-week',
      'npm-plain',
      'npm-plain-week',
    ]);
  });
});

describe('cloudflare badges', () => {
  const rule: CloudflareRule = {
    accountId: '0'.repeat(32),
    dataset: 'manga_downloader_checks',
    label: 'Update checks',
    users: 'index1',
    dimensions: [{ name: 'client', label: 'App vs CLI', column: 'blob1' }],
  };
  // users rise a day from 10 to 23, so the last seven average 20
  const series: CloudflareSeries = {
    schema: 1,
    dataset: rule.dataset,
    days: Array.from({ length: 14 }, (_, i) => ({
      date: addDays('2026-10-18', i - 13),
      users: 10 + i,
      events: 2 * (10 + i),
      by: { client: { gui: { users: 10 + i, events: 2 * (10 + i) } } },
    })),
  };
  const cloudflare = buildCloudflareData(rule, series);

  it('adds the daily users badges after Docker, before the counters, only with Cloudflare days', () => {
    const names = buildBadges({ ...fixture, cloudflare, measuredDaily: [], stars: [] }).map((b) => b.name);
    expect(names.slice(names.indexOf('docker-pulls') + 1, names.indexOf('counter-updates'))).toEqual(['users-daily', 'users-daily-month', 'users-daily-latest']);
    expect(buildBadges({ ...fixture, measuredDaily: [], stars: [] }).map((b) => b.name)).not.toContain('users-daily');
  });

  it('shows the 7-day and 30-day averages and the latest day, labelled with the latest date', () => {
    const badges = buildBadges({ ...fixture, cloudflare, measuredDaily: [], stars: [] });
    expect(badges.find((b) => b.name === 'users-daily')).toMatchObject({ label: 'avg daily users (7d)', message: '20' });
    expect(badges.find((b) => b.name === 'users-daily-month')).toMatchObject({ label: 'avg daily users (30d)', message: '17' });
    expect(badges.find((b) => b.name === 'users-daily-latest')).toMatchObject({ label: 'users on 2026-10-18', message: '23' });
  });

  it('takes the configured colours, and treats the names as known only with Cloudflare days', () => {
    const configured = { 'users-daily-latest': { color: 'ff0000' } };
    const badges = buildBadges({ ...fixture, cloudflare, measuredDaily: [], stars: [] }, configured);
    expect(badges.find((b) => b.name === 'users-daily')?.color).toBe(COLORS.users);
    expect(badges.find((b) => b.name === 'users-daily-month')?.color).toBe(COLORS.users);
    expect(badges.find((b) => b.name === 'users-daily-latest')?.color).toBe('ff0000');
    expect(unknownBadges({ ...fixture, cloudflare }, { 'users-daily': { color: 'ff0000' } })).toEqual([]);
    expect(unknownBadges(fixture, { 'users-daily': { color: 'ff0000' } })).toEqual(['users-daily']);
  });

  it('prunes the daily users files once the dataset no longer has them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'badges-users-'));
    await writeOutputFiles(dir, renderBadges({ ...fixture, cloudflare, measuredDaily: [], stars: [] }));
    expect(await readdir(join(dir, 'badges'))).toContain('users-daily-latest.svg');
    await writeFile(join(dir, 'badges', 'stars-weekly.svg'), '<svg/>');
    await pruneDerived(dir, []);
    expect(await readdir(join(dir, 'badges'))).toEqual(['stars-weekly.svg']);
  });
});
