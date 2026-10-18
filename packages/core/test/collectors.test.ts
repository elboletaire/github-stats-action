import { describe, expect, it, vi } from 'vitest';
import { fetchDockerPulls } from '../src/collectors/docker';
import { fetchReleases, fetchRepoCounts, fetchStargazers, fetchTraffic, toTrafficResponse } from '../src/collectors/github';
import { createClient, githubClient } from '../src/collectors/client';
import type { Logger } from '../src/types';

interface Call {
  url: URL;
  headers: Headers;
}

/** A fetch that answers from `handler` and records every request it was asked for. */
function fakeFetch(handler: (url: URL) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    calls.push({ url, headers: request.headers });
    return handler(url);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function logger(): Logger {
  return { info: vi.fn<(message: string) => void>(), warning: vi.fn<(message: string) => void>() };
}

const release = (i: number, draft = false) => ({
  tag_name: `v0.${i}.0`,
  draft,
  prerelease: false,
  published_at: '2026-01-01T00:00:00Z',
  assets: [{ name: `manga-downloader-v0.${i}.0-linux-amd64.tar.gz`, download_count: i }],
});

describe('githubClient', () => {
  it('sends the token only when there is one', async () => {
    const anonymous = fakeFetch(() => json({}));
    await githubClient(anonymous.fetch)('/repos/o/r');
    expect(anonymous.calls[0]!.headers.get('authorization')).toBeNull();

    const authed = fakeFetch(() => json({}));
    await githubClient(authed.fetch, 'secret')('/repos/o/r');
    expect(authed.calls[0]!.headers.get('authorization')).toBe('Bearer secret');
    expect(authed.calls[0]!.url.toString()).toBe('https://api.github.com/repos/o/r');
  });
});

describe('fetchReleases', () => {
  it('pages until a short page and skips drafts', async () => {
    const pages = [
      Array.from({ length: 100 }, (_, i) => release(i)),
      [release(100), release(101, true)],
    ];
    const fake = fakeFetch((url) => json(pages[Number(url.searchParams.get('page')) - 1] ?? []));
    const releases = await fetchReleases(githubClient(fake.fetch), 'o/r');
    expect(releases).toHaveLength(101);
    expect(releases[100]).toEqual({
      tag: 'v0.100.0',
      publishedAt: '2026-01-01T00:00:00Z',
      prerelease: false,
      assets: [{ name: 'manga-downloader-v0.100.0-linux-amd64.tar.gz', downloads: 100 }],
    });
    expect(fake.calls.map((c) => c.url.searchParams.get('page'))).toEqual(['1', '2']);
    expect(fake.calls[0]!.url.searchParams.get('per_page')).toBe('100');
  });
});

describe('fetchRepoCounts', () => {
  it('maps the repo fields, subscribers being the watchers', async () => {
    const fake = fakeFetch(() =>
      json({ stargazers_count: 271, forks_count: 33, subscribers_count: 3, open_issues_count: 3 }),
    );
    expect(await fetchRepoCounts(githubClient(fake.fetch), 'o/r')).toEqual({
      stars: 271,
      forks: 33,
      watchers: 3,
      openIssues: 3,
    });
  });
});

describe('fetchStargazers', () => {
  const stamp = (i: number) => `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`;
  const starPage = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ starred_at: stamp(from + i), user: null }));
  const stored = (count: number) => Array.from({ length: count }, (_, i) => stamp(i));

  it('backfills every page with the star media type', async () => {
    const pages = [starPage(0, 100), starPage(100, 30)];
    const fake = fakeFetch((url) => json(pages[Number(url.searchParams.get('page')) - 1] ?? []));
    const log = logger();
    const all = await fetchStargazers(githubClient(fake.fetch), 'o/r', [], 130, log);
    expect(all).toHaveLength(130);
    expect(all[129]).toBe(stamp(129));
    expect(fake.calls[0]!.headers.get('accept')).toBe('application/vnd.github.star+json');
    expect(log.info).toHaveBeenCalledWith('stargazers: 130 new, 130 stored');
  });

  it('continues from the stored count, skipping the stars it already has', async () => {
    // 150 stored: page 2 starts at star 100, so its first 50 entries are known.
    const pages: Record<string, { starred_at: string }[]> = { '2': starPage(100, 100), '3': starPage(200, 10) };
    const fake = fakeFetch((url) => json(pages[url.searchParams.get('page')!] ?? []));
    const all = await fetchStargazers(githubClient(fake.fetch), 'o/r', stored(150), 210, logger());
    expect(all).toHaveLength(210);
    expect(all[150]).toBe(stamp(150));
    expect(fake.calls.map((c) => c.url.searchParams.get('page'))).toEqual(['2', '3']);
  });

  it('refetches the whole list when a star was removed and the count disagrees', async () => {
    // Stored: stars 0, 1, 2. Star 1 was removed since, so the list is 0 and 2.
    const fake = fakeFetch((url) =>
      json(url.searchParams.get('page') === '1' ? [{ starred_at: stamp(0) }, { starred_at: stamp(2) }] : []),
    );
    const log = logger();
    const all = await fetchStargazers(githubClient(fake.fetch), 'o/r', stored(3), 2, log);
    expect(all).toEqual([stamp(0), stamp(2)]);
    expect(fake.calls.map((c) => c.url.searchParams.get('page'))).toEqual(['1', '1']);
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('refetching all of it'));
  });

  it('refetches when one star was added and another removed, leaving the count the same', async () => {
    // Stored: stars 0, 1, 2. Star 1 was removed and star 3 added, so GitHub lists 0, 2, 3.
    // Fetching by position alone would see one new star past the stored list and keep the stale 1.
    const fake = fakeFetch(() => json([{ starred_at: stamp(0) }, { starred_at: stamp(2) }, { starred_at: stamp(3) }]));
    const all = await fetchStargazers(githubClient(fake.fetch), 'o/r', stored(3), 3, logger());
    expect(all).toEqual([stamp(0), stamp(2), stamp(3)]);
    expect(fake.calls.map((c) => c.url.searchParams.get('page'))).toEqual(['1', '1']);
  });

  it("keeps the stored list when the refetch hits GitHub's limit", async () => {
    let calls = 0;
    const fake = fakeFetch(() =>
      ++calls === 1
        ? json([{ starred_at: stamp(0) }, { starred_at: stamp(2) }])
        : json({ message: 'Only the first 40000 results are available.' }, 422),
    );
    const log = logger();
    const all = await fetchStargazers(githubClient(fake.fetch), 'o/r', stored(3), 2, log);
    expect(all).toEqual(stored(3));
    expect(log.warning).toHaveBeenCalledWith(expect.stringContaining('keeping the stored list'));
  });

  it('keeps what it has when GitHub stops listing past its limit, without refetching', async () => {
    const fake = fakeFetch((url) =>
      url.searchParams.get('page') === '1'
        ? json(starPage(0, 100))
        : json({ message: 'Only the first 40000 results are available.' }, 422),
    );
    const log = logger();
    expect(await fetchStargazers(githubClient(fake.fetch), 'o/r', [], 150, log)).toHaveLength(100);
    expect(fake.calls.map((c) => c.url.searchParams.get('page'))).toEqual(['1', '2']);
    expect(log.warning).toHaveBeenCalledWith(expect.stringContaining('stops listing past 100 stars'));
  });
});

