// The action's config: the `config` input names a file that must exist; with no input the default
// path is read, and may be missing. Apart from main.ts so a test can run it without the whole action.

import { join } from 'node:path';
import * as core from '@actions/core';
import { DEFAULT_CONFIG_PATH, loadConfigFile, type StatsConfig } from '@github-stats-action/core';

export async function loadActionConfig(workspace: string): Promise<StatsConfig> {
  const input = core.getInput('config');
  const { config, file } = await loadConfigFile(join(workspace, input || DEFAULT_CONFIG_PATH), { explicit: input !== '' });
  core.info(file ? `config: ${file}` : 'config: no config file, using the defaults');
  return config;
}
