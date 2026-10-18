// Local run of the same pipeline: writes into --out and never pushes.

import { parseArgs } from 'node:util';
import { loadConfig, importOldSnapshots, repoDir } from '@github-stats-action/core';
import { runStats } from './run';

const USAGE = `usage: pnpm stats --repo owner/name --out <dir> [--config <file>] [--traffic] [--dry-run] [--import-old <dir>]

  --repo        owner/name to collect (required)
  --out         directory to write <owner>/<repo>/ into (required)
  --config      stats config (default .github/stats.yml; missing means defaults)
  --traffic     collect traffic (needs a token with push access, a PAT)
  --dry-run     accepted for parity with the action; the CLI never pushes
  --import-old  stats-data checkout of manga-downloader's old layout, imported before the run
  token         read from GITHUB_TOKEN`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      repo: { type: 'string' },
      out: { type: 'string' },
      config: { type: 'string', default: '.github/stats.yml' },
      traffic: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'import-old': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.help || !values.repo || !values.out) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 2);
  }

  const log = {
    info: (message: string) => console.log(message),
    warning: (message: string) => console.warn(`warning: ${message}`),
  };
  const config = await loadConfig(values.config);
  if (values['import-old']) {
    const imported = await importOldSnapshots(values['import-old'], repoDir(values.out, values.repo), config.docker);
    log.info(`import: ${imported.imported.length} days imported, ${imported.kept.length} kept`);
  }
  const result = await runStats({
    repo: values.repo,
    token: process.env.GITHUB_TOKEN,
    config,
    dataDir: values.out,
    traffic: values.traffic,
    now: new Date(),
    log,
  });
  log.info(result.summary);
  log.info(`dataset: ${result.datasetPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
