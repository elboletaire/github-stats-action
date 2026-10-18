// Converts manga-downloader's stats-data snapshots (tools/stats-snapshot) to this layout,
// so the days already recorded there carry over.

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SNAPSHOT_RE } from './store';
import type { Snapshot } from './types';

/** The old format, as tools/stats-snapshot writes it (version 1). */
export interface OldSnapshot {
  version: number;
  taken_at: string;
  repo: { stars: number; forks: number; subscribers: number; open_issues: number };
  releases: { tag: string; published_at: string; assets: { name: string; download_count: number }[] }[];
  docker?: { pull_count: number } | null;
}

/** The old format doesn't store the prerelease flag, so every imported release counts as stable. */
export function convertOldSnapshot(old: OldSnapshot, date: string, dockerImage?: string): Snapshot {
  if (old.version !== 1) throw new Error(`${date}: unsupported old snapshot version ${old.version}`);
  return {
    schema: 1,
    date,
    takenAt: old.taken_at,
    repo: {
      stars: old.repo.stars,
      forks: old.repo.forks,
      watchers: old.repo.subscribers,
      openIssues: old.repo.open_issues,
    },
    ...(old.docker && dockerImage ? { docker: { image: dockerImage, pulls: old.docker.pull_count } } : {}),
    releases: old.releases.map((r) => ({
      tag: r.tag,
      publishedAt: r.published_at,
      prerelease: false,
      assets: r.assets.map((a) => ({ name: a.name, downloads: a.download_count })),
    })),
  };
}

export interface ImportResult {
  imported: string[];
  kept: string[];
}

/** Imports `<oldDir>/snapshots/*.json` into `<repoDir>/snapshots`; a day already there is kept, never rewritten. */
export async function importOldSnapshots(oldDir: string, repoDir: string, dockerImage?: string): Promise<ImportResult> {
  const result: ImportResult = { imported: [], kept: [] };
  const files = (await readdir(join(oldDir, 'snapshots'))).filter((f) => SNAPSHOT_RE.test(f)).sort();
  await mkdir(join(repoDir, 'snapshots'), { recursive: true });
  for (const file of files) {
    const date = file.replace(/\.json$/, '');
    const target = join(repoDir, 'snapshots', file);
    if (await exists(target)) {
      result.kept.push(date);
      continue;
    }
    const old = JSON.parse(await readFile(join(oldDir, 'snapshots', file), 'utf8')) as OldSnapshot;
    const snapshot = convertOldSnapshot(old, date, dockerImage);
    await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`);
    result.imported.push(date);
  }
  return result;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
