import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseConfig, type Dataset } from '@github-stats-action/core';
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
