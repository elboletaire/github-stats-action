// Reads the data of a git ref into a folder, so the same render code serves a checkout and a branch.
// Only `git ls-tree` and `git show` run: the working tree and index are never touched.

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** The stored files of a repo: snapshots, stargazers and traffic. */
const DATA_PATH = /^[^/]+\/[^/]+\/(snapshots\/[^/]+\.json|stargazers\.json|traffic\/.+\.json)$/;

/** Copies the data files of `ref` (in the git repo at `cwd`) under `dest`, keeping their paths. */
export async function exportBranchData(ref: string, cwd: string, dest: string): Promise<number> {
  const list = await execFileAsync('git', ['ls-tree', '-r', '--name-only', '--end-of-options', ref], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  }).catch((error: Error) => {
    throw new Error(`git: cannot read ref '${ref}': ${error.message.split('\n')[0]}`);
  });
  const paths = list.stdout.split('\n').filter((p) => DATA_PATH.test(p));
  for (const path of paths) {
    const { stdout } = await execFileAsync('git', ['show', '--end-of-options', `${ref}:${path}`], {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
    });
    const target = join(dest, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, stdout);
  }
  return paths.length;
}
