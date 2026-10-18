// Builds the Dataset from the snapshots and stargazers. Pure: no clock, no I/O beyond `now`.

import type { StatsConfig } from './config';
import { OTHER } from './assets';
import { DAY_MS, estimateDaily, utcDate, utcMidnight } from './estimate';
import { buildPeriods } from './periods';
import { parseVersion, compareVersions } from './semver';
import { groupNames, summariseDay, summariseRelease } from './summary';
import type {
  Dataset,
  EpochInfo,
  MeasuredDay,
  ReleaseRow,
  Snapshot,
  StarPoint,
  Totals,
  TrafficData,
} from './types';

export interface BuildInput {
  /** owner/name. */
  repo: string;
  config: StatsConfig;
  /** Any order; a day appears once. */
  snapshots: Snapshot[];
  /** Starred-at timestamps, oldest first. */
  stargazers?: readonly string[];
  traffic?: TrafficData;
  now: Date;
}

const zeros = (names: readonly string[]): Record<string, number> =>
  Object.fromEntries(names.map((name) => [name, 0]));

/** Index of the latest epoch at or before each release. A tag that isn't a version inherits the previous release's. */
function assignEpochs(releases: ReleaseRow[], epochs: readonly EpochInfo[]): void {
  let current = -1;
  for (const release of releases) {
    const version = parseVersion(release.tag);
    if (version) {
      current = -1;
      epochs.forEach((epoch, i) => {
        const floor = parseVersion(epoch.version);
        if (floor && compareVersions(version, floor) >= 0) current = i;
      });
    }
    release.epoch = current;
  }
}

function buildReleases(
  latest: Snapshot,
  config: StatsConfig,
  repo: string,
  names: readonly string[],
  nowMs: number,
): ReleaseRow[] {
  const ordered = [...latest.releases].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  const rows: ReleaseRow[] = ordered.map((release, i) => {
    const pub = Date.parse(release.publishedAt);
    const next = ordered[i + 1];
    // A release published after `now` (clock skew) gets an empty window rather than a negative one.
    const end = Math.max(pub, next ? Date.parse(next.publishedAt) : nowMs);
    const summary = summariseRelease(release, config, repo, names);
    return {
      tag: release.tag,
      publishedAt: release.publishedAt,
      end: new Date(end).toISOString(),
      days: (end - pub) / DAY_MS,
      epoch: -1,
      prerelease: release.prerelease,
      groups: summary.groups,
      counters: summary.counters,
      files: summary.files,
    };
  });
  assignEpochs(rows, config.epochs);
  return rows;
}

function buildTotals(
  releases: readonly ReleaseRow[],
  snapshots: readonly Snapshot[],
  config: StatsConfig,
  names: readonly string[],
): Totals {
  const groups = zeros(names);
  for (const r of releases) for (const name of names) groups[name]! += r.groups[name] ?? 0;
  const latest = snapshots[snapshots.length - 1]!;
  const counters: Totals['counters'] = {};
  for (const counter of config.counters) {
    let downloads = 0;
    let all = 0;
    for (const r of releases) {
      const c = r.counters[counter.name];
      if (!c) continue;
      all += c.downloads;
      if (c.counted) downloads += c.downloads;
    }
    counters[counter.name] = { downloads, all };
  }
  return {
    groups,
    downloads: names.reduce((sum, name) => sum + groups[name]!, 0),
    stars: latest.repo.stars,
    forks: latest.repo.forks,
    docker: [...snapshots].reverse().find((s) => s.docker)?.docker?.pulls ?? null,
    counters,
  };
}

function buildMeasured(
  snapshots: readonly Snapshot[],
  config: StatsConfig,
  repo: string,
  names: readonly string[],
): MeasuredDay[] {
  const days = snapshots.map((s) => summariseDay(s, config, repo, names));
  const out: MeasuredDay[] = [];
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]!;
    const cur = days[i]!;
    out.push({
      date: cur.date,
      days: Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / DAY_MS),
      groups: Object.fromEntries(names.map((name) => [name, (cur.groups[name] ?? 0) - (prev.groups[name] ?? 0)])),
      stars: cur.stars - prev.stars,
      docker: cur.docker === null || prev.docker === null ? null : cur.docker - prev.docker,
      counters: Object.fromEntries(
        Object.keys(cur.counters).map((name) => [name, (cur.counters[name] ?? 0) - (prev.counters[name] ?? 0)]),
      ),
    });
  }
  return out;
}

/** Cumulative stars at the end of each UTC day, from the first star to `now`'s day. */
function buildStars(stargazers: readonly string[], nowMs: number): StarPoint[] {
  if (stargazers.length === 0) return [];
  const perDay = new Map<string, number>();
  for (const at of stargazers) {
    const day = utcDate(Date.parse(at));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const first = [...perDay.keys()].sort()[0]!;
  const last = utcMidnight(nowMs);
  const points: StarPoint[] = [];
  let stars = 0;
  for (let t = Date.parse(first); t <= last; t += DAY_MS) {
    const day = utcDate(t);
    stars += perDay.get(day) ?? 0;
    points.push({ date: day, stars });
  }
  return points;
}

export function buildDataset(input: BuildInput): Dataset {
  const { repo, config } = input;
  const snapshots = [...input.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = snapshots[snapshots.length - 1];
  if (!latest) throw new Error('buildDataset needs at least one snapshot');
  const names = groupNames(config, snapshots);
  const nowMs = input.now.getTime();

  const releases = buildReleases(latest, config, repo, names, nowMs);
  const { d0, daily } = estimateDaily(releases, names, nowMs);
  const periods = buildPeriods({ releases, epochs: config.epochs, counters: config.counters, names, d0, daily });

  return {
    repo,
    generatedAt: input.now.toISOString(),
    snapshotAt: latest.takenAt,
    groups: names.map((name, color) => ({
      name,
      label: config.groups.find((g) => g.name === name)?.label ?? (name === OTHER ? 'Other' : name),
      color,
    })),
    epochs: config.epochs.map((e) => ({ version: e.version, label: e.label })),
    counters: config.counters.map((c) => ({ ...c })),
    totals: buildTotals(releases, snapshots, config, names),
    releases,
    periods,
    estimatedDaily: daily,
    measuredDaily: buildMeasured(snapshots, config, repo, names),
    stars: buildStars(input.stargazers ?? [], nowMs),
    ...(input.traffic ? { traffic: input.traffic } : {}),
  };
}
