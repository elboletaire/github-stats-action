import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildDataset, type BuildInput } from '../src/dataset';
import { parseConfig } from '../src/config';
import type { Dataset, Snapshot, SnapshotRelease } from '../src/types';
import { buildFixtureDataset } from '../../../scripts/fixture-dataset';

const FIXTURES = new URL('../../../fixtures/', import.meta.url);
const readFixture = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(new URL(path, FIXTURES), 'utf8')) as T;

// The numbers the current dashboard (~/.claude/skills/download-stats/build_dashboard.py)
// gives for the same releases; fixtures/reference-releases.json holds its per-release values.
const REFERENCE = {
  app: 373,
  cli: 11828,
  updates: { counted: 4, all: 8 },
  docker: 37673,
  stars: 271,
};

const config = parseConfig(`
groups:
  - { name: app, label: Desktop app, assets: "manga-downloader-gui-*" }
  - { name: cli, label: CLI, assets: "manga-downloader-*" }
ignore: ["*.md5", "*-SHA256SUMS.txt"]
counters:
  - { name: updates, label: In-app updates, assets: "manga-downloader-gui-*-SHA256SUMS.txt", from: v1.19.0 }
epochs:
  - { version: v1.11.0, label: First desktop app }
  - { version: v1.18.0, label: Installer and updater }
  - { version: v1.20.0, label: Multilingual }
`);

let fixture: Dataset;
let reference: { tag: string; app: number; cli: number; updates: number }[];

describe('Dataset maths against the reference dashboard', () => {
  it('totals per group, Docker, stars and counters match', async () => {
    fixture = await buildFixtureDataset();
    reference = await readFixture('reference-releases.json');
    expect(fixture.totals.groups).toEqual({ app: REFERENCE.app, cli: REFERENCE.cli });
    expect(fixture.totals.downloads).toBe(REFERENCE.app + REFERENCE.cli);
    expect(fixture.totals.docker).toBe(REFERENCE.docker);
    expect(fixture.totals.stars).toBe(REFERENCE.stars);
    expect(fixture.totals.counters.updates).toEqual({ downloads: REFERENCE.updates.counted, all: REFERENCE.updates.all });
  });

  it('per release app and CLI downloads match, in publish order', async () => {
    fixture ??= await buildFixtureDataset();
    reference ??= await readFixture('reference-releases.json');
    expect(fixture.releases.map((r) => r.tag)).toEqual(reference.map((r) => r.tag));
    fixture.releases.forEach((r, i) => {
      const want = reference[i]!;
      expect({ tag: r.tag, app: r.groups.app, cli: r.groups.cli }).toEqual({ tag: want.tag, app: want.app, cli: want.cli });
      expect(r.counters.updates!.downloads).toBe(want.updates);
    });
  });

  it('periods sum to the reference periods (v1.18.0 onwards is two periods here)', async () => {
    fixture ??= await buildFixtureDataset();
    const [early, v100, v111, v118, v120] = fixture.periods;
    expect(early!.groups).toEqual({ app: 0, cli: 9939 }); // reference v0.0.x
    expect(v100!.groups).toEqual({ app: 0, cli: 1552 }); // reference v1.0.0 to v1.10.0
    expect(v111!.groups).toEqual({ app: 261, cli: 258 });
    expect({
      app: v118!.groups.app! + v120!.groups.app!,
      cli: v118!.groups.cli! + v120!.groups.cli!,
    }).toEqual({ app: 112, cli: 79 });
    expect(fixture.periods.reduce((sum, p) => sum + p.downloads, 0)).toBe(fixture.totals.downloads);
  });

  it('period medians and averages over whole days match the reference', async () => {
    fixture ??= await buildFixtureDataset();
    const p = fixture.periods[2]!;
    expect(p).toMatchObject({ version: 'v1.11.0', releases: 10, firstTag: 'v1.11.0', lastTag: 'v1.17.0', fullDays: 5 });
    expect(p.days).toBeCloseTo(5.887, 2);
    expect(p.medianPerDay.app ?? NaN).toBeCloseTo(35.6, 1);
    expect(p.medianPerDay.cli ?? NaN).toBeCloseTo(36.03, 1);
    expect(p.medianPerDayTotal).toBeCloseTo(70.72, 1);
    expect(p.avgPerDayTotal).toBeCloseTo(88.16, 1);
  });

  it('the estimated daily values add up to the totals', async () => {
    fixture ??= await buildFixtureDataset();
    for (const name of ['app', 'cli']) {
      const sum = fixture.estimatedDaily.groups[name]!.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(fixture.totals.groups[name]!, 6);
    }
    expect(fixture.estimatedDaily.start).toBe('2022-12-31');
    expect(fixture.estimatedDaily.groups.app).toHaveLength(1388);
  });

  it('the fixture dataset is what the fixtures build (regenerate with pnpm fixtures)', async () => {
    fixture ??= await buildFixtureDataset();
    expect(await readFixture<Dataset>('dataset.json')).toEqual(JSON.parse(JSON.stringify(fixture)));
  });
});

