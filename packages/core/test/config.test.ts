import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_CONFIG, loadConfig, loadConfigFile, parseConfig } from '../src/config';

const FIXTURE = new URL('../../../fixtures/manga-downloader.stats.yml', import.meta.url);

describe('parseConfig', () => {
  it('gives the defaults for an empty document', () => {
    expect(parseConfig('')).toEqual(DEFAULT_CONFIG);
    expect(parseConfig('# nothing here\n')).toEqual(DEFAULT_CONFIG);
  });

  it('reads a file with only groups, leaving epochs and the rest empty', () => {
    const config = parseConfig('groups:\n  - { name: cli, assets: "manga-downloader-*" }\n');
    expect(config.groups).toEqual([{ name: 'cli', label: 'cli', assets: 'manga-downloader-*' }]);
    expect(config.epochs).toEqual([]);
    expect(config.counters).toEqual([]);
  });

  it('defaults labels to the name and the optional lists to empty', () => {
    const config = parseConfig('groups:\n  - { name: app, assets: "gui-*" }\n');
    expect(config.groups).toEqual([{ name: 'app', label: 'app', assets: 'gui-*' }]);
    expect(config.ignore).toEqual([]);
    expect(config.counters).toEqual([]);
    expect(config.epochs).toEqual([]);
    expect(config.platforms).toEqual([]);
    expect(config.docker).toBeUndefined();
  });

  it('parses the manga-downloader config', async () => {
    const config = parseConfig(await (await import('node:fs/promises')).readFile(FIXTURE, 'utf8'));
    expect(config.groups.map((g) => g.name)).toEqual(['app', 'cli']);
    expect(config.ignore).toEqual(['*.md5', '*-SHA256SUMS.txt']);
    expect(config.counters).toEqual([
      { name: 'updates', label: 'In-app updates', assets: 'manga-downloader-gui-*-SHA256SUMS.txt', from: 'v1.19.0' },
    ]);
    expect(config.epochs.map((e) => e.version)).toEqual(['v1.0.0', 'v1.11.0', 'v1.18.0', 'v1.20.0']);
    expect(config.docker).toBe('elboletaire/manga-downloader');
  });

  it('sorts epochs by version', () => {
    const config = parseConfig(
      'epochs:\n  - { version: v1.20.0 }\n  - { version: v1.9.0, label: Early }\n  - { version: v1.11.0 }\n',
    );
    expect(config.epochs.map((e) => e.version)).toEqual(['v1.9.0', 'v1.11.0', 'v1.20.0']);
    expect(config.epochs[0]?.label).toBe('Early');
    expect(config.epochs[1]?.label).toBe('v1.11.0');
  });

  it.each([
    ['not a mapping', '- a\n- b\n', 'the file must be a mapping'],
    ['an unknown top-level key', 'grups: []\n', "top level.grups is not a known key"],
    ['an unknown group key', 'groups:\n  - { name: a, assets: "*", lable: x }\n', 'groups[0].lable is not a known key'],
    ['a group without assets', 'groups:\n  - { name: a }\n', 'groups[0].assets must be a non-empty string'],
    ['a reserved group name', 'groups:\n  - { name: other, assets: "*" }\n', "groups[0].name 'other' is reserved"],
    ['a group name with a space', 'groups:\n  - { name: a b, assets: "*" }\n', 'groups[0].name may only use'],
    ['a duplicate group', 'groups:\n  - { name: a, assets: "x" }\n  - { name: a, assets: "y" }\n', "group 'a' is listed twice"],
    ['an epoch that is not semver', 'epochs:\n  - { version: v1.11 }\n', 'epochs[0].version must be a quoted semver version'],
    ['an epoch version YAML reads as a number', 'epochs:\n  - { version: 1.11 }\n', 'epochs[0].version must be a quoted semver version'],
    ['a counter from that is not semver', 'counters:\n  - { name: u, assets: "*", from: latest }\n', 'counters[0].from must be a quoted semver version'],
    ['a docker value without a namespace', 'docker: manga-downloader\n', "docker must be 'namespace/name'"],
    ['invalid YAML', 'groups: [\n', 'config: not valid YAML'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(ConfigError);
    expect(() => parseConfig(text)).toThrow(message);
  });
});

describe('loadConfig', () => {
  it('gives the defaults when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-config-'));
    expect(await loadConfig(join(dir, 'missing.yml'))).toEqual(DEFAULT_CONFIG);
  });

  it('reads and validates the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-config-'));
    const path = join(dir, 'stats.yml');
    await writeFile(path, 'docker: a/b\n');
    expect((await loadConfig(path)).docker).toBe('a/b');
  });
});

describe('loadConfigFile', () => {
  it('gives the defaults, with no file, when the default path is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-config-'));
    expect(await loadConfigFile(join(dir, 'missing.yml'), { explicit: false })).toEqual({ config: DEFAULT_CONFIG, file: null });
  });

  it('fails when a path the user named is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-config-'));
    const path = join(dir, 'missing.yml');
    await expect(loadConfigFile(path, { explicit: true })).rejects.toThrow(`config file not found: ${path}`);
  });

  it('names the file it read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-config-'));
    const path = join(dir, 'stats.yml');
    await writeFile(path, 'docker: a/b\n');
    const loaded = await loadConfigFile(path, { explicit: true });
    expect(loaded.file).toBe(path);
    expect(loaded.config.docker).toBe('a/b');
  });
});
