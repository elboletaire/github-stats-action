// One run: collect, write the day's snapshot, rebuild the derived files and the outputs.
// Everything is fetched before anything is written, so a failed run leaves the branch as it was.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderBadges } from '@github-stats-action/badges';
import {
  createClient,
  deriveRepo,
  fetchDockerPulls,
  fetchReleases,
  fetchRepoCounts,
  fetchStargazers,
  fetchTraffic,
  githubClient,
  mergeTrafficDays,
  readDatasets,
  readStargazers,
  readTrafficSeries,
  renderCharts,
  renderDashboard,
  repoDir,
  utcDate,
  writeDerived,
  writeOutputFiles,
  writeSnapshot,
  writeStargazers,
  writeTrafficAggregates,
  writeTrafficSeries,
  type Dataset,
  type FetchFn,
  type Logger,
  type Snapshot,
  type StatsConfig,
} from '@github-stats-action/core';

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
  const groups = dataset.groups.map((g) => `${g.label} ${dataset.totals.groups[g.name] ?? 0}`).join(', ');
  const docker = dataset.totals.docker === null ? '' : `, Docker ${dataset.totals.docker}`;
  return `${dataset.repo}: ${dataset.totals.downloads} downloads (${groups}), ${dataset.totals.stars} stars${docker}`;
}

/** Rebuilds the derived files, charts, badges and dashboard from the stored snapshots of `repo`. */
export async function writeDerivedOutputs(dataDir: string, repo: string, config: StatsConfig, now: Date): Promise<Dataset> {
  const dir = repoDir(dataDir, repo);
  const { dataset, csv } = await deriveRepo(dir, repo, config, now);
  await writeDerived(dir, dataset, csv);
  await writeOutputFiles(dir, [...renderCharts(dataset), ...renderBadges(dataset)]);
  await writeOutputFiles(dataDir, renderDashboard(await readDatasets(dataDir), { mode: 'standalone' }));
  return dataset;
}

/** Writes the Pages site: the dashboard and the dataset, without traffic unless `traffic` is set. */
export async function writePagesSite(pages: { dir: string; traffic: boolean }, repo: string, dataset: Dataset): Promise<void> {
  const pagesDataset = pages.traffic ? dataset : { ...dataset, traffic: undefined };
  const datasetPath = join(pages.dir, 'data', repo, 'dataset.json');
  await mkdir(join(datasetPath, '..'), { recursive: true });
  await writeFile(datasetPath, `${JSON.stringify(pagesDataset, null, 1)}\n`);
  await writeOutputFiles(pages.dir, renderDashboard([pagesDataset], { mode: 'pages' }));
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
  if (traffic) {
    await writeTrafficSeries(dir, 'views', mergeTrafficDays(await readTrafficSeries(dir, 'views'), traffic.views));
    await writeTrafficSeries(dir, 'clones', mergeTrafficDays(await readTrafficSeries(dir, 'clones'), traffic.clones));
    await writeTrafficAggregates(dir, date, traffic);
  }

  const dataset = await writeDerivedOutputs(options.dataDir, repo, config, now);

  if (options.pages) await writePagesSite(options.pages, repo, dataset);

  return { dataset, datasetPath: join(dir, 'dataset.json'), summary: summaryLine(dataset) };
}
