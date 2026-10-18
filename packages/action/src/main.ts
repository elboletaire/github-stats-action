// Action entry point: reads the inputs, runs the stats, commits the data branch, sets outputs.

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as core from '@actions/core';
import { loadActionConfig } from './config';
import { checkoutDataBranch } from './git';
import { runStats, writeDerivedOutputs, writePagesSite } from './run';

async function main(): Promise<void> {
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';
  const branch = core.getInput('data-branch') || 'stats-data';
  const pagesDirInput = core.getInput('pages-dir') || '_site';
  const pages = core.getBooleanInput('pages');
  const dryRun = core.getBooleanInput('dry-run');
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const now = new Date();
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set');

  const config = await loadActionConfig(workspace);
  const data = await checkoutDataBranch({ cwd: workspace, branch, tmp: process.env.RUNNER_TEMP ?? tmpdir() });
  try {
    const pagesDir = join(workspace, pagesDirInput);
    const pagesOptions = pages ? { dir: pagesDir, traffic: core.getBooleanInput('pages-traffic') } : undefined;
    const result = await runStats({
      repo,
      token,
      config,
      dataDir: data.dir,
      traffic: core.getBooleanInput('traffic'),
      pages: pagesOptions,
      now,
      log: core,
    });

    if (dryRun) {
      core.info('dry-run: nothing committed or pushed');
    } else {
      // After a rebase onto a moved branch, the outputs are rebuilt from the merged snapshots.
      const rederive = async (): Promise<void> => {
        const rebuilt = await writeDerivedOutputs(data.dir, repo, config, now);
        if (pagesOptions) await writePagesSite(pagesOptions, repo, rebuilt);
      };
      const pushed = await data.publish(`stats: ${result.dataset.snapshotAt.slice(0, 10)}`, rederive);
      core.info(pushed ? `pushed ${branch}` : `${branch} unchanged`);
    }
    core.setOutput('pages-dir', pages ? pagesDir : '');
    core.setOutput('dataset', result.datasetPath);
    core.setOutput('summary', result.summary);
  } finally {
    // a failed cleanup must not hide the run's own error
    await data.dispose().catch((error: unknown) => core.warning(`could not remove the data worktree: ${String(error)}`));
  }
}

main().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
