import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_CONFIG, loadConfig, loadConfigFile, parseConfig } from '../src/config';

const FIXTURE = new URL('../../../fixtures/manga-downloader.stats.yml', import.meta.url);
const EXAMPLE = new URL('../../../examples/stats.yml', import.meta.url);

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

describe('the example config', () => {
  it('loads and keeps the more specific group first', async () => {
    const config = await loadConfig(EXAMPLE.pathname);
    expect(config.groups.map((g) => g.name)).toEqual(['desktop', 'cli']);
    expect(config.counters.map((c) => c.name)).toEqual(['updates']);
    expect(config.epochs.map((e) => e.version)).toEqual(['v1.0.0', 'v2.0.0']);
    expect(config.docker).toBe('acme/acme');
  });
});

describe('charts', () => {
  it('defaults to every title shown', () => {
    expect(parseConfig('').charts).toEqual({
      titles: true,
      stars: {},
      'downloads-per-day': {},
      'downloads-per-release': {},
      'npm-downloads': {},
    });
  });

  it('reads the global titles switch and a title per chart', () => {
    const config = parseConfig(`
charts:
  titles: false
  stars: { title: true }
  downloads-per-day: { title: false }
`);
    expect(config.charts).toEqual({
      titles: false,
      stars: { title: true },
      'downloads-per-day': { title: false },
      'downloads-per-release': {},
      'npm-downloads': {},
    });
  });

  it('rejects the spacing option, which the stars chart no longer has', () => {
    expect(() => parseConfig('charts: { stars: { spacing: even } }')).toThrow('charts.stars.spacing is not a known key');
  });

  it('rejects a title that is not true or false', () => {
    expect(() => parseConfig('charts: { titles: "no" }')).toThrow('charts.titles must be true or false');
    expect(() => parseConfig('charts: { downloads-per-release: { title: 0 } }')).toThrow('charts.downloads-per-release.title must be true or false');
  });

  it('rejects a null title', () => {
    expect(() => parseConfig('charts: { stars: { title: null } }')).toThrow('charts.stars.title must be true or false');
  });

  it('rejects unknown chart keys', () => {
    expect(() => parseConfig('charts: { pie: {} }')).toThrow('charts.pie is not a known key');
    expect(() => parseConfig('charts: { stars: { colour: red } }')).toThrow('charts.stars.colour is not a known key');
  });
});