describe('Dataset maths on small inputs', () => {
  const file = { name: 'manga-downloader-linux-amd64.tar.gz', downloads: 1 };
  const rel = (tag: string, publishedAt: string, assets: SnapshotRelease['assets'] = []): SnapshotRelease => ({
    tag,
    publishedAt,
    prerelease: false,
    assets,
  });
  const snap = (date: string, releases: SnapshotRelease[], stars = 1): Snapshot => ({
    schema: 1,
    date,
    takenAt: `${date}T10:00:00Z`,
    repo: { stars, forks: 0, watchers: 0, openIssues: 0 },
    releases,
  });
  const build = (input: Partial<BuildInput> & Pick<BuildInput, 'snapshots' | 'now'>): Dataset =>
    buildDataset({ repo: 'o/r', config, ...input });

  it('spreads a release evenly over its live window, and stops at the build day', () => {
    const d = build({
      snapshots: [snap('2026-01-03', [rel('v1.0.0', '2026-01-01T00:00:00Z', [{ name: 'manga-downloader-gui-v1.0.0-linux.tar.gz', downloads: 100 }])])],
      now: new Date('2026-01-03T00:00:00Z'),
    });
    expect(d.estimatedDaily.start).toBe('2026-01-01');
    expect(d.estimatedDaily.groups.app).toEqual([50, 50, 0]);
  });

  it('counts a release published after now as an empty window, not a negative one', () => {
    const d = build({
      snapshots: [snap('2026-01-03', [rel('v1.0.0', '2026-01-05T00:00:00Z', [{ name: 'manga-downloader-v1.0.0.tar.gz', downloads: 7 }])])],
      now: new Date('2026-01-03T00:00:00Z'),
    });
    expect(d.releases[0]).toMatchObject({ days: 0, end: '2026-01-05T00:00:00.000Z' });
    expect(d.periods[0]!.days).toBe(0);
  });

  it('gives the measured change over a gap its span in days', () => {
    const r1 = [rel('v1.0.0', '2026-01-01T00:00:00Z', [{ name: 'manga-downloader-v1.0.0.tar.gz', downloads: 10 }])];
    const r2 = [rel('v1.0.0', '2026-01-01T00:00:00Z', [{ name: 'manga-downloader-v1.0.0.tar.gz', downloads: 16 }])];
    const d = build({ snapshots: [snap('2026-01-02', r1, 5), snap('2026-01-05', r2, 4)], now: new Date('2026-01-05T12:00:00Z') });
    expect(d.measuredDaily).toEqual([
      { date: '2026-01-05', days: 3, groups: { app: 0, cli: 6 }, stars: -1, docker: null, counters: { updates: 0 } },
    ]);
  });

  it('gives the periods of epochs without releases a null span, and sorts other as its own group', () => {
    const withLate = parseConfig(`${'groups:\n  - { name: cli, assets: "manga-downloader-*" }\n'}epochs:\n  - { version: v9.0.0, label: Later }\n`);
    const d = buildDataset({
      repo: 'o/r',
      config: withLate,
      snapshots: [snap('2026-01-02', [rel('v1.0.0', '2026-01-01T00:00:00Z', [{ name: 'notes.pdf', downloads: 3 }, { name: 'manga-downloader-x.tar.gz', downloads: 1 }])])],
      now: new Date('2026-01-02T00:00:00Z'),
    });
    expect(d.groups.map((g) => g.name)).toEqual(['cli', 'other']);
    expect(d.totals.groups).toEqual({ cli: 1, other: 3 });
    expect(d.periods.at(-1)).toMatchObject({ version: 'v9.0.0', start: null, releases: 0, medianPerDayTotal: null });
  });

  it('hides release downloads when no asset counts, or when the releases switch is off', () => {
    const unCounted = build({
      snapshots: [snap('2026-10-18', [rel('v1.0.0', '2026-01-01T00:00:00Z', [{ name: 'notes.md5', downloads: 9 }])], 7)],
      now: new Date('2026-10-18T00:00:00Z'),
    });
    expect(unCounted).toMatchObject({ releaseDownloads: false, releases: [], periods: [], groups: [], totals: { downloads: 0 } });
    expect(unCounted.totals.stars).toBe(7);

    const switched = buildDataset({
      repo: 'o/r',
      config: { ...config, releases: false },
      snapshots: [snap('2026-10-18', [rel('v1.0.0', '2026-01-01T00:00:00Z', [file])])],
      now: new Date('2026-10-18T00:00:00Z'),
    });
    expect(switched).toMatchObject({ releaseDownloads: false, releases: [], groups: [] });
  });

  it('assigns epochs by version, a non-version tag inheriting the release before it', () => {
    const d = build({
      snapshots: [
        snap('2026-10-18', [
          rel('v1.10.0', '2026-01-01T00:00:00Z', [file]),
          rel('v1.11.0', '2026-02-01T00:00:00Z', [file]),
          rel('v1.18.0', '2026-03-01T00:00:00Z', [file]),
          rel('nightly', '2026-03-02T00:00:00Z', [file]),
          rel('v1.20.0', '2026-04-01T00:00:00Z', [file]),
        ]),
      ],
      now: new Date('2026-10-18T00:00:00Z'),
    });
    expect(d.releases.map((r) => [r.tag, r.epoch])).toEqual([
      ['v1.10.0', -1],
      ['v1.11.0', 0],
      ['v1.18.0', 1],
      ['nightly', 1],
      ['v1.20.0', 2],
    ]);
  });

  it('counts a release for a counter from its version on, and every release when there is no from', () => {
    const c = parseConfig('counters:\n  - { name: updates, assets: "*-SHA256SUMS.txt", from: v1.19.0 }\n  - { name: all, assets: "*" }\n');
    const d = buildDataset({
      repo: 'o/r',
      config: c,
      snapshots: [
        snap('2026-10-18', [
          rel('v1.18.0', '2026-01-01T00:00:00Z', [{ name: 'x-SHA256SUMS.txt', downloads: 4 }]),
          rel('nightly', '2026-01-02T00:00:00Z', [{ name: 'x-SHA256SUMS.txt', downloads: 5 }]),
          rel('v1.19.0', '2026-01-03T00:00:00Z', [{ name: 'x-SHA256SUMS.txt', downloads: 6 }]),
        ]),
      ],
      now: new Date('2026-10-18T00:00:00Z'),
    });
    expect(d.totals.counters).toEqual({ updates: { downloads: 6, all: 15 }, all: { downloads: 15, all: 15 } });
    expect(d.releases.map((r) => r.counters.updates!.counted)).toEqual([false, false, true]);
  });

  it('with no epochs there is one period over every release, and no markers', () => {
    const groupsOnly = parseConfig('groups:\n  - { name: cli, assets: "manga-downloader-*" }\n');
    const d = buildDataset({
      repo: 'o/r',
      config: groupsOnly,
      snapshots: [
        snap('2026-01-02', [
          rel('v0.9.0', '2026-01-01T00:00:00Z', [{ name: 'manga-downloader-v0.9.0.tar.gz', downloads: 2 }]),
          rel('v2.0.0', '2026-01-02T00:00:00Z', [{ name: 'manga-downloader-v2.0.0.tar.gz', downloads: 3 }]),
        ]),
      ],
      now: new Date('2026-01-03T00:00:00Z'),
    });
    expect(d.epochs).toEqual([]);
    expect(d.releases.map((r) => r.epoch)).toEqual([-1, -1]);
    expect(d.periods).toHaveLength(1);
    expect(d.periods[0]).toMatchObject({ epoch: -1, version: null, label: null, releases: 2, firstTag: 'v0.9.0', lastTag: 'v2.0.0' });
    expect(d.periods[0]!.groups).toEqual({ cli: 5 });
    expect(d.estimatedDaily.groups.cli).toHaveLength(3);
    expect(d.measuredDaily).toEqual([]);
  });

  it('refuses to build without snapshots', () => {
    expect(() => build({ snapshots: [], now: new Date() })).toThrow('at least one snapshot');
  });
});
