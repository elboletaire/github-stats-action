import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { convertOldSnapshot, parseConfig, type Dataset } from '@github-stats-action/core';
import { checkoutDataBranch } from '../src/git';
import { runStats, summaryLine } from '../src/run';

const config = parseConfig(`
groups:
  - { name: app, assets: "manga-downloader-gui-*" }
  - { name: cli, assets: "manga-downloader-*" }
ignore: ["*.md5"]
docker: elboletaire/manga-downloader
`);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const releases = [
  {
    tag_name: 'v1.0.0',
    draft: false,
    prerelease: false,
    published_at: '2026-01-01T00:00:00Z',
    assets: [
      { name: 'manga-downloader-v1.0.0-linux-amd64.tar.gz', download_count: 10 },
      { name: 'manga-downloader-v1.0.0-linux-amd64.tar.gz.md5', download_count: 2 },
      { name: 'manga-downloader-gui-v1.0.0-linux-amd64.tar.gz', download_count: 4 },
    ],
  },
  { tag_name: 'v1.1.0-draft', draft: true, prerelease: false, published_at: null, assets: [] },
];

/** GitHub and Docker Hub as the run sees them; the two statuses override those endpoints. */
function network(releasesStatus = 200, dockerStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'hub.docker.com') {
      return dockerStatus === 200 ? json({ pull_count: 42 }) : json({}, dockerStatus);
    }
    if (url.pathname === '/repos/elboletaire/manga-downloader') {
      return json({ stargazers_count: 3, forks_count: 1, subscribers_count: 2, open_issues_count: 0 });
    }
    if (url.pathname === '/repos/elboletaire/manga-downloader/releases') {
      return releasesStatus === 200 ? json(releases) : json({ message: 'boom' }, releasesStatus);
    }
    if (url.pathname === '/repos/elboletaire/manga-downloader/stargazers') {
      return json([{ starred_at: '2026-01-01T10:00:00Z', user: null }]);
    }
    return json({ message: `unexpected ${url}` }, 404);
  }) as unknown as typeof fetch;
}

const log = { info: vi.fn(), warning: vi.fn() };
const now = new Date('2026-01-03T09:00:00Z');
const REPO = 'elboletaire/manga-downloader';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

describe('runStats', () => {
  it('collects, writes the day and the derived files, and reports the totals', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const result = await runStats({
      repo: 'elboletaire/manga-downloader',
      token: 'x',
      config,
      dataDir,
      traffic: false,
      now,
      log,
      fetch: network(),
    });

    const repo = join(dataDir, 'elboletaire', 'manga-downloader');
    expect((await readdir(join(repo, 'snapshots')))).toEqual(['2026-01-03.json']);
    expect(JSON.parse(await readFile(join(repo, 'stargazers.json'), 'utf8'))).toEqual(['2026-01-01T10:00:00Z']);
    expect(await readFile(join(repo, 'daily.csv'), 'utf8')).toContain('2026-01-03,4,10,14,42,3,1');
    const dataset = JSON.parse(await readFile(join(repo, 'dataset.json'), 'utf8')) as Dataset;
    expect(dataset.totals).toMatchObject({ groups: { app: 4, cli: 10 }, downloads: 14, docker: 42, stars: 3 });
    expect(result.summary).toBe(
      'elboletaire/manga-downloader: 14 downloads (app 4, cli 10), 3 stars, Docker 42',
    );
    expect(summaryLine(dataset)).toBe(result.summary);
  });

  it('writes nothing when GitHub fails, so the branch keeps its last good day', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    await expect(
      runStats({
        repo: 'elboletaire/manga-downloader',
        config,
        dataDir,
        traffic: false,
        now,
        log,
        fetch: network(500),
      }),
    ).rejects.toThrow();
    expect(await readdir(dataDir)).toEqual([]);
  });

  it('keeps the run going when Docker Hub is down, leaving Docker out of the day', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const warn = vi.fn();
    const result = await runStats({
      repo: 'elboletaire/manga-downloader',
      config,
      dataDir,
      traffic: false,
      now,
      log: { info: vi.fn(), warning: warn },
      fetch: network(200, 503),
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('docker hub'));
    expect(result.dataset.totals.docker).toBeNull();
  });
});

describe('import-old', () => {
  it('converts the old root snapshots into the repo folder, keeping days already there and the root files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stats-import-run-'));
    const remote = join(root, 'remote.git');
    const work = join(root, 'work');
    git(root, 'init', '--bare', '-q', '-b', 'main', remote);
    await mkdir(work);
    git(work, 'init', '-q', '-b', 'main');
    git(work, 'config', 'user.email', 'dev@example.com');
    git(work, 'config', 'user.name', 'dev');
    await writeFile(join(work, 'README.md'), 'code\n');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'init');
    git(work, 'remote', 'add', 'origin', remote);
    git(work, 'push', '-q', 'origin', 'main');

    // the old layout: manga-downloader's stats-data branch, snapshots at the root
    const old = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    const oldNames = (await readdir(new URL('../../../fixtures/old/snapshots/', import.meta.url))).sort();
    await mkdir(join(old.dir, 'snapshots'), { recursive: true });
    for (const name of oldNames) {
      await cp(new URL(`../../../fixtures/old/snapshots/${name}`, import.meta.url), join(old.dir, 'snapshots', name));
    }
    await old.publish('old layout');

    // a day already in the new layout, which the import must keep
    const kept = convertOldSnapshot(
      JSON.parse(await readFile(join(old.dir, 'snapshots', oldNames[0]!), 'utf8')),
      oldNames[0]!.replace(/\.json$/, ''),
      config.docker,
    );
    kept.takenAt = '2026-10-01T00:00:00Z';
    const data = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await mkdir(join(data.dir, REPO, 'snapshots'), { recursive: true });
    await writeFile(join(data.dir, REPO, 'snapshots', oldNames[0]!), `${JSON.stringify(kept, null, 2)}\n`);
    expect(await data.publish('new layout')).toBe(true);

    const run = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    const info = vi.fn();
    await runStats({
      repo: REPO,
      token: 'x',
      config,
      dataDir: run.dir,
      traffic: false,
      importOld: '.',
      now,
      log: { info, warning: vi.fn() },
      fetch: network(),
    });
    expect(info).toHaveBeenCalledWith(`import: ${oldNames.length - 1} days imported, 1 kept`);
    expect(await run.publish('stats: 2026-01-03')).toBe(true);

    const onBranch = (dir: string) => git(remote, 'ls-tree', '--name-only', 'stats-data', `${dir}/`).split('\n').map((p) => p.split('/').at(-1));
    expect(onBranch('snapshots').sort()).toEqual(oldNames);
    expect(onBranch(REPO + '/snapshots').sort()).toEqual([...oldNames, '2026-01-03.json'].sort());
    expect(git(remote, 'show', `stats-data:${REPO}/snapshots/${oldNames[0]}`)).toContain('"takenAt": "2026-10-01T00:00:00Z"');
  });

  it('fails clearly when the path holds no snapshots/ folder', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    await expect(
      runStats({ repo: REPO, config, dataDir, traffic: false, importOld: 'old', now, log, fetch: network() }),
    ).rejects.toThrow('import-old: no snapshots/ folder at old on the data branch');
    expect(await readdir(dataDir)).toEqual([]);
  });
});
