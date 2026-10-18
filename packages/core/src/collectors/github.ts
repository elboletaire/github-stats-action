// GitHub REST collectors: release assets, repo counts, stargazers and traffic.

import { isResponseError } from 'up-fetch';
import type { Client } from './client';
import type { Logger, PopularPath, Referrer, SnapshotRelease, TrafficDay } from '../types';

const PER_PAGE = 100;

export interface RepoCounts {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
}

interface ApiRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: { name: string; download_count: number }[];
}

export async function fetchRepoCounts(api: Client, repo: string): Promise<RepoCounts> {
  const info = await api<{
    stargazers_count: number;
    forks_count: number;
    subscribers_count: number;
    open_issues_count: number;
  }>(`/repos/${repo}`);
  return {
    stars: info.stargazers_count,
    forks: info.forks_count,
    watchers: info.subscribers_count,
    openIssues: info.open_issues_count,
  };
}

/** Every published release, paging until a short page. Drafts are skipped. */
export async function fetchReleases(api: Client, repo: string): Promise<SnapshotRelease[]> {
  const releases: SnapshotRelease[] = [];
  for (let page = 1; ; page++) {
    const batch = await api<ApiRelease[]>(`/repos/${repo}/releases`, {
      params: { per_page: PER_PAGE, page },
    });
    for (const r of batch) {
      if (r.draft || !r.published_at) continue;
      releases.push({
        tag: r.tag_name,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        assets: r.assets.map((a) => ({ name: a.name, downloads: a.download_count })),
      });
    }
    if (batch.length < PER_PAGE) break;
  }
  return releases;
}

/**
 * Starred-at timestamps this run hasn't stored yet. The list is oldest first and paged,
 * so the first `known` entries are skipped by position. GitHub refuses pages past its
 * limit (422); the stars up to there are kept.
 */
export async function fetchStargazers(
  api: Client,
  repo: string,
  known: number,
  log: Logger,
): Promise<string[]> {
  const startPage = Math.floor(known / PER_PAGE) + 1;
  const skip = known - (startPage - 1) * PER_PAGE;
  const fresh: string[] = [];
  for (let page = startPage; ; page++) {
    let batch: { starred_at: string }[];
    try {
      batch = await api<{ starred_at: string }[]>(`/repos/${repo}/stargazers`, {
        params: { per_page: PER_PAGE, page },
        headers: { Accept: 'application/vnd.github.star+json' },
      });
    } catch (error) {
      if (isResponseError(error) && error.status === 422) {
        log.warning(`stargazers: GitHub stops listing past ${known + fresh.length} stars; keeping those`);
        break;
      }
      throw error;
    }
    const stamps = batch.map((s) => s.starred_at);
    fresh.push(...(page === startPage ? stamps.slice(skip) : stamps));
    if (batch.length < PER_PAGE) break;
  }
  log.info(`stargazers: ${fresh.length} new, ${known + fresh.length} stored`);
  return fresh;
}

/** The four traffic endpoints as GitHub returns them. */
export interface TrafficRaw {
  views: { views: { timestamp: string; count: number; uniques: number }[] };
  clones: { clones: { timestamp: string; count: number; uniques: number }[] };
  referrers: { referrer: string; count: number; uniques: number }[];
  paths: { path: string; title: string; count: number; uniques: number }[];
}

export interface TrafficResponse {
  views: TrafficDay[];
  clones: TrafficDay[];
  referrers: Referrer[];
  paths: PopularPath[];
}

const TRAFFIC_403 =
  'traffic: GitHub refused the request (403). Collecting traffic needs a token with push access to the repo (a PAT); GITHUB_TOKEN gets 403 there.';

const day = (timestamp: string): string => timestamp.slice(0, 10);

/** Reduces GitHub's traffic payloads to the stored shapes (days keyed by date). */
export function toTrafficResponse(raw: TrafficRaw): TrafficResponse {
  return {
    views: raw.views.views.map((v) => ({ date: day(v.timestamp), count: v.count, uniques: v.uniques })),
    clones: raw.clones.clones.map((c) => ({ date: day(c.timestamp), count: c.count, uniques: c.uniques })),
    referrers: raw.referrers.map((r) => ({ referrer: r.referrer, count: r.count, uniques: r.uniques })),
    paths: raw.paths.map((p) => ({ path: p.path, title: p.title, count: p.count, uniques: p.uniques })),
  };
}

/** Views, clones and the two popular-* aggregates. A 403 fails with a message about the token. */
export async function fetchTraffic(api: Client, repo: string): Promise<TrafficResponse> {
  const get = <T>(path: string): Promise<T> =>
    api<T>(`/repos/${repo}/traffic/${path}`).catch((error: unknown) => {
      if (isResponseError(error) && error.status === 403) throw new Error(TRAFFIC_403);
      throw error;
    });
  const [views, clones, referrers, paths] = await Promise.all([
    get<TrafficRaw['views']>('views'),
    get<TrafficRaw['clones']>('clones'),
    get<TrafficRaw['referrers']>('popular/referrers'),
    get<TrafficRaw['paths']>('popular/paths'),
  ]);
  return toTrafficResponse({ views, clones, referrers, paths });
}