describe('npm', () => {
  it('is absent when not configured, so no npm work runs', () => {
    expect(parseConfig('').npm).toBeUndefined();
  });

  it('accepts names as strings or objects, labels defaulting to the name', () => {
    const config = parseConfig(`
npm:
  - password-strength-meter
  - { package: "@passcore/core", label: Core }
`);
    expect(config.npm).toEqual([
      { package: 'password-strength-meter', label: 'password-strength-meter' },
      { package: '@passcore/core', label: 'Core' },
    ]);
  });

  it('reads an empty list as no packages', () => {
    expect(parseConfig('npm: []\n').npm).toEqual([]);
  });

  it('reads the npm-downloads chart title', () => {
    expect(parseConfig('charts:\n  npm-downloads: { title: false }\n').charts['npm-downloads']).toEqual({ title: false });
  });

  it.each([
    ['a name with a space', 'npm: [a b]\n', "npm[0].package 'a b' is not an npm package name"],
    ['an uppercase-free name over 214 characters', `npm: [${'a'.repeat(215)}]\n`, 'npm[0].package'],
    ['the name the combined badge uses', 'npm: [downloads]\n', 'clashes with the combined npm badge'],
    ['two packages with one file name', 'npm: [a--b, "@a/b"]\n', "npm package 'a--b' is listed twice"],
    ['more packages than colours', `npm: [${Array.from({ length: 9 }, (_, i) => `p${i}`).join(', ')}]\n`, 'npm lists 9 packages; at most 8'],
    ['an unknown key', 'npm:\n  - { package: a, lable: x }\n', 'npm[0].lable is not a known key'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });
});

describe('releases', () => {
  it('is on by default, and a boolean switches it off', () => {
    expect(parseConfig('').releases).toBe(true);
    expect(parseConfig('releases: false\n').releases).toBe(false);
  });

  it('rejects a value that is not a boolean', () => {
    expect(() => parseConfig('releases: "no"\n')).toThrow('top level.releases must be true or false');
  });
});

describe('chart windows', () => {
  it('reads from as a year, a month or a day, each as the first day of its span', () => {
    expect(parseConfig('charts: { stars: { from: 2024-01-01 } }').charts.stars).toEqual({ from: '2024-01-01' });
    expect(parseConfig('charts: { stars: { from: "2024-06" } }').charts.stars).toEqual({ from: '2024-06-01' });
    expect(parseConfig('charts: { stars: { from: 2024 } }').charts.stars).toEqual({ from: '2024-01-01' });
    expect(parseConfig('charts: { stars: { from: "2024" } }').charts.stars).toEqual({ from: '2024-01-01' });
  });

  it('reads a range as a count of days, months or years', () => {
    expect(parseConfig('charts: { downloads-per-day: { range: 90d } }').charts['downloads-per-day']).toEqual({ range: '90d' });
    expect(parseConfig("charts: { npm-downloads: { range: 1y } }").charts['npm-downloads']).toEqual({ range: '1y' });
  });

  it('reads last for downloads per release only', () => {
    expect(parseConfig('charts: { downloads-per-release: { last: 20 } }').charts['downloads-per-release']).toEqual({ last: 20 });
  });

  it('reads from as unquoted or quoted text', () => {
    expect(parseConfig('charts:\n  downloads-per-day: { from: 2024 }\n').charts['downloads-per-day']).toEqual({ from: '2024-01-01' });
    expect(parseConfig('charts:\n  downloads-per-day: { from: "2024" }\n').charts['downloads-per-day']).toEqual({ from: '2024-01-01' });
  });

  it('keeps the window out of the config when none is set', () => {
    expect(parseConfig('charts: { stars: { title: false } }').charts.stars).toEqual({ title: false });
  });

  it.each([
    ['a day that is not a date', 'charts: { stars: { from: 2024-02-30 } }', 'charts.stars.from must be a date'],
    ['a text that is not a date', 'charts: { stars: { from: "last year" } }', 'charts.stars.from must be a date'],
    ['a month out of range', 'charts: { stars: { from: 2024-13 } }', 'charts.stars.from must be a date'],
    ['a range without a unit', 'charts: { stars: { range: 90 } }', 'charts.stars.range must be a length such as 30d, 6m or 1y'],
    ['a range in weeks', 'charts: { stars: { range: 2w } }', 'charts.stars.range must be a length'],
    ['a zero range', 'charts: { stars: { range: 0d } }', 'charts.stars.range must be a length'],
    ['from and range together', 'charts: { stars: { from: 2024, range: 1y } }', "charts.stars: from and range can't both be set"],
    ['last on a chart other than releases', 'charts: { stars: { last: 5 } }', 'charts.stars.last is only for downloads-per-release'],
    ['last with from', 'charts: { downloads-per-release: { last: 5, from: 2024 } }', "charts.downloads-per-release: last can't be combined with from or range"],
    ['last of zero', 'charts: { downloads-per-release: { last: 0 } }', 'charts.downloads-per-release.last must be a whole number above zero'],
    ['last that is not whole', 'charts: { downloads-per-release: { last: 2.5 } }', 'charts.downloads-per-release.last must be a whole number above zero'],
    ['a camelCase chart key', 'charts:\n  downloadsPerDay: { from: 2026 }\n', 'charts.downloadsPerDay is not a known key'],
    ['the old npmDownloads key', 'charts: { npmDownloads: {} }\n', 'charts.npmDownloads is not a known key'],
    ['an unknown key next to the window', 'charts: { stars: { from: 2024, every: 2 } }', 'charts.stars.every is not a known key'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });
});
