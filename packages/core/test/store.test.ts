import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  pruneDerived,
  readNpmSeries,
  writeNpmSeries,
  readSnapshots,
  readStargazers,
  readTraffic,
  repoDir,
  writeOutputFiles,
  writeSnapshot,
  writeStargazers,
  writeTrafficAggregates,
  type Snapshot,
} from '../src';

const tmp = () => mkdtemp(join(tmpdir(), 'stats-store-'));

const snapshot = (date: string, stars: number): Snapshot => ({
  schema: 1,
  date,
  takenAt: `${date}T09:00:00Z`,
  repo: { stars, forks: 1, watchers: 1, openIssues: 0 },
  releases: [],
});

describe('snapshot store', () => {
  it('overwrites the snapshot of a day that was already taken', async () => {
    const dir = await tmp();
    await writeSnapshot(dir, snapshot('2026-10-18', 10));
    await writeSnapshot(dir, snapshot('2026-10-18', 12));
    const files = await readdir(join(dir, 'snapshots'));
    expect(files).toEqual(['2026-10-18.json']);
    const [saved] = await readSnapshots(dir);
    expect(saved!.repo.stars).toBe(12);
  });

  it('reads the days oldest first and ignores files that are not snapshots', async () => {
    const dir = await tmp();
    await writeSnapshot(dir, snapshot('2026-10-18', 3));
    await writeSnapshot(dir, snapshot('2026-10-16', 1));
    await writeOutputFiles(dir, [{ path: 'snapshots/notes.json', content: '{}' }]);
    expect((await readSnapshots(dir)).map((s) => s.date)).toEqual(['2026-10-16', '2026-10-18']);
  });

  it('rejects a snapshot of another schema', async () => {
    const dir = await tmp();
    await writeOutputFiles(dir, [{ path: 'snapshots/2026-10-18.json', content: '{"schema":2}' }]);
    await expect(readSnapshots(dir)).rejects.toThrow('unsupported schema');
  });

  it('keeps the stargazers as a plain list, empty when missing', async () => {
    const dir = await tmp();
    expect(await readStargazers(dir)).toEqual([]);
    await writeStargazers(dir, ['2026-01-01T00:00:00Z']);
    expect(await readStargazers(dir)).toEqual(['2026-01-01T00:00:00Z']);
  });

  it('reads no traffic until some was collected, then the latest aggregates', async () => {
    const dir = await tmp();
    expect(await readTraffic(dir)).toBeUndefined();
    await writeOutputFiles(dir, [{ path: 'traffic/views.json', content: '[]' }]);
    await writeTrafficAggregates(dir, '2026-10-16', { referrers: [{ referrer: 'a', count: 1, uniques: 1 }], paths: [] });
    await writeTrafficAggregates(dir, '2026-10-18', { referrers: [{ referrer: 'b', count: 2, uniques: 2 }], paths: [] });
    const traffic = await readTraffic(dir);
    expect(traffic?.asOf).toBe('2026-10-18');
    expect(traffic?.referrers).toEqual([{ referrer: 'b', count: 2, uniques: 2 }]);
  });

  it('places a repo under owner/name', () => {
    expect(repoDir('/data', 'elboletaire/manga-downloader')).toBe('/data/elboletaire/manga-downloader');
    expect(() => repoDir('/data', 'nope')).toThrow('owner/name');
  });

  it('writes output files with their folders', async () => {
    const dir = await tmp();
    await writeOutputFiles(dir, [{ path: 'charts/stars-light.svg', content: '<svg/>' }]);
    expect(await readFile(join(dir, 'charts', 'stars-light.svg'), 'utf8')).toBe('<svg/>');
  });
});

