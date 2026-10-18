// Types shared by the collectors, the store and the outputs. Snapshot is what is
// stored per day on the data branch; Dataset is what every output reads.

/** One downloadable file of a release, as GitHub counted it that day. */
export interface SnapshotAsset {
  name: string;
  downloads: number;
}

/** A published (non-draft) release with its assets. */
export interface SnapshotRelease {
  tag: string;
  publishedAt: string;
  prerelease: boolean;
  assets: SnapshotAsset[];
}

/** Raw numbers of one UTC day. A rerun on the same day overwrites it. */
export interface Snapshot {
  schema: 1;
  /** UTC day, YYYY-MM-DD. */
  date: string;
  /** ISO timestamp the numbers were fetched. */
  takenAt: string;
  repo: {
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
  };
  /** Absent when Docker Hub isn't configured or failed that day. */
  docker?: {
    image: string;
    pulls: number;
  };
  releases: SnapshotRelease[];
}

/** Daily count from GitHub's traffic API (views or clones). */
export interface TrafficDay {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  count: number;
  uniques: number;
}

/** GitHub's 14-day referrer aggregate, as of the day it was fetched. */
export interface Referrer {
  referrer: string;
  count: number;
  uniques: number;
}

/** GitHub's 14-day popular-paths aggregate, as of the day it was fetched. */
export interface PopularPath {
  path: string;
  title: string;
  count: number;
  uniques: number;
}

/** Traffic as stored on the branch: the merged daily series plus the latest aggregates. */
export interface TrafficData {
  views: TrafficDay[];
  clones: TrafficDay[];
  referrers: Referrer[];
  paths: PopularPath[];
  /** Day the referrers and paths were fetched, null when none were. */
  asOf: string | null;
}

/** A download group as the dashboard and charts show it. */
export interface GroupInfo {
  name: string;
  label: string;
  /** Index into the palette; the group's position in the config, `other` last. */
  color: number;
}

/** A named version marking a change in the project (config `epochs`). */
export interface EpochInfo {
  version: string;
  label: string;
}

/** A counter definition (config `counters`): downloads of matching assets, from `from` on. */
export interface CounterInfo {
  name: string;
  label: string;
  assets: string;
  /** Only releases at or after this version are counted; absent counts every release. */
  from?: string;
}

/** One release's file, with the group it was counted in. */
export interface FileRow {
  /** Asset name as published. */
  name: string;
  /** Platform label from the config `platforms` rules, or the default one. */
  label: string;
  /** A group name, `other` when no group matched, or `ignored` when the ignore list matched. */
  group: string;
  downloads: number;
}

/** A release's counter. `downloads` is the raw sum; `counted` is false before the counter's `from`. */
export interface ReleaseCounter {
  downloads: number;
  counted: boolean;
}

/** One published release and its share of the downloads. */
export interface ReleaseRow {
  tag: string;
  publishedAt: string;
  /** End of its live window: the next release's publish time, or the build time for the newest. */
  end: string;
  /** Length of the live window in days. */
  days: number;
  /** Index into `epochs` of the latest epoch at or before this release, -1 before the first one. */
  epoch: number;
  prerelease: boolean;
  /** Downloads per group (every group is present, zero when none), not counting ignored files. */
  groups: Record<string, number>;
  counters: Record<string, ReleaseCounter>;
  files: FileRow[];
}

/** Counter over a span: `downloads` sums the counted releases only; `counted` is true when any was. */
export interface SpanCounter {
  downloads: number;
  counted: boolean;
}

/**
 * The span of one epoch (or the span before the first one, `epoch` -1), with the
 * averages and medians over its whole UTC days. Spans without releases have null dates.
 */
export interface Period {
  /** Index into `epochs`, -1 for the span before the first epoch. */
  epoch: number;
  version: string | null;
  label: string | null;
  start: string | null;
  end: string | null;
  /** Length of the span in days. */
  days: number;
  releases: number;
  firstTag: string | null;
  lastTag: string | null;
  groups: Record<string, number>;
  downloads: number;
  avgPerDay: Record<string, number>;
  avgPerDayTotal: number;
  /** Median of the estimated daily values over the span's whole days; null when it has none. */
  medianPerDay: Record<string, number | null>;
  medianPerDayTotal: number | null;
  /** Number of whole UTC days the medians are taken over. */
  fullDays: number;
  counters: Record<string, SpanCounter>;
}

/** Totals over every release in the latest snapshot. */
export interface Totals {
  groups: Record<string, number>;
  downloads: number;
  stars: number;
  forks: number;
  /** Latest known Docker Hub pulls, null when none was ever collected. */
  docker: number | null;
  /** `downloads` counts the counted releases only, `all` every release. */
  counters: Record<string, { downloads: number; all: number }>;
}

/** Downloads per UTC day, spread uniformly over each release's live window. */
export interface EstimatedDaily {
  /** UTC day of index 0 (midnight of the first release's day). */
  start: string;
  /** One array per group, one value per UTC day from `start` to the build day (inclusive). */
  groups: Record<string, number[]>;
}

/** Change between two consecutive snapshots, dated by the later one. */
export interface MeasuredDay {
  /** UTC day of the later snapshot. */
  date: string;
  /** Days since the previous snapshot; more than 1 after a gap. */
  days: number;
  /** Downloads gained per group since the previous snapshot. */
  groups: Record<string, number>;
  /** Star change since the previous snapshot. */
  stars: number;
  /** Docker pulls change; null when either snapshot has no Docker count. */
  docker: number | null;
  /** Counted downloads gained per counter. */
  counters: Record<string, number>;
}

/** Cumulative stars at the end of a UTC day, from the stargazers' timestamps. */
export interface StarPoint {
  date: string;
  stars: number;
}

/**
 * The derived view of one repository, written as dataset.json and inlined in the
 * standalone dashboard. Built from the snapshots only; nothing here calls an API.
 */
export interface Dataset {
  /** owner/name. */
  repo: string;
  /** ISO timestamp of the build. */
  generatedAt: string;
  /** takenAt of the latest snapshot. */
  snapshotAt: string;
  groups: GroupInfo[];
  epochs: EpochInfo[];
  counters: CounterInfo[];
  totals: Totals;
  releases: ReleaseRow[];
  periods: Period[];
  estimatedDaily: EstimatedDaily;
  measuredDaily: MeasuredDay[];
  stars: StarPoint[];
  /** Present only when traffic was collected. */
  traffic?: TrafficData;
}

/** Log sink for warnings and progress; the action sends it to @actions/core. */
export interface Logger {
  info(message: string): void;
  warning(message: string): void;
}
