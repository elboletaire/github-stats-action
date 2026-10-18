// The fixtures' Dataset, built the way the action builds it. The 2026-10-18 snapshot comes
// from releases.json, since the old file predates v1.20.0.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  buildDataset,
  convertOldSnapshot,
  loadConfig,
  mergeTrafficDays,
  toTrafficResponse,
  type Dataset,
  type OldSnapshot,
  type Snapshot,
  type SnapshotRelease,
  type TrafficRaw,
} from '../packages/core/src';

export const FIXTURE_TAKEN_AT = '2026-10-18T13:00:00Z';

export async function buildFixtureDataset(): Promise<Dataset> {
  const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));
  const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(fixtures + path, 'utf8')) as T;
  const repo = 'elboletaire/manga-downloader';
  const config = await loadConfig(fixtures + 'manga-downloader.stats.yml');

  const old17 = await read<OldSnapshot>('old/snapshots/2026-10-17.json');
  const old18 = await read<OldSnapshot>('old/snapshots/2026-10-18.json');
  const apiReleases = await read<
    { tag_name: string; draft: boolean; prerelease: boolean; published_at: string; assets: { name: string; download_count: number }[] }[]
  >('releases.json');

  const releases: SnapshotRelease[] = apiReleases
    .filter((r) => !r.draft)
    .map((r) => ({
      tag: r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease,
      assets: r.assets.map((a) => ({ name: a.name, downloads: a.download_count })),
    }));

  const snapshot18: Snapshot = {
    schema: 1,
    date: '2026-10-18',
    takenAt: FIXTURE_TAKEN_AT,
    repo: {
      stars: old18.repo.stars,
      forks: old18.repo.forks,
      watchers: old18.repo.subscribers,
      openIssues: old18.repo.open_issues,
    },
    docker: { image: config.docker!, pulls: old18.docker!.pull_count },
    releases,
  };

  const raw: TrafficRaw = {
    views: await read('traffic/views.json'),
    clones: await read('traffic/clones.json'),
    referrers: await read('traffic/referrers.json'),
    paths: await read('traffic/paths.json'),
  };
  const traffic = toTrafficResponse(raw);

  return buildDataset({
    repo,
    config,
    snapshots: [convertOldSnapshot(old17, '2026-10-17', config.docker), snapshot18],
    stargazers: await read<string[]>('stargazers.json'),
    traffic: {
      views: mergeTrafficDays([], traffic.views),
      clones: mergeTrafficDays([], traffic.clones),
      referrers: traffic.referrers,
      paths: traffic.paths,
      asOf: '2026-10-18',
    },
    now: new Date(FIXTURE_TAKEN_AT),
  });
}
