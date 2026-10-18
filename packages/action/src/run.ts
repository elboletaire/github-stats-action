// One run: collect, write the day's snapshot, rebuild the derived files and the outputs.
// Everything is fetched before anything is written, so a failed run leaves the branch as it was.

import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { renderBadges } from '@github-stats-action/badges';
import { dashboardFiles } from '@github-stats-action/dashboard';
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
  importOldSnapshots,
  readDatasets,
  readStargazers,
  readTrafficSeries,
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
  /** An old-format `snapshots/` under the data root (`.` for the root), imported before the day is written. */
  importOld?: string;
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
  await writeOutputFiles(dataDir, dashboardFiles(await readDatasets(dataDir), { mode: 'standalone' }));
  return dataset;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Writes the Pages site: the dashboard and the dataset, without traffic unless `traffic` is set. */
export async function writePagesSite(pages: { dir: string; traffic: boolean }, repo: string, dataset: Dataset): Promise<void> {
  // the pages build already includes data/<owner>/<repo>/dataset.json
  const pagesDataset = pages.traffic ? dataset : { ...dataset, traffic: undefined };
  await writeOutputFiles(pages.dir, dashboardFiles([pagesDataset], { mode: 'pages' }));
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
  if (options.importOld) {
    const oldDir = resolve(options.dataDir, options.importOld);
    const inside = relative(options.dataDir, oldDir);
    if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) {
      throw new Error(`import-old: ${options.importOld} is outside the data branch`);
    }
    if (!(await isDirectory(join(oldDir, 'snapshots')))) {
      throw new Error(`import-old: no snapshots/ folder at ${options.importOld} on the data branch`);
    }
    const imported = await importOldSnapshots(oldDir, dir, config.docker);
    log.info(`import: ${imported.imported.length} days imported, ${imported.kept.length} kept`);
  }
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
