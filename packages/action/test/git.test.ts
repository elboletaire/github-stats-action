import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkoutDataBranch } from '../src/git';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();

/** A bare remote and a workspace clone of it with one commit on `main`. */
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'stats-git-'));
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  git(root, 'init', '--bare', '-q', '-b', 'main', remote);
  await mkdir(work);
  git(work, 'init', '-q', '-b', 'main');
  git(work, 'config', 'user.email', 'dev@example.com');
  git(work, 'config', 'user.name', 'dev');
  await writeFile(join(work, 'README.md'), 'code\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'init');
  git(work, 'remote', 'add', 'origin', remote);
  git(work, 'push', '-q', 'origin', 'main');
  return { root, remote, work };
}

describe('checkoutDataBranch', () => {
  it('starts an orphan data branch when there is none, then appends to it', async () => {
    const { root, remote, work } = await setup();
    const first = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await mkdir(join(first.dir, 'o', 'r'), { recursive: true });
    await writeFile(join(first.dir, 'o', 'r', 'day1.json'), '{}\n');
    expect(await first.publish('stats: day 1')).toBe(true);
    expect(git(remote, 'show', 'stats-data:o/r/day1.json')).toBe('{}');
    expect(git(remote, 'rev-list', '--count', 'stats-data')).toBe('1');

    const second = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await writeFile(join(second.dir, 'o', 'r', 'day2.json'), '{}\n');
    expect(await second.publish('stats: day 2')).toBe(true);
    expect(git(remote, 'rev-list', '--count', 'stats-data')).toBe('2');
  });

  it('fails without creating an orphan branch when the remote cannot be read', async () => {
    const { root, work } = await setup();
    git(work, 'remote', 'set-url', 'origin', join(root, 'missing.git'));
    await expect(checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root })).rejects.toThrow();
    expect(git(work, 'branch', '--list', 'stats-data')).toBe('');
  });

  it('publishes nothing when the run changed no file', async () => {
    const { root, remote, work } = await setup();
    const data = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await writeFile(join(data.dir, 'a.json'), '1\n');
    await data.publish('first');
    const again = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await writeFile(join(again.dir, 'a.json'), '1\n');
    expect(await again.publish('same')).toBe(false);
    expect(git(remote, 'rev-list', '--count', 'stats-data')).toBe('1');
  });

  it('rebases once when the branch moved on, keeping this run\'s file', async () => {
    const { root, remote, work } = await setup();
    const data = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await writeFile(join(data.dir, 'seed.json'), '0\n');
    await data.publish('seed');

    const mine = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    const other = join(root, 'other');
    git(root, 'clone', '-q', '-b', 'stats-data', remote, other);
    git(other, 'config', 'user.email', 'x@example.com');
    git(other, 'config', 'user.name', 'other');
    await writeFile(join(other, 'theirs.json'), '2\n');
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', 'someone else');
    git(other, 'push', '-q', 'origin', 'stats-data');

    await writeFile(join(mine.dir, 'mine.json'), '3\n');
    expect(await mine.publish('mine')).toBe(true);
    expect(git(remote, 'show', 'stats-data:theirs.json')).toBe('2');
    expect(git(remote, 'show', 'stats-data:mine.json')).toBe('3');
    expect(await readFile(join(mine.dir, 'theirs.json'), 'utf8')).toBe('2\n');
  });

  it('rebuilds the derived files over the rebased tree, so they include the day pushed meanwhile', async () => {
    const { root, remote, work } = await setup();
    const seed = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await mkdir(join(seed.dir, 'snapshots'), { recursive: true });
    await writeFile(join(seed.dir, 'snapshots', '2026-01-01.json'), '{}\n');
    await seed.publish('day 1');

    const mine = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await writeFile(join(mine.dir, 'snapshots', '2026-01-03.json'), '{}\n');
    const other = join(root, 'other');
    git(root, 'clone', '-q', '-b', 'stats-data', remote, other);
    git(other, 'config', 'user.email', 'x@example.com');
    git(other, 'config', 'user.name', 'other');
    await mkdir(join(other, 'snapshots'), { recursive: true });
    await writeFile(join(other, 'snapshots', '2026-01-02.json'), '{}\n');
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', 'day 2');
    git(other, 'push', '-q', 'origin', 'stats-data');

    const derive = async () => {
      const days = (await readdir(join(mine.dir, 'snapshots'))).sort();
      await writeFile(join(mine.dir, 'daily.csv'), `${days.join('\n')}\n`);
    };
    expect(await mine.publish('day 3', derive)).toBe(true);
    expect(git(remote, 'show', 'stats-data:daily.csv')).toBe('2026-01-01.json\n2026-01-02.json\n2026-01-03.json');
    expect(git(remote, 'rev-list', '--count', 'stats-data')).toBe('3');
  });

  describe('when the rebase drops this run\'s commit', () => {
    /** The data branch with `a.json` = 1 pushed by someone else after this run took its checkout. */
    async function raced() {
      const { root, remote, work } = await setup();
      const seed = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
      await writeFile(join(seed.dir, 'seed.json'), '0\n');
      await seed.publish('seed');

      const mine = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
      await writeFile(join(mine.dir, 'a.json'), '1\n');
      const other = join(root, 'other');
      git(root, 'clone', '-q', '-b', 'stats-data', remote, other);
      git(other, 'config', 'user.email', 'x@example.com');
      git(other, 'config', 'user.name', 'other');
      await writeFile(join(other, 'a.json'), '1\n');
      git(other, 'add', '-A');
      git(other, 'commit', '-q', '-m', 'same change');
      git(other, 'push', '-q', 'origin', 'stats-data');
      return { remote, mine, other };
    }

    it('reports nothing published and leaves the remote tip alone', async () => {
      const { remote, mine, other } = await raced();
      expect(await mine.publish('mine')).toBe(false);
      expect(git(remote, 'rev-parse', 'stats-data')).toBe(git(other, 'rev-parse', 'HEAD'));
    });

    it('commits the rederived files on top of the remote instead of amending it', async () => {
      const { remote, mine, other } = await raced();
      const derive = () => writeFile(join(mine.dir, 'daily.csv'), 'day\n');
      expect(await mine.publish('mine', derive)).toBe(true);
      expect(git(remote, 'show', 'stats-data:daily.csv')).toBe('day');
      expect(git(remote, 'log', '-1', '--format=%s', 'stats-data')).toBe('mine');
      expect(git(remote, 'rev-parse', 'stats-data^')).toBe(git(other, 'rev-parse', 'HEAD'));
    });
  });

  it('starts the orphan branch even when the workspace already has a local branch of that name', async () => {
    const { root, remote, work } = await setup();
    git(work, 'branch', 'stats-data');
    const data = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
    await writeFile(join(data.dir, 'day1.json'), '{}\n');
    expect(await data.publish('stats: day 1')).toBe(true);
    expect(git(remote, 'ls-tree', '--name-only', 'stats-data')).toBe('day1.json');
    expect(git(work, 'rev-parse', 'stats-data')).toBe(git(work, 'rev-parse', 'main'));
  });

  describe('when other runs keep pushing first', () => {
    /** Commits `file` on the data branch from another clone, the way a concurrent run would. */
    async function pushElsewhere(other: string, file: string): Promise<void> {
      git(other, 'fetch', '-q', 'origin');
      git(other, 'reset', '-q', '--hard', 'origin/stats-data');
      await writeFile(join(other, file), '1\n');
      git(other, 'add', '-A');
      git(other, 'commit', '-q', '-m', `race ${file}`);
      git(other, 'push', '-q', 'origin', 'stats-data');
    }

    /** A data branch with `seed.json`, this run's checkout, and a clone to race it with. */
    async function seeded() {
      const { root, remote, work } = await setup();
      const seed = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
      await writeFile(join(seed.dir, 'seed.json'), '0\n');
      await seed.publish('seed');
      const mine = await checkoutDataBranch({ cwd: work, branch: 'stats-data', tmp: root });
      await writeFile(join(mine.dir, 'mine.json'), '1\n');
      const other = join(root, 'other');
      git(root, 'clone', '-q', '-b', 'stats-data', remote, other);
      git(other, 'config', 'user.email', 'x@example.com');
      git(other, 'config', 'user.name', 'other');
      return { remote, mine, other };
    }

    it('rebases again when the second push also loses the race', async () => {
      const { remote, mine, other } = await seeded();
      await pushElsewhere(other, 'first.json');
      let calls = 0;
      const derive = async () => {
        if (++calls === 1) await pushElsewhere(other, 'second.json');
      };
      expect(await mine.publish('mine', derive)).toBe(true);
      expect(git(remote, 'ls-tree', '--name-only', 'stats-data').split('\n').sort()).toEqual([
        'first.json',
        'mine.json',
        'second.json',
        'seed.json',
      ]);
      expect(git(remote, 'log', '-1', '--format=%s', 'stats-data')).toBe('mine');
    });

    it('gives up after three rejected pushes and leaves the remote tip alone', async () => {
      const { remote, mine, other } = await seeded();
      await pushElsewhere(other, 'first.json');
      let calls = 0;
      const derive = () => pushElsewhere(other, `race-${++calls}.json`);
      await expect(mine.publish('mine', derive)).rejects.toThrow();
      expect(calls).toBe(2);
      expect(git(remote, 'rev-parse', 'stats-data')).toBe(git(other, 'rev-parse', 'HEAD'));
    });
  });
});
