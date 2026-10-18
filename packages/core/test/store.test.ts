import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
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
