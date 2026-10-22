import { configDefaults, defineConfig } from 'vitest/config';

// task worktrees live inside the repo; their copies of the tests aren't ours
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.worktrees/**'], setupFiles: ['./vitest.setup.ts'] },
});
