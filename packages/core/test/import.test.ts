import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertOldSnapshot, importOldSnapshots, type OldSnapshot } from '../src/import';
import { loadConfig } from '../src/config';
import { groupNames, summariseDay } from '../src/summary';
import { buildDailyCsv } from '../src/csv';
import { readSnapshots } from '../src/store';

const OLD = new URL('../../../fixtures/old/', import.meta.url);
const CONFIG = new URL('../../../fixtures/manga-downloader.stats.yml', import.meta.url);

const oldJson = async (name: string) =>
  JSON.parse(await readFile(new URL(`snapshots/${name}`, OLD), 'utf8')) as OldSnapshot;

describe('convertOldSnapshot', () => {
  it('maps the old fields onto the new layout', async () => {
    const config = await loadConfig(CONFIG.pathname);
    const snap = convertOldSnapshot(await oldJson('2026-10-18.json'), '2026-10-18', config.docker);
    expect(snap).toMatchObject({
      schema: 1,
      date: '2026-10-18',
      takenAt: '2026-10-18T09:02:13Z',
      repo: { stars: 271, forks: 33, watchers: 3, openIssues: 3 },
      docker: { image: 'elboletaire/manga-downloader', pulls: 37673 },
    });
    expect(snap.releases[0]).toEqual({
      tag: 'v1.19.1',
      publishedAt: '2026-10-17T18:12:58Z',
      prerelease: false,
      assets: expect.arrayContaining([{ name: 'manga-downloader-gui-v1.19.1-darwin-universal.zip', downloads: 8 }]),
    });
  });

  it('drops Docker when the config has no image or the old file had none', async () => {
    const old = await oldJson('2026-10-18.json');
    expect(convertOldSnapshot(old, '2026-10-18').docker).toBeUndefined();
    expect(convertOldSnapshot({ ...old, docker: null }, '2026-10-18', 'a/b').docker).toBeUndefined();
  });

  it('refuses a version it does not know', async () => {
    await expect(async () => convertOldSnapshot({ ...(await oldJson('2026-10-18.json')), version: 2 }, '2026-10-18')).rejects.toThrow(
      'unsupported old snapshot version 2',
    );
  });
});

describe('importOldSnapshots', () => {
  it('imports the days that are missing and keeps the ones already there', async () => {
    const repo = join(await mkdtemp(join(tmpdir(), 'stats-import-')), 'o', 'r');
    const config = await loadConfig(CONFIG.pathname);
    const first = await importOldSnapshots(OLD.pathname, repo, config.docker);
    expect(first).toEqual({ imported: ['2026-10-17', '2026-10-18'], kept: [] });
    expect(await readdir(join(repo, 'snapshots'))).toEqual(['2026-10-17.json', '2026-10-18.json']);

    const second = await importOldSnapshots(OLD.pathname, repo, config.docker);
    expect(second).toEqual({ imported: [], kept: ['2026-10-17', '2026-10-18'] });
  });

  it('reproduces the app and CLI columns of the old daily.csv', async () => {
    const repo = join(await mkdtemp(join(tmpdir(), 'stats-import-')), 'o', 'r');
    const config = await loadConfig(CONFIG.pathname);
    await importOldSnapshots(OLD.pathname, repo, config.docker);
    const snapshots = await readSnapshots(repo);
    const names = groupNames(config, snapshots);
    const csv = buildDailyCsv(
      snapshots.map((s) => summariseDay(s, config, 'elboletaire/manga-downloader', names)),
      names,
    ).trim().split('\n');
    const expected = (await readFile(new URL('daily.csv', OLD), 'utf8')).trim().split('\n');

    const columns = (line: string, header: string[]) =>
      Object.fromEntries(line.split(',').map((value, i) => [header[i], value]));
    const ourHeader = csv[0]!.split(',');
    const oldHeader = expected[0]!.split(',');
    const ours = new Map(csv.slice(1).map((line) => [line.split(',')[0]!, columns(line, ourHeader)]));
    // The old file starts a day before the imported ones, and the first imported day has no
    // earlier snapshot to take its deltas from.
    const firstDay = csv[1]!.split(',')[0];
    for (const line of expected.slice(1)) {
      const want = columns(line, oldHeader);
      const got = ours.get(want.date!);
      if (!got) continue;
      for (const name of oldHeader) {
        if (want.date === firstDay && name.endsWith('_delta')) continue;
        expect(got[name], `${want.date} ${name}`).toBe(want[name]);
      }
    }
  });
});