describe('pruneDerived', () => {
  it('removes the chart and badge files no run produces, and nothing else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-prune-'));
    await writeOutputFiles(dir, [
      { path: 'charts/stars-light.svg', content: '<svg/>' },
      { path: 'charts/downloads-per-day-light.svg', content: '<svg/>' },
      { path: 'badges/downloads.json', content: '{}' },
      { path: 'snapshots/2026-01-01.json', content: '{}' },
      { path: 'npm/passcore--core.json', content: '{}' },
    ]);
    await pruneDerived(dir, [{ path: 'charts/stars-light.svg', content: '' }]);
    expect(await readdir(join(dir, 'charts'))).toEqual(['stars-light.svg']);
    expect(await readdir(join(dir, 'badges'))).toEqual([]);
    expect(await readdir(join(dir, 'snapshots'))).toEqual(['2026-01-01.json']);
    expect(await readdir(join(dir, 'npm'))).toEqual(['passcore--core.json']);
  });

  it('keeps folders and files it does not generate, and removes only stale generated ones', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-prune-'));
    await writeOutputFiles(dir, [
      { path: 'charts/stars-light.svg', content: '<svg/>' },
      { path: 'charts/downloads-per-day-light.svg', content: '<svg/>' },
      { path: 'charts/logo.svg', content: '<svg/>' },
      { path: 'badges/npm-passcore--core.json', content: '{}' },
      { path: 'badges/stars-week.json', content: '{}' },
      { path: 'badges/docker-pulls-month.svg', content: '<svg/>' },
      { path: 'badges/downloads-app-week.json', content: '{}' },
      { path: 'badges/logo.svg', content: '<svg/>' },
      { path: 'badges/stars-weekly.svg', content: '<svg/>' },
    ]);
    await mkdir(join(dir, 'charts', 'hand-made'));
    await writeFile(join(dir, 'charts', 'hand-made', 'x.svg'), '<svg/>');
    await pruneDerived(dir, [{ path: 'charts/stars-light.svg', content: '' }]);
    expect((await readdir(join(dir, 'charts'))).sort()).toEqual(['hand-made', 'logo.svg', 'stars-light.svg']);
    expect(await readdir(join(dir, 'charts', 'hand-made'))).toEqual(['x.svg']);
    expect(await readdir(join(dir, 'badges')).then((names) => names.sort())).toEqual(['logo.svg', 'stars-weekly.svg']);
  });

  it('removes the files of a dropped chart variant, and keeps the user files next to them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-prune-'));
    await writeOutputFiles(dir, [
      { path: 'charts/stars-light.svg', content: '<svg/>' },
      { path: 'charts/stars-full-light.svg', content: '<svg/>' },
      { path: 'charts/stars-full-dark.svg', content: '<svg/>' },
      { path: 'charts/downloads-per-release-recent-dark.svg', content: '<svg/>' },
      { path: 'charts/logo.svg', content: '<svg/>' },
      { path: 'charts/stars-full.svg', content: '<svg/>' },
    ]);
    await pruneDerived(dir, [{ path: 'charts/stars-light.svg', content: '' }]);
    expect((await readdir(join(dir, 'charts'))).sort()).toEqual(['logo.svg', 'stars-full.svg', 'stars-light.svg']);
  });

  it('does nothing when the derived folders do not exist yet', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-prune-'));
    await expect(pruneDerived(dir, [])).resolves.toBeUndefined();
  });
});

describe('writeNpmSeries', () => {
  it('writes one line per day and reads back the same series', async () => {
    const dir = await tmp();
    const series = {
      schema: 1 as const,
      package: '@passcore/core',
      days: [
        { date: '2026-10-16', downloads: 3 },
        { date: '2026-10-17', downloads: 5 },
      ],
    };
    await writeNpmSeries(dir, series);
    const text = await readFile(join(dir, 'npm', 'passcore--core.json'), 'utf8');
    expect(text.split('\n').filter((line) => line.includes('"date"'))).toEqual([
      '  {"date":"2026-10-16","downloads":3},',
      '  {"date":"2026-10-17","downloads":5}',
    ]);
    expect(await readNpmSeries(dir, '@passcore/core')).toEqual(series);
  });
});
