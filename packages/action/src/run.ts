// One run: collect, write the day's snapshot, rebuild the derived files and the outputs.
// Everything is fetched before anything is written, so a failed run leaves the branch as it was.

import { join } from 'node:path';
import { renderBadges, unknownBadges } from '@github-stats-action/badges';
import { dashboardFiles } from '@github-stats-action/dashboard';
import {
  createClient,
  deriveRepo,
  fetchDockerPulls,
  fetchNpmSeries,
  fetchReleases,
  fetchRepoCounts,
  fetchStargazers,
  fetchTraffic,
  githubClient,
  pruneDerived,
  mergeTrafficDays,
  readDatasets,
  readNpmSeries,
  readStargazers,
  readTrafficSeries,
  repoDir,
  utcDate,
  writeDerived,
  writeNpmSeries,
  writeOutputFiles,
  writeSnapshot,
  writeStargazers,
  writeTrafficAggregates,
  writeTrafficSeries,
  type Dataset,
  type FetchFn,
  type Logger,
  type NpmRule,
  type NpmSeries,
  type Snapshot,
  type StatsConfig,
} from '@github-stats-action/core';
import { renderCharts } from '@github-stats-action/svg';

export interface RunOptions {
  /** owner/name. */
  repo: string;
  token?: string;
  config: StatsConfig;
  /** Root of the data branch checkout: where `<owner>/<repo>/` lives. */
  dataDir: string;
  traffic: boolean;
  /** The Pages site, when `pages` is on. */
  pages?: { dir: string; traffic: boolean };
  now: Date;
  log: Logger;
  fetch?: FetchFn;
}

export interface RunResult {
  dataset: Dataset;
  /** Absolute path of the repo's dataset.json. */
  datasetPath: string;
  summary: string;
}

/** One line for the job summary and the `summary` output. */
export function summaryLine(dataset: Dataset): string {
  const parts: string[] = [];
  if (dataset.releaseDownloads) {
    const groups = dataset.groups.map((g) => `${g.label} ${dataset.totals.groups[g.name] ?? 0}`).join(', ');
    parts.push(`${dataset.totals.downloads} downloads (${groups})`);
  }
  parts.push(`${dataset.totals.stars} stars`);
  if (dataset.totals.docker !== null) parts.push(`Docker ${dataset.totals.docker}`);
  if (dataset.npm) parts.push(`npm ${dataset.npm.totals.last30} in the last 30 days`);
  return `${dataset.repo}: ${parts.join(', ')}`;
}

/** Warns about each configured badge name no badge of the dataset could take, once per run. */
export function warnUnknownBadges(dataset: Dataset, config: StatsConfig, log: Logger): void {
  for (const name of unknownBadges(dataset, config.badges)) {
    log.warning(`badges.${name} is configured but no badge has that name`);
  }
}

/** Rebuilds the derived files, charts, badges and dashboard from the stored snapshots of `repo`. */
export async function writeDerivedOutputs(dataDir: string, repo: string, config: StatsConfig, now: Date): Promise<Dataset> {
  const dir = repoDir(dataDir, repo);
  const { dataset, csv } = await deriveRepo(dir, repo, config, now);
  await writeDerived(dir, dataset, csv);
  const files = [...renderCharts(dataset), ...renderBadges(dataset, config.badges)];
  await writeOutputFiles(dir, files);
  await pruneDerived(dir, files);
  await writeOutputFiles(dataDir, dashboardFiles(await readDatasets(dataDir), { mode: 'standalone' }));
  return dataset;
}

/** Writes the Pages site: the dashboard and the dataset, without traffic unless `traffic` is set. */
export async function writePagesSite(pages: { dir: string; traffic: boolean }, repo: string, dataset: Dataset): Promise<void> {
  // the pages build already includes data/<owner>/<repo>/dataset.json
  const pagesDataset = pages.traffic ? dataset : { ...dataset, traffic: undefined };
  await writeOutputFiles(pages.dir, dashboardFiles([pagesDataset], { mode: 'pages' }));
}

/** Brings each npm package's stored days up to date. A package that fails keeps what it had, with a warning. */
async function collectNpm(dir: string, packages: NpmRule[], today: string, fetchFn: FetchFn, log: Logger): Promise<NpmSeries[]> {
  const api = createClient({ fetch: fetchFn, baseUrl: 'https://api.npmjs.org' });
  const series: NpmSeries[] = [];
  for (const rule of packages) {
    const fetched = await fetchNpmSeries(api, rule.package, await readNpmSeries(dir, rule.package), today, log);
    if (fetched) series.push(fetched);
  }
  return series;
}

export async function runStats(options: RunOptions): Promise<RunResult> {
  const { repo, config, now, log } = options;
  const fetchFn = options.fetch ?? fetch;
  const api = githubClient(fetchFn, options.token);
  const dir = repoDir(options.dataDir, repo);
  const date = utcDate(now.getTime());

  const [counts, releases, known] = await Promise.all([
    fetchRepoCounts(api, repo),
    fetchReleases(api, repo),
    readStargazers(dir),
  ]);
  const stargazers = await fetchStargazers(api, repo, known, counts.stars, log);
  const traffic = options.traffic ? await fetchTraffic(api, repo) : undefined;
  const dockerPulls = config.docker
    ? await fetchDockerPulls(createClient({ fetch: fetchFn, baseUrl: 'https://hub.docker.com' }), config.docker, log)
    : undefined;
  const npm = config.npm?.length ? await collectNpm(dir, config.npm, date, fetchFn, log) : [];

  const snapshot: Snapshot = {
    schema: 1,
    date,
    takenAt: now.toISOString(),
    repo: counts,
    ...(config.docker && dockerPulls !== undefined ? { docker: { image: config.docker, pulls: dockerPulls } } : {}),
    releases,
  };
  await writeSnapshot(dir, snapshot);
  await writeStargazers(dir, stargazers);
  for (const series of npm) await writeNpmSeries(dir, series);
  if (traffic) {
    await writeTrafficSeries(dir, 'views', mergeTrafficDays(await readTrafficSeries(dir, 'views'), traffic.views));
    await writeTrafficSeries(dir, 'clones', mergeTrafficDays(await readTrafficSeries(dir, 'clones'), traffic.clones));
    await writeTrafficAggregates(dir, date, traffic);
  }

  const dataset = await writeDerivedOutputs(options.dataDir, repo, config, now);
  warnUnknownBadges(dataset, config, log);

  if (options.pages) await writePagesSite(options.pages, repo, dataset);

  return { dataset, datasetPath: join(dir, 'dataset.json'), summary: summaryLine(dataset) };
}
