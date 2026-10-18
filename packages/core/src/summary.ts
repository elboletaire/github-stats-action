// Per-release and per-day sums of a snapshot: the numbers the dataset and the CSV share.

import type { StatsConfig } from './config';
import { matchGlob } from './glob';
import { classifyAsset, IGNORED, OTHER, platformLabel } from './assets';
import { compareVersions, parseVersion } from './semver';
import type { FileRow, ReleaseCounter, Snapshot, SnapshotRelease } from './types';

/** Every group name the dataset uses, in config order, plus `other` when some asset matched none. */
export function groupNames(config: StatsConfig, snapshots: readonly Snapshot[]): string[] {
  const names = config.groups.map((g) => g.name);
  const hasOther = snapshots.some((s) =>
    s.releases.some((r) => r.assets.some((a) => classifyAsset(a.name, config) === OTHER)),
  );
  return hasOther ? [...names, OTHER] : names;
}

/** A counter from `from` on counts only releases at or after that version (and never a non-version tag). */
export function isCounted(tag: string, from: string | undefined): boolean {
  if (from === undefined) return true;
  const version = parseVersion(tag);
  const floor = parseVersion(from);
  return version !== null && floor !== null && compareVersions(version, floor) >= 0;
}

export interface ReleaseSummary {
  groups: Record<string, number>;
  counters: Record<string, ReleaseCounter>;
  files: FileRow[];
}

export function summariseRelease(
  release: SnapshotRelease,
  config: StatsConfig,
  repo: string,
  names: readonly string[],
): ReleaseSummary {
  const groups: Record<string, number> = Object.fromEntries(names.map((name) => [name, 0]));
  const files: FileRow[] = [];
  for (const asset of release.assets) {
    const group = classifyAsset(asset.name, config);
    files.push({
      name: asset.name,
      label: platformLabel(asset.name, release.tag, repo, config.platforms),
      group,
      downloads: asset.downloads,
    });
    if (group !== IGNORED) groups[group] = (groups[group] ?? 0) + asset.downloads;
  }
  const counters: Record<string, ReleaseCounter> = {};
  for (const counter of config.counters) {
    const downloads = release.assets
      .filter((a) => matchGlob(a.name, counter.assets))
      .reduce((sum, a) => sum + a.downloads, 0);
    counters[counter.name] = { downloads, counted: isCounted(release.tag, counter.from) };
  }
  return { groups, counters, files };
}

/** A snapshot's day totals: downloads per group, counted counters, Docker pulls and repo counts. */
export interface DaySummary {
  date: string;
  groups: Record<string, number>;
  total: number;
  docker: number | null;
  stars: number;
  forks: number;
  counters: Record<string, number>;
}

export function summariseDay(
  snapshot: Snapshot,
  config: StatsConfig,
  repo: string,
  names: readonly string[],
): DaySummary {
  const groups: Record<string, number> = Object.fromEntries(names.map((name) => [name, 0]));
  const counters: Record<string, number> = Object.fromEntries(config.counters.map((c) => [c.name, 0]));
  for (const release of snapshot.releases) {
    const summary = summariseRelease(release, config, repo, names);
    for (const name of names) groups[name] = (groups[name] ?? 0) + (summary.groups[name] ?? 0);
    for (const [name, counter] of Object.entries(summary.counters)) {
      if (counter.counted) counters[name] = (counters[name] ?? 0) + counter.downloads;
    }
  }
  return {
    date: snapshot.date,
    groups,
    total: Object.values(groups).reduce((sum, n) => sum + n, 0),
    docker: snapshot.docker?.pulls ?? null,
    stars: snapshot.repo.stars,
    forks: snapshot.repo.forks,
    counters,
  };
}
