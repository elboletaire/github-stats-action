// The derived files of one repo, computed from what's stored in its folder. No API calls.

import { buildDataset } from './dataset';
import type { NpmInput } from './npm';
import type { StatsConfig } from './config';
import { buildDailyCsv } from './csv';
import { readNpmSeries, readSnapshots, readStargazers, readTraffic } from './store';
import { groupNames, summariseDay } from './summary';
import type { Dataset } from './types';

export interface DerivedRepo {
  dataset: Dataset;
  csv: string;
}

/** The stored days of each configured npm package; none when the config lists none. */
async function readNpmInputs(dir: string, config: StatsConfig): Promise<NpmInput[] | undefined> {
  if (!config.npm) return undefined;
  return Promise.all(
    config.npm.map(async (rule) => ({
      label: rule.label,
      series: (await readNpmSeries(dir, rule.package)) ?? { schema: 1 as const, package: rule.package, days: [] },
    })),
  );
}

/** Builds the Dataset and daily.csv from the snapshots, stargazers and traffic in `dir` (`<owner>/<repo>/`). */
export async function deriveRepo(dir: string, repo: string, config: StatsConfig, now: Date): Promise<DerivedRepo> {
  const snapshots = await readSnapshots(dir);
  if (snapshots.length === 0) throw new Error(`${repo}: no snapshots in ${dir}`);
  const dataset = buildDataset({
    repo,
    config,
    snapshots,
    stargazers: await readStargazers(dir),
    traffic: await readTraffic(dir),
    npm: await readNpmInputs(dir, config),
    now,
  });
  const names = dataset.releaseDownloads ? groupNames(config, snapshots) : [];
  const csv = buildDailyCsv(
    snapshots.map((s) => summariseDay(s, config, repo, names)),
    names,
    { downloads: dataset.releaseDownloads, docker: Boolean(config.docker), npm: dataset.npm?.packages ?? [] },
  );
  return { dataset, csv };
}
