// Files of one repo on the data branch (`<owner>/<repo>/`). Reads treat a missing file as
// empty; writes create their folders.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OutputFile } from './outputs';
import { npmSlug } from './npm';
import type { Dataset, NpmSeries, PopularPath, Referrer, Snapshot, TrafficDay, TrafficData } from './types';

export const SNAPSHOT_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;

/** Where a repo's files live under the data branch root. */
export function repoDir(root: string, repo: string): string {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`repo must be owner/name, got '${repo}'`);
  return join(root, owner, name);
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function listJson(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Writes `snapshots/<date>.json`, replacing a snapshot already taken that day. */
export async function writeSnapshot(dir: string, snapshot: Snapshot): Promise<void> {
  await writeJson(join(dir, 'snapshots', `${snapshot.date}.json`), snapshot);
}

/** Every snapshot, oldest first. */
export async function readSnapshots(dir: string): Promise<Snapshot[]> {
  const snapshots: Snapshot[] = [];
  for (const file of await listJson(join(dir, 'snapshots'))) {
    if (!SNAPSHOT_RE.test(file)) continue;
    const snapshot = await readJson<Snapshot>(join(dir, 'snapshots', file));
    if (snapshot?.schema !== 1) throw new Error(`snapshots/${file}: unsupported schema`);
    snapshots.push(snapshot);
  }
  return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}

export async function readStargazers(dir: string): Promise<string[]> {
  return (await readJson<string[]>(join(dir, 'stargazers.json'))) ?? [];
}

export async function writeStargazers(dir: string, starredAt: readonly string[]): Promise<void> {
  await writeJson(join(dir, 'stargazers.json'), starredAt);
}

/** The stored daily counts of an npm package (`npm/<slug>.json`), undefined when none were stored. */
export async function readNpmSeries(dir: string, pkg: string): Promise<NpmSeries | undefined> {
  const series = await readJson<NpmSeries>(join(dir, 'npm', `${npmSlug(pkg)}.json`));
  if (series && series.schema !== 1) throw new Error(`npm/${npmSlug(pkg)}.json: unsupported schema`);
  return series;
}

export async function writeNpmSeries(dir: string, series: NpmSeries): Promise<void> {
  await writeJson(join(dir, 'npm', `${npmSlug(series.package)}.json`), series);
}

export async function readTrafficSeries(dir: string, kind: 'views' | 'clones'): Promise<TrafficDay[]> {
  return (await readJson<TrafficDay[]>(join(dir, 'traffic', `${kind}.json`))) ?? [];
}

export async function writeTrafficSeries(dir: string, kind: 'views' | 'clones', days: TrafficDay[]): Promise<void> {
  await writeJson(join(dir, 'traffic', `${kind}.json`), days);
}

/** Writes the referrers and paths GitHub reported on `date`. */
export async function writeTrafficAggregates(
  dir: string,
  date: string,
  aggregates: { referrers: Referrer[]; paths: PopularPath[] },
): Promise<void> {
  await writeJson(join(dir, 'traffic', 'referrers', `${date}.json`), aggregates.referrers);
  await writeJson(join(dir, 'traffic', 'paths', `${date}.json`), aggregates.paths);
}

/** The traffic a repo has on the branch, or undefined when none was ever collected. */
export async function readTraffic(dir: string): Promise<TrafficData | undefined> {
  const views = await readJson<TrafficDay[]>(join(dir, 'traffic', 'views.json'));
  if (!views) return undefined;
  const clones = await readTrafficSeries(dir, 'clones');
  const latest = (await listJson(join(dir, 'traffic', 'referrers'))).at(-1);
  const asOf = latest ? latest.replace(/\.json$/, '') : null;
  const referrers = latest ? (await readJson<Referrer[]>(join(dir, 'traffic', 'referrers', latest))) ?? [] : [];
  const paths = latest ? (await readJson<PopularPath[]>(join(dir, 'traffic', 'paths', latest))) ?? [] : [];
  return { views, clones, referrers, paths, asOf };
}

/** The `owner/name` of every repo folder that holds snapshots, sorted. */
export async function listRepos(root: string): Promise<string[]> {
  const repos: string[] = [];
  for (const owner of await listDirs(root)) {
    for (const name of await listDirs(join(root, owner))) {
      if ((await listJson(join(root, owner, name, 'snapshots'))).length > 0) repos.push(`${owner}/${name}`);
    }
  }
  return repos;
}

/** Every repo's dataset.json on the branch, for the standalone dashboard. */
export async function readDatasets(root: string): Promise<Dataset[]> {
  const datasets: Dataset[] = [];
  for (const owner of await listDirs(root)) {
    for (const name of await listDirs(join(root, owner))) {
      const dataset = await readJson<Dataset>(join(root, owner, name, 'dataset.json'));
      if (dataset) datasets.push(dataset);
    }
  }
  return datasets;
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Writes the derived files of a repo: dataset.json and daily.csv. */
export async function writeDerived(dir: string, dataset: Dataset, csv: string): Promise<void> {
  await writeJson(join(dir, 'dataset.json'), dataset);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'daily.csv'), csv);
}

/** Folders whose files are all rebuilt on every run, so a file no run produces any more is stale. */
const REBUILT_DIRS = ['charts', 'badges'];

/** Removes the files of `charts/` and `badges/` that `files` no longer produces, e.g. the download charts once release downloads are off. */
export async function pruneDerived(dir: string, files: readonly OutputFile[]): Promise<void> {
  const keep = new Set(files.map((file) => file.path));
  for (const sub of REBUILT_DIRS) {
    let names: string[];
    try {
      names = await readdir(join(dir, sub));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names) {
      const path = `${sub}/${name}`;
      if (!keep.has(path)) await rm(join(dir, path), { force: true });
    }
  }
}

/** Writes rendered output files under `root`, creating their folders. */
export async function writeOutputFiles(root: string, files: readonly OutputFile[]): Promise<void> {
  for (const file of files) {
    const path = join(root, file.path);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content);
  }
}
