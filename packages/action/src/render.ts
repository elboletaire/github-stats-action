// `render`: rebuilds the derived files and the outputs from data already stored, with no API calls.

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { renderBadges } from '@github-stats-action/badges';
import { dashboardFiles } from '@github-stats-action/dashboard';
import {
  deriveRepo,
  listRepos,
  readSnapshots,
  repoDir,
  writeDerived,
  writeOutputFiles,
  type Dataset,
  type Logger,
  type StatsConfig,
} from '@github-stats-action/core';
import { renderCharts } from '@github-stats-action/svg';

export interface RenderOptions {
  /** Folder holding `<owner>/<repo>/` (a data branch checkout, or an exported copy). */
  dataRoot: string;
  /** Where the outputs go, in the same `<owner>/<repo>/` layout. */
  outDir: string;
  config: StatsConfig;
  /** owner/name to render; needed when the data holds more than one repo. */
  repo?: string;
  log: Logger;
}

export interface RenderResult {
  datasets: Dataset[];
  /** Absolute paths of the written dataset.json files. */
  datasetPaths: string[];
}

export async function renderData(options: RenderOptions): Promise<RenderResult> {
  const repos = await listRepos(options.dataRoot);
  if (repos.length === 0) throw new Error(`no snapshots under ${options.dataRoot}`);
  const selected = options.repo ? repos.filter((r) => r === options.repo) : repos;
  if (selected.length === 0) throw new Error(`${options.repo} has no snapshots under ${options.dataRoot}`);
  if (selected.length > 1) throw new Error(`the data holds ${selected.length} repos; pick one with --repo (${selected.join(', ')})`);

  const repo = selected[0]!;
  // The latest snapshot's time is "now": the output depends on the data only, so re-rendering is reproducible.
  const source = repoDir(options.dataRoot, repo);
  const latest = (await readSnapshots(source)).at(-1);
  if (!latest) throw new Error(`${repo}: no snapshots in ${source}`);
  const { dataset, csv } = await deriveRepo(source, repo, options.config, new Date(latest.takenAt));
  const dir = repoDir(options.outDir, repo);
  await mkdir(dir, { recursive: true });
  await writeDerived(dir, dataset, csv);
  await writeOutputFiles(dir, [...renderCharts(dataset), ...renderBadges(dataset)]);
  await writeOutputFiles(options.outDir, dashboardFiles([dataset], { mode: 'standalone' }));
  options.log.info(`rendered ${repo} into ${options.outDir}`);
  return { datasets: [dataset], datasetPaths: [join(dir, 'dataset.json')] };
}
