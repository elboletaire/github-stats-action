// The `github-stats` CLI. `collect` (the default) fetches from GitHub and renders; `render`
// makes no API calls and rebuilds the outputs from data already stored.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_CONFIG_PATH, loadConfigFile, type Logger, type StatsConfig } from '@github-stats-action/core';
import { exportBranchData } from './branch';
import { renderData } from './render';
import { runStats } from './run';

const USAGE = `usage:
  github-stats [collect] --repo owner/name --out <dir> [--config <file>] [--traffic] [--dry-run]
      fetch from GitHub, write the day's snapshot and render into <dir>.
      --traffic     collect traffic (needs a token with push access, a PAT)
      --dry-run     accepted for parity with the action; the CLI never pushes
      token         read from GITHUB_TOKEN

  github-stats render (--data <dir> | --from-branch <ref>) --out <dir> [--repo owner/name] [--config <file>]
      no API calls: rebuild the derived files and outputs from stored data.
      --data         a data branch checkout (<owner>/<repo>/ inside)
      --from-branch  a git ref of the repo in the current directory, e.g. origin/stats-data;
                     read with git, the working tree is not touched

  --config  stats config (default .github/stats.yml; only the default may be missing, giving the defaults)`;

const log: Logger = {
  info: (message) => console.log(message),
  warning: (message) => console.warn(`warning: ${message}`),
};

const OPTIONS = {
  repo: { type: 'string' },
  out: { type: 'string' },
  config: { type: 'string' },
  traffic: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  data: { type: 'string' },
  'from-branch': { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>['values'];

/** The config from --config, or the default path when it was not given (which may then be missing). */
async function readConfig(values: Values): Promise<StatsConfig> {
  const { config, file } = await loadConfigFile(values.config ?? DEFAULT_CONFIG_PATH, { explicit: values.config !== undefined });
  log.info(file ? `config: ${file}` : 'config: no config file, using the defaults');
  return config;
}

async function collect(values: Values): Promise<void> {
  if (!values.repo || !values.out) throw new Error('collect needs --repo and --out');
  const config = await readConfig(values);
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

async function render(values: Values, cwd: string): Promise<void> {
  if (!values.out) throw new Error('render needs --out');
  if (Boolean(values.data) === Boolean(values['from-branch'])) {
    throw new Error('render needs exactly one of --data or --from-branch');
  }
  const config = await readConfig(values);
  const options = { outDir: values.out, config, repo: values.repo, log };
  if (values.data) {
    await renderData({ ...options, dataRoot: values.data });
    return;
  }
  const exported = await mkdtemp(join(tmpdir(), 'github-stats-render-'));
  try {
    await exportBranchData(values['from-branch']!, cwd, exported);
    await renderData({ ...options, dataRoot: exported });
  } finally {
    await rm(exported, { recursive: true, force: true });
  }
}

/** Runs the CLI with `argv` (without node and the script), in `cwd` for git. Returns the exit code. */
export async function runCli(argv: string[], cwd: string = process.cwd()): Promise<number> {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const command = positionals[0] ?? 'collect';
  if (positionals.length > 1 || (command !== 'collect' && command !== 'render')) {
    console.error(`unknown command: ${positionals.join(' ')}\n\n${USAGE}`);
    return 2;
  }
  try {
    if (command === 'render') await render(values, cwd);
    else await collect(values);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
