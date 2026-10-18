// The data branch as a git worktree, so it's checked out, committed and pushed without
// touching the workspace's own checkout.

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BOT = {
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com',
};

const AS_BOT = ['-c', `user.name=${BOT.name}`, '-c', `user.email=${BOT.email}`];

/** Pushes tried before giving up: the first, then two rebased retries. */
const PUSH_ATTEMPTS = 3;

export interface DataBranch {
  /** The worktree holding the branch; the run writes here. */
  dir: string;
  /** Commits and pushes what changed, false when nothing did; `rederive` rebuilds derived files after a rebase. */
  publish(message: string, rederive?: () => Promise<unknown>): Promise<boolean>;
  /** Removes the worktree, its folder and any throwaway branch, leaving the workspace as it was. */
  dispose(): Promise<void>;
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout.trim();
}

/** `ls-remote --exit-code` exits 2 when no ref matches; any other failure (auth, network) is an error. */
async function remoteBranchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await git(['ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`], cwd);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 2) return false;
    throw error;
  }
}

async function hasStagedChanges(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['diff', '--cached', '--quiet'], { cwd });
    return false;
  } catch {
    return true;
  }
}

// Checks out `branch` into a worktree under `tmp`, starting an orphan one when it doesn't exist yet.
// A push rejected as non-fast-forward rebases onto the new tip and retries, keeping this run's files.
export async function checkoutDataBranch(options: { cwd: string; branch: string; tmp: string }): Promise<DataBranch> {
  const { cwd, branch } = options;
  const remoteRef = `refs/remotes/origin/${branch}`;
  const exists = await remoteBranchExists(cwd, branch);
  if (exists) await git(['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${branch}:${remoteRef}`], cwd);

  const root = await mkdtemp(join(options.tmp, 'stats-data-'));
  const dir = join(root, 'worktree');
  // A throwaway branch: `--orphan` refuses a name the workspace already has, and the push names the real one.
  const throwaway = exists ? undefined : `orphan-${randomUUID()}`;
  if (throwaway) {
    await git(['worktree', 'add', '--quiet', '--orphan', '-b', throwaway, dir], cwd);
  } else {
    await git(['worktree', 'add', '--quiet', '--detach', dir, remoteRef], cwd);
  }

  return {
    dir,
    async dispose(): Promise<void> {
      // each step runs even when an earlier one failed, and the failures are reported together
      const failures: string[] = [];
      const step = async (action: () => Promise<unknown>): Promise<void> => {
        try {
          await action();
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      };
      await step(() => git(['worktree', 'remove', '--force', dir], cwd));
      if (throwaway) await step(() => git(['branch', '-D', throwaway], cwd));
      await step(() => rm(root, { recursive: true, force: true }));
      if (failures.length > 0) throw new Error(failures.join('; '));
    },
    async publish(message: string, rederive?: () => Promise<unknown>): Promise<boolean> {
      await git(['add', '-A'], dir);
      if (!(await hasStagedChanges(dir))) return false;
      await git([...AS_BOT, 'commit', '--quiet', '-m', message], dir);
      for (let attempt = 1; ; attempt++) {
        try {
          await git(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], dir);
          return true;
        } catch (error) {
          if (attempt === PUSH_ATTEMPTS) throw error;
        }
        await git(['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${branch}:${remoteRef}`], dir);
        await git([...AS_BOT, 'rebase', '--quiet', '-X', 'theirs', remoteRef], dir);
        // The rebase drops this run's commit when the remote already holds the same change.
        const ours = (await git(['rev-parse', 'HEAD'], dir)) !== (await git(['rev-parse', remoteRef], dir));
        await rederive?.();
        await git(['add', '-A'], dir);
        if (await hasStagedChanges(dir)) {
          await git([...AS_BOT, 'commit', '--quiet', ...(ours ? ['--amend', '--no-edit'] : ['-m', message])], dir);
        } else if (!ours) {
          return false;
        }
      }
    },
  };
}
