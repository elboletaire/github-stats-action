import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@github-stats-action/core';
import { loadActionConfig } from '../src/config';

// @actions/core reads the `config` input from INPUT_CONFIG, the way the runner passes it
const setInput = (value: string | undefined): void => {
  if (value === undefined) delete process.env.INPUT_CONFIG;
  else process.env.INPUT_CONFIG = value;
};

describe('loadActionConfig', () => {
  afterEach(() => setInput(undefined));

  it('uses the defaults when the input is unset and no file is on disk', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'action-config-'));
    setInput(undefined);
    expect(await loadActionConfig(workspace)).toEqual(DEFAULT_CONFIG);
    setInput('');
    expect(await loadActionConfig(workspace)).toEqual(DEFAULT_CONFIG);
  });

  it('reads the file the input names', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'action-config-'));
    await writeFile(join(workspace, 'stats.yml'), 'docker: a/b\n');
    setInput('stats.yml');
    expect((await loadActionConfig(workspace)).docker).toBe('a/b');
  });

  it('fails when the input names a file that does not exist', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'action-config-'));
    setInput('missing.yml');
    await expect(loadActionConfig(workspace)).rejects.toThrow(`config file not found: ${join(workspace, 'missing.yml')}`);
  });
});