describe('fetchTraffic', () => {
  it('reduces the payloads to dated days and the aggregates', async () => {
    const fake = fakeFetch((url) => {
      switch (url.pathname) {
        case '/repos/o/r/traffic/views':
          return json({ count: 3, uniques: 2, views: [{ timestamp: '2026-10-17T00:00:00Z', count: 3, uniques: 2 }] });
        case '/repos/o/r/traffic/clones':
          return json({ count: 1, uniques: 1, clones: [{ timestamp: '2026-10-17T00:00:00Z', count: 1, uniques: 1 }] });
        case '/repos/o/r/traffic/popular/referrers':
          return json([{ referrer: 'github.com', count: 5, uniques: 4 }]);
        default:
          return json([{ path: '/o/r', title: 'o/r', count: 9, uniques: 7 }]);
      }
    });
    const traffic = await fetchTraffic(githubClient(fake.fetch, 'pat'), 'o/r');
    expect(traffic.views).toEqual([{ date: '2026-10-17', count: 3, uniques: 2 }]);
    expect(traffic.clones).toEqual([{ date: '2026-10-17', count: 1, uniques: 1 }]);
    expect(traffic.referrers).toEqual([{ referrer: 'github.com', count: 5, uniques: 4 }]);
    expect(traffic.paths).toEqual([{ path: '/o/r', title: 'o/r', count: 9, uniques: 7 }]);
  });

  it('fails with the token hint on a 403', async () => {
    const fake = fakeFetch(() => json({ message: 'Resource not accessible by integration' }, 403));
    await expect(fetchTraffic(githubClient(fake.fetch), 'o/r')).rejects.toThrow(/push access.*PAT.*GITHUB_TOKEN gets 403/);
  });

  it('reads the fixture payloads the way GitHub sends them', async () => {
    const read = async (name: string) =>
      JSON.parse(await (await import('node:fs/promises')).readFile(new URL(`../../../fixtures/traffic/${name}`, import.meta.url), 'utf8'));
    const traffic = toTrafficResponse({
      views: await read('views.json'),
      clones: await read('clones.json'),
      referrers: await read('referrers.json'),
      paths: await read('paths.json'),
    });
    expect(traffic.views).toHaveLength(14);
    expect(traffic.views[13]!.date).toBe('2026-10-18');
  });
});

describe('fetchDockerPulls', () => {
  it('returns the pull count of the image', async () => {
    const fake = fakeFetch(() => json({ pull_count: 37673, star_count: 1 }));
    const api = createClient({ fetch: fake.fetch, baseUrl: 'https://hub.docker.com' });
    expect(await fetchDockerPulls(api, 'elboletaire/manga-downloader', logger())).toBe(37673);
    expect(fake.calls[0]!.url.toString()).toBe('https://hub.docker.com/v2/repositories/elboletaire/manga-downloader/');
  });

  it('turns a Docker Hub failure into a warning, not an error', async () => {
    const fake = fakeFetch(() => json({ message: 'oops' }, 500));
    const log = logger();
    const api = createClient({ fetch: fake.fetch, baseUrl: 'https://hub.docker.com' });
    const pulls = await fetchDockerPulls(api, 'elboletaire/manga-downloader', log);
    expect(pulls).toBeUndefined();
    expect(log.warning).toHaveBeenCalledWith(expect.stringContaining('docker hub: elboletaire/manga-downloader pulls not collected'));
  });
});
