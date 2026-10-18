// The data branch as a git worktree, so it's checked out, committed and pushed without
// touching the workspace's own checkout.

import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BOT = {
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com',
};

const AS_BOT = ['-c', `user.name=${BOT.name}`, '-c', `user.email=${BOT.email}`];

export interface DataBranch {
  /** The worktree holding the branch; the run writes here. */
  dir: string;
  /**
   * Commits and pushes what changed. Returns false when nothing did. After a rebase onto a
   * moved branch, `rederive` rebuilds the derived files over the rebased tree first.
   */
  publish(message: string, rederive?: () => Promise<unknown>): Promise<boolean>;
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

/**
 * Checks out `branch` from origin into a worktree under `tmp`, or starts an orphan one
 * when the branch doesn't exist yet. A push rejected as non-fast-forward is rebased
 * once onto the new remote tip, keeping this run's files where they conflict.
 */
export async function checkoutDataBranch(options: { cwd: string; branch: string; tmp: string }): Promise<DataBranch> {
  const { cwd, branch } = options;
  const remoteRef = `refs/remotes/origin/${branch}`;
  const exists = await remoteBranchExists(cwd, branch);
  if (exists) await git(['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${branch}:${remoteRef}`], cwd);

  const dir = join(await mkdtemp(join(options.tmp, 'stats-data-')), 'worktree');
  if (exists) {
    await git(['worktree', 'add', '--quiet', '--detach', dir, remoteRef], cwd);
  } else {
    await git(['worktree', 'add', '--quiet', '--orphan', '-b', branch, dir], cwd);
  }

  return {
    dir,
    async publish(message: string, rederive?: () => Promise<unknown>): Promise<boolean> {
      await git(['add', '-A'], dir);
      if (!(await hasStagedChanges(dir))) return false;
      await git([...AS_BOT, 'commit', '--quiet', '-m', message], dir);
      try {
        await git(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], dir);
      } catch {
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
        await git(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], dir);
      }
      return true;
    },
  };
}
