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

/** npm's downloads API: two downloads a day over the requested range; `failing` is answered with a 404. */
function withNpm(base: typeof fetch, failing = ''): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== 'api.npmjs.org') return base(input, init);
    if (failing && url.pathname.includes(failing)) return json({ error: 'not found' }, 404);
    const [start, end] = url.pathname.split('/')[3]!.split(':');
    const days = [];
    for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 864e5) {
      days.push({ day: new Date(t).toISOString().slice(0, 10), downloads: 2 });
    }
    return json({ start, end, downloads: days });
  }) as unknown as typeof fetch;
}

describe('runStats with npm packages', () => {
  const withPackages = parseConfig(`
npm:
  - password-strength-meter
  - { package: "@passcore/core", label: Core }
`);

  it('stores each package under npm/ and puts the figures on the dataset', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const result = await runStats({
      repo: REPO,
      config: withPackages,
      dataDir,
      traffic: false,
      now,
      log,
      fetch: withNpm(network()),
    });
    const repo = join(dataDir, 'elboletaire', 'manga-downloader');
    expect((await readdir(join(repo, 'npm'))).sort()).toEqual(['passcore--core.json', 'password-strength-meter.json']);
    const stored = JSON.parse(await readFile(join(repo, 'npm', 'passcore--core.json'), 'utf8'));
    expect(stored).toMatchObject({ schema: 1, package: '@passcore/core' });
    expect(stored.days.at(-1)).toEqual({ date: '2026-01-02', downloads: 2 });
    expect(result.dataset.npm!.packages.map((p) => p.label)).toEqual(['password-strength-meter', 'Core']);
    expect(result.dataset.npm!.totals.lastDay).toBe(4);
    expect(result.dataset.npm!.totals.last30).toBe(120);
  });

  it('warns about a package npm does not know and keeps the others', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const warn = vi.fn();
    const result = await runStats({
      repo: REPO,
      config: withPackages,
      dataDir,
      traffic: false,
      now,
      log: { info: vi.fn(), warning: warn },
      fetch: withNpm(network(), 'password-strength-meter'),
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('password-strength-meter downloads not collected'));
    expect(result.dataset.npm!.packages.map((p) => p.package)).toEqual(['@passcore/core']);
  });

  it('does no npm work without an npm list', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const fetchFn = withNpm(network());
    const result = await runStats({ repo: REPO, config, dataDir, traffic: false, now, log, fetch: fetchFn });
    expect(result.dataset.npm).toBeUndefined();
    const hosts = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([input]) => new URL(String(input instanceof Request ? input.url : input)).hostname);
    expect(hosts).not.toContain('api.npmjs.org');
  });
});

describe('runStats with release downloads switched off', () => {
  it('removes the download outputs an earlier run wrote, and keeps the snapshots', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const repo = join(dataDir, 'elboletaire', 'manga-downloader');
    await runStats({ repo: REPO, config, dataDir, traffic: false, now, log, fetch: network() });
    expect(await readdir(join(repo, 'charts'))).toContain('downloads-per-day-light.svg');
    expect(await readdir(join(repo, 'badges'))).toContain('downloads.json');

    const off = parseConfig('releases: false\ndocker: elboletaire/manga-downloader\n');
    const result = await runStats({ repo: REPO, config: off, dataDir, traffic: false, now, log, fetch: network() });
    expect(result.dataset.releaseDownloads).toBe(false);
    expect(result.summary).toBe('elboletaire/manga-downloader: 3 stars, Docker 42');
    expect((await readdir(join(repo, 'charts'))).sort()).toEqual(['stars-dark.svg', 'stars-light.svg']);
    expect(await readdir(join(repo, 'badges'))).not.toContain('downloads.json');
    expect(await readFile(join(repo, 'daily.csv'), 'utf8')).toMatch(/^date,docker_pulls,stars,forks,docker_delta,stars_delta\n/);
    expect(await readdir(join(repo, 'snapshots'))).toEqual(['2026-01-03.json']);
  });
});

/** Cloudflare's SQL API: answers one day, 2026-01-02, to each query whose window holds it. */
function withCloudflare(base: typeof fetch): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (new URL(request.url).hostname !== 'api.cloudflare.com') return base(input, init);
    const sql = await request.text();
    const [, from, to] = /toDateTime\('([\d-]+) 00:00:00'\) AND timestamp < toDateTime\('([\d-]+) 00:00:00'\)/.exec(sql)!;
    const day = '2026-01-02';
    const inWindow = from! <= day && day < to!;
    const row = { day, users: '2', events: '3', ...(sql.includes('AS value') ? { value: 'gui' } : {}) };
    return json({ meta: [], data: inWindow ? [row] : [], rows: inWindow ? 1 : 0 });
  }) as unknown as typeof fetch;
}

describe('runStats with the cloudflare source', () => {
  const withSource = parseConfig(`
cloudflare:
  account-id: ${'a'.repeat(32)}
  dataset: manga_downloader_checks
  dimensions:
    client: { column: blob1 }
`);

  it('stores the daily aggregates under cloudflare/ with the token', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const result = await runStats({ repo: REPO, token: 'x', config: withSource, dataDir, traffic: false, now, log, fetch: withCloudflare(network()), cloudflareToken: 'cf' });
    const repo = join(dataDir, 'elboletaire', 'manga-downloader');
    const stored = JSON.parse(await readFile(join(repo, 'cloudflare', 'manga_downloader_checks.json'), 'utf8'));
    expect(stored).toEqual({
      schema: 1,
      dataset: 'manga_downloader_checks',
      days: [{ date: '2026-01-02', users: 2, events: 3, by: { client: { gui: { users: 2, events: 3 } } } }],
    });
    expect(result.dataset.cloudflare?.latest).toBe('2026-01-02');
    expect(await readFile(join(repo, 'daily.csv'), 'utf8')).toMatch(/^date,.*cf_users,cf_events\n/);
  });

  it('keeps the stored days, with a warning, when no token is given', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const warn = vi.fn();
    const fetchFn = withCloudflare(network());
    await runStats({ repo: REPO, token: 'x', config: withSource, dataDir, traffic: false, now, log: { info: vi.fn(), warning: warn }, fetch: fetchFn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cloudflare: no token'));
    expect(await readdir(join(dataDir, 'elboletaire', 'manga-downloader'))).not.toContain('cloudflare');
    const hosts = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([input]) => new URL(String(input instanceof Request ? input.url : input)).hostname);
    expect(hosts).not.toContain('api.cloudflare.com');
  });

  it('does no Cloudflare work without the cloudflare block', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'stats-run-'));
    const fetchFn = withCloudflare(network());
    await runStats({ repo: REPO, config, dataDir, traffic: false, now, log, fetch: fetchFn, cloudflareToken: 'cf' });
    expect(await readdir(join(dataDir, 'elboletaire', 'manga-downloader'))).not.toContain('cloudflare');
    const hosts = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([input]) => new URL(String(input instanceof Request ? input.url : input)).hostname);
    expect(hosts).not.toContain('api.cloudflare.com');
  });
});
