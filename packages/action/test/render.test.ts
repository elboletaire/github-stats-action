import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  importOldSnapshots,
  loadConfig,
  mergeTrafficDays,
  repoDir,
  toTrafficResponse,
  writeStargazers,
  writeTrafficAggregates,
  writeTrafficSeries,
  type Dataset,
  type TrafficRaw,
} from '@github-stats-action/core';
import { runCli } from '../src/cli';
import { renderData } from '../src/render';

const FIXTURES = new URL('../../../fixtures/', import.meta.url);
const CONFIG = new URL('manga-downloader.stats.yml', FIXTURES).pathname;
const REPO = 'elboletaire/manga-downloader';
const log = { info: vi.fn(), warning: vi.fn() };

const read = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(new URL(path, FIXTURES), 'utf8')) as T;

/** A data branch folder built from the fixtures: the old snapshots, stargazers and traffic. */
async function fixtureData(root: string, repo = REPO): Promise<void> {
  const dir = repoDir(root, repo);
  const config = await loadConfig(CONFIG);
  await importOldSnapshots(new URL('old', FIXTURES).pathname, dir, config.docker);
  await writeStargazers(dir, await read<string[]>('stargazers.json'));
  const raw: TrafficRaw = {
    views: await read('traffic/views.json'),
    clones: await read('traffic/clones.json'),
    referrers: await read('traffic/referrers.json'),
    paths: await read('traffic/paths.json'),
  };
  const traffic = toTrafficResponse(raw);
  await writeTrafficSeries(dir, 'views', mergeTrafficDays([], traffic.views));
  await writeTrafficSeries(dir, 'clones', mergeTrafficDays([], traffic.clones));
  await writeTrafficAggregates(dir, '2026-10-18', traffic);
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('render from a data folder', () => {
  it('rebuilds the dataset and the outputs without calling the network', async () => {
    const data = await mkdtemp(join(tmpdir(), 'render-data-'));
    const out = await mkdtemp(join(tmpdir(), 'render-out-'));
    await fixtureData(data);
    const network = vi.fn(() => {
      throw new Error('render must not fetch');
    });
    vi.stubGlobal('fetch', network);

    const result = await renderData({
      dataRoot: data,
      outDir: out,
      config: await loadConfig(CONFIG),
      now: new Date('2026-10-18T13:00:00Z'),
      log,
    });

    expect(network).not.toHaveBeenCalled();
    const dataset = JSON.parse(await readFile(join(out, REPO, 'dataset.json'), 'utf8')) as Dataset;
    expect(dataset.totals.groups).toEqual({ app: 358, cli: 11814 });
    expect(dataset.totals.stars).toBe(271);
    expect(dataset.traffic?.asOf).toBe('2026-10-18');
    expect(dataset.snapshotAt).toBe('2026-10-18T09:02:13Z');
    expect(await readFile(join(out, REPO, 'daily.csv'), 'utf8')).toContain('2026-10-18,358,11814,12172');
    expect(result.datasets).toEqual([dataset]);
  });

  it('needs --repo when the folder holds more than one repo', async () => {
    const data = await mkdtemp(join(tmpdir(), 'render-data-'));
    await fixtureData(data);
    await fixtureData(data, 'elboletaire/other');
    const config = await loadConfig(CONFIG);
    const base = { dataRoot: data, outDir: await mkdtemp(join(tmpdir(), 'render-out-')), config, now: new Date(), log };

    await expect(renderData(base)).rejects.toThrow('pick one with --repo');
    const picked = await renderData({ ...base, repo: 'elboletaire/other' });
    expect(picked.datasets[0]!.repo).toBe('elboletaire/other');
  });

  it('fails clearly on a folder without snapshots', async () => {
    const data = await mkdtemp(join(tmpdir(), 'render-empty-'));
    await expect(
      renderData({ dataRoot: data, outDir: data, config: await loadConfig(CONFIG), now: new Date(), log }),
    ).rejects.toThrow('no snapshots under');
  });
});

describe('render from a git ref', () => {
  it('reads the branch with git and leaves the working tree alone', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'render-git-'));
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'dev@example.com');
    git(repo, 'config', 'user.name', 'dev');
    await writeFile(join(repo, 'README.md'), 'code\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'init');
    git(repo, 'checkout', '-q', '--orphan', 'stats-data');
    git(repo, 'rm', '-rq', '--cached', '.');
    await rm(join(repo, 'README.md'));
    await fixtureData(repo);
    await writeFile(join(repo, 'notes.txt'), 'not data\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'data');
    git(repo, 'checkout', '-q', 'main');
    const before = git(repo, 'status', '--porcelain');

    const out = await mkdtemp(join(tmpdir(), 'render-out-'));
    const code = await runCli(['render', '--from-branch', 'stats-data', '--out', out, '--config', CONFIG], repo);

    expect(code).toBe(0);
    const dataset = JSON.parse(await readFile(join(out, REPO, 'dataset.json'), 'utf8')) as Dataset;
    expect(dataset.totals.groups).toEqual({ app: 358, cli: 11814 });
    expect(git(repo, 'branch', '--show-current')).toBe('main');
    expect(git(repo, 'status', '--porcelain')).toBe(before);
    expect(await readFile(join(repo, 'README.md'), 'utf8')).toBe('code\n');
    expect(await readdir(repo)).not.toContain(REPO.split('/')[0]);
  });

  it('reports an unknown ref without writing anything', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'render-git-'));
    git(repo, 'init', '-q', '-b', 'main');
    const out = await mkdtemp(join(tmpdir(), 'render-out-'));
    const code = await runCli(['render', '--from-branch', 'nope', '--out', out, '--config', CONFIG], repo);
    expect(code).toBe(1);
    expect(await readdir(out)).toEqual([]);
  });
});

describe('the render command line', () => {
  it('needs exactly one source', async () => {
    const out = await mkdtemp(join(tmpdir(), 'render-out-'));
    expect(await runCli(['render', '--out', out])).toBe(1);
    expect(await runCli(['render', '--out', out, '--data', out, '--from-branch', 'x'])).toBe(1);
  });

  it('rejects unknown commands and the old flags alone', async () => {
    expect(await runCli(['publish'])).toBe(2);
    expect(await runCli(['render', 'extra', '--data', '/x', '--out', '/y'])).toBe(2);
  });
});
