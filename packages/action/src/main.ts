// Action entry point: reads the inputs, runs the stats, commits the data branch, sets outputs.

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as core from '@actions/core';
import { loadConfig } from '@github-stats-action/core';
import { checkoutDataBranch } from './git';
import { runStats, writeDerivedOutputs } from './run';

async function main(): Promise<void> {
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';
  const configPath = core.getInput('config') || '.github/stats.yml';
  const branch = core.getInput('data-branch') || 'stats-data';
  const pagesDirInput = core.getInput('pages-dir') || '_site';
  const pages = core.getBooleanInput('pages');
  const dryRun = core.getBooleanInput('dry-run');
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const now = new Date();
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set');

  const config = await loadConfig(join(workspace, configPath));
  const data = await checkoutDataBranch({ cwd: workspace, branch, tmp: process.env.RUNNER_TEMP ?? tmpdir() });
  const pagesDir = join(workspace, pagesDirInput);
  const result = await runStats({
    repo,
    token,
    config,
    dataDir: data.dir,
    traffic: core.getBooleanInput('traffic'),
    pages: pages ? { dir: pagesDir, traffic: core.getBooleanInput('pages-traffic') } : undefined,
    now,
    log: core,
  });

  if (dryRun) {
    core.info('dry-run: nothing committed or pushed');
  } else {
    const pushed = await data.publish(`stats: ${result.dataset.snapshotAt.slice(0, 10)}`, () =>
      writeDerivedOutputs(data.dir, repo, config, now),
    );
    core.info(pushed ? `pushed ${branch}` : `${branch} unchanged`);
  }
  core.setOutput('pages-dir', pages ? pagesDir : '');
  core.setOutput('dataset', result.datasetPath);
  core.setOutput('summary', result.summary);
}

main().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
