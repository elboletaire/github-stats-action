// The derived files of one repo, computed from what's stored in its folder. No API calls.

import { buildDataset } from './dataset';
import type { StatsConfig } from './config';
import { buildDailyCsv } from './csv';
import { readSnapshots, readStargazers, readTraffic } from './store';
import { groupNames, summariseDay } from './summary';
import type { Dataset } from './types';

export interface DerivedRepo {
  dataset: Dataset;
  csv: string;
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
    now,
  });
  const names = groupNames(config, snapshots);
  const csv = buildDailyCsv(
    snapshots.map((s) => summariseDay(s, config, repo, names)),
    names,
  );
  return { dataset, csv };
}
