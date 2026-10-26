import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ConfigError, DEFAULT_CONFIG, animates, loadConfig, loadConfigFile, parseConfig, type ChartName } from '../src/config';

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
    ['a group named after a period', 'groups:\n  - { name: foo-week, assets: "*" }\n', 'ends in a badge period'],
    ['a group named month', 'groups:\n  - { name: month, assets: "*" }\n', 'ends in a badge period'],
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
      'cloudflare-users': {},
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
      'cloudflare-users': {},
    });
  });

  it('reads the global animate switch and an animate per chart', () => {
    const config = parseConfig(`
charts:
  animate: false
  stars: { animate: true }
`);
    expect(config.charts).toEqual({
      titles: true,
      animate: false,
      stars: { animate: true },
      'downloads-per-day': {},
      'downloads-per-release': {},
      'npm-downloads': {},
      'cloudflare-users': {},
    });
  });

  it('leaves animate unset by default, so the helper supplies true', () => {
    expect(parseConfig('').charts).not.toHaveProperty('animate');
  });

  it('rejects an animate that is not true or false', () => {
    expect(() => parseConfig('charts: { animate: "no" }')).toThrow('charts.animate must be true or false');
    expect(() => parseConfig('charts: { stars: { animate: 0 } }')).toThrow('charts.stars.animate must be true or false');
  });

  it('gives animates() the chart override, then the global switch, then true', () => {
    const charts = parseConfig(`
charts:
  animate: false
  stars: { animate: true }
`).charts;
    expect(animates(charts, 'stars')).toBe(true);
    expect(animates(charts, 'downloads-per-day')).toBe(false);
    expect(animates(parseConfig('').charts, 'stars')).toBe(true);
    expect(animates(undefined, 'stars')).toBe(true);
  });

  it('applies only the global switch when no chart is named', () => {
    const charts = parseConfig('charts: { animate: false, stars: { animate: true } }').charts;
    expect(animates(charts)).toBe(false);
    expect(animates(parseConfig('charts: { stars: { animate: false } }').charts)).toBe(true);
    expect(animates(undefined)).toBe(true);
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

  it('reads the stars height and start-at-zero, and leaves both out by default', () => {
    expect(parseConfig('charts: { stars: { height: 400, start-at-zero: true } }').charts.stars).toEqual({ height: 400, startAtZero: true });
    expect(parseConfig('charts: { stars: { height: 200 } }').charts.stars).toEqual({ height: 200 });
    expect(parseConfig('charts: { stars: { height: 600 } }').charts.stars).toEqual({ height: 600 });
    expect(parseConfig('charts: { stars: { start-at-zero: false } }').charts.stars).toEqual({ startAtZero: false });
    expect(parseConfig('').charts.stars).not.toHaveProperty('height');
    expect(parseConfig('').charts.stars).not.toHaveProperty('startAtZero');
  });

  it.each([
    ['a height below 200', 'charts: { stars: { height: 199 } }', 'charts.stars.height must be a whole number from 200 to 600'],
    ['a height above 600', 'charts: { stars: { height: 601 } }', 'charts.stars.height must be a whole number from 200 to 600'],
    ['a height that is not whole', 'charts: { stars: { height: 300.5 } }', 'charts.stars.height must be a whole number from 200 to 600'],
    ['a height in text', 'charts: { stars: { height: "tall" } }', 'charts.stars.height must be a whole number from 200 to 600'],
    ['a height on another chart', 'charts: { downloads-per-day: { height: 300 } }', 'charts.downloads-per-day.height is only for stars'],
    ['start-at-zero on another chart', 'charts: { npm-downloads: { start-at-zero: true } }', 'charts.npm-downloads.start-at-zero is only for stars'],
    ['a start-at-zero that is not true or false', 'charts: { stars: { start-at-zero: "yes" } }', 'charts.stars.start-at-zero must be true or false'],
    ['a camelCase startAtZero key', 'charts: { stars: { startAtZero: true } }', 'charts.stars.startAtZero is not a known key'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });
});

describe('stars colour', () => {
  it('fills both modes from one string, lowercased', () => {
    expect(parseConfig('charts: { stars: { color: "#E3B341" } }').charts.stars).toEqual({ color: { light: '#e3b341', dark: '#e3b341' } });
  });

  it('reads a light and a dark colour as an object', () => {
    expect(parseConfig('charts: { stars: { color: { light: "#9a6700", dark: "#E3B341" } } }').charts.stars).toEqual({
      color: { light: '#9a6700', dark: '#e3b341' },
    });
  });

  it('accepts the short hex form', () => {
    expect(parseConfig('charts: { stars: { color: "#fa0" } }').charts.stars).toEqual({ color: { light: '#fa0', dark: '#fa0' } });
  });

  it('leaves the colour out when none is set', () => {
    expect(parseConfig('charts: { stars: { title: false } }').charts.stars).not.toHaveProperty('color');
  });

  it('hints at quoting when the hex is unquoted, which YAML reads as a comment', () => {
    expect(() => parseConfig('charts:\n  stars:\n    color: #e3b341\n')).toThrow(
      'charts.stars.color must be a hex colour such as "#e3b341" (quote it: a bare # starts a YAML comment)',
    );
  });

  it.each([
    ['a colour name', 'charts: { stars: { color: red } }', 'charts.stars.color must be a hex colour such as #e3b341'],
    ['a hex without the hash', 'charts: { stars: { color: "e3b341" } }', 'charts.stars.color must be a hex colour'],
    ['a hex of the wrong length', 'charts: { stars: { color: "#e3b34" } }', 'charts.stars.color must be a hex colour'],
    ['a value with markup in it', 'charts: { stars: { color: "#e3b341<b>" } }', 'charts.stars.color must be a hex colour'],
    ['a number', 'charts: { stars: { color: 123456 } }', 'charts.stars.color must be a hex colour'],
    ['a dark colour that is not hex', 'charts: { stars: { color: { light: "#9a6700", dark: navy } } }', 'charts.stars.color.dark must be a hex colour such as #e3b341'],
    ['a light colour that is not hex', 'charts: { stars: { color: { light: "blue", dark: "#e3b341" } } }', 'charts.stars.color.light must be a hex colour such as #e3b341'],
    ['a missing dark colour', 'charts: { stars: { color: { light: "#9a6700" } } }', 'charts.stars.color.dark must be a hex colour such as #e3b341'],
    ['a missing light colour', 'charts: { stars: { color: { dark: "#e3b341" } } }', 'charts.stars.color.light must be a hex colour such as #e3b341'],
    ['an extra key next to light and dark', 'charts: { stars: { color: { light: "#9a6700", dark: "#e3b341", mid: "#000" } } }', 'charts.stars.color.mid is not a known key'],
    ['a colour on a chart other than stars', 'charts: { downloads-per-day: { color: "#e3b341" } }', 'charts.downloads-per-day.color is only for stars'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });
});

describe('badge colours', () => {
  it('is absent when not configured, so the defaults apply', () => {
    expect(parseConfig('').badges).toBeUndefined();
  });

  it('keeps a six-digit colour lowercase, without the hash', () => {
    expect(parseConfig('badges:\n  downloads: { color: "#4CB70E" }\n').badges).toEqual({ downloads: { color: '4cb70e' } });
  });

  it('expands #rgb to six digits', () => {
    expect(parseConfig('badges:\n  stars: { color: "#FA0" }\n').badges).toEqual({ stars: { color: 'ffaa00' } });
  });

  it('takes any badge name, since the names come from the data', () => {
    expect(parseConfig('badges:\n  counter-updates: { color: "#fff" }\n').badges).toEqual({ 'counter-updates': { color: 'ffffff' } });
  });

  it.each([
    ['a colour name', 'badges: { downloads: { color: green } }', 'badges.downloads.color must be a hex colour such as #e3b341'],
    ['a bare hex that YAML reads as a comment', 'badges:\n  downloads:\n    color: #4cb70e\n', 'badges.downloads.color must be a hex colour'],
    ['a hex of the wrong length', 'badges: { downloads: { color: "#4cb70" } }', 'badges.downloads.color must be a hex colour'],
    ['a light and dark pair', 'badges: { downloads: { color: { light: "#9a6700", dark: "#e3b341" } } }', 'badges.downloads.color must be a hex colour'],
    ['a missing colour', 'badges: { downloads: {} }', 'badges.downloads.color must be a hex colour'],
    ['an entry that is not a mapping', 'badges: { downloads: "#4cb70e" }', 'badges.downloads must be a mapping'],
    ['an unknown key in an entry', 'badges: { downloads: { color: "#4cb70e", label: x } }', 'badges.downloads.label is not a known key'],
    ['a badges list', 'badges: [ "#4cb70e" ]', 'badges must be a mapping'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(ConfigError);
    expect(() => parseConfig(text)).toThrow(message);
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
    ['a name that takes the week or total badge', 'npm: [downloads-total]\n', 'clashes with the combined npm badge'],
    ['a name ending in -week', 'npm: [a-week]\n', 'ends in -week'],
    ['two packages with one file name', 'npm: [a--b, "@a/b"]\n', "npm package 'a--b' is listed twice"],
    ['more packages than colours', `npm: [${Array.from({ length: 9 }, (_, i) => `p${i}`).join(', ')}]\n`, 'npm lists 9 packages; at most 8'],
    ['an unknown key', 'npm:\n  - { package: a, lable: x }\n', 'npm[0].lable is not a known key'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });
});

describe('cloudflare', () => {
  const ACCOUNT = '0123456789abcdef0123456789abcdef';

  it('is absent when not configured, so no Cloudflare work runs', () => {
    expect(parseConfig('').cloudflare).toBeUndefined();
  });

  it('reads a full block, with the per-user counter it feeds', () => {
    const config = parseConfig(`
cloudflare:
  account-id: ${ACCOUNT}
  dataset: manga_downloader_checks
  label: Update checks
  users: index1
  day: blob5
  primary: { client: gui }
  note: The CLI only checks on --version.
  dimensions:
    client:  { column: blob1, label: App vs CLI }
    version: { column: blob2, label: Version, kind: semver, released: true }
    os:      { column: blob3, label: OS }
counters:
  - { name: updates, label: In-app updates, assets: "*-SHA256SUMS.txt", from: v1.19.0, per-user: true }
`);
    expect(config.cloudflare).toEqual({
      accountId: ACCOUNT,
      dataset: 'manga_downloader_checks',
      label: 'Update checks',
      users: 'index1',
      day: 'blob5',
      primary: { dimension: 'client', value: 'gui' },
      note: 'The CLI only checks on --version.',
      dimensions: [
        { name: 'client', label: 'App vs CLI', column: 'blob1' },
        { name: 'version', label: 'Version', column: 'blob2', kind: 'semver', released: true },
        { name: 'os', label: 'OS', column: 'blob3' },
      ],
    });
    expect(config.counters[0]).toMatchObject({ name: 'updates', from: 'v1.19.0', perUser: true });
  });

  it("reads the display labels of a dimension's values", () => {
    const config = parseConfig(`
cloudflare:
  account-id: ${ACCOUNT}
  dataset: d
  dimensions:
    client: { column: blob1, label: App vs CLI, values: { gui: App, cli: CLI } }
`);
    expect(config.cloudflare!.dimensions).toEqual([
      { name: 'client', label: 'App vs CLI', column: 'blob1', values: { gui: 'App', cli: 'CLI' } },
    ]);
  });

  it('parses without an account-id, which the cloudflare-account-id input or CLOUDFLARE_ACCOUNT_ID can supply', () => {
    expect(parseConfig('cloudflare: { dataset: checks }\n').cloudflare).toEqual({
      dataset: 'checks',
      label: 'checks',
      users: 'index1',
      dimensions: [],
    });
  });

  it('defaults the label to the dataset, the users to index1 and the dimensions to none', () => {
    const config = parseConfig(`cloudflare: { account-id: ${ACCOUNT}, dataset: checks }\n`);
    expect(config.cloudflare).toEqual({ accountId: ACCOUNT, dataset: 'checks', label: 'checks', users: 'index1', dimensions: [] });
  });

  it.each([
    ['an account id that is not hex', 'cloudflare: { account-id: xyz, dataset: d }\n', 'cloudflare.account-id must be 32 lowercase hex digits'],
    ['a dataset name with a dash', `cloudflare: { account-id: ${ACCOUNT}, dataset: a-b }\n`, 'cloudflare.dataset may only use letters, digits and _'],
    ['users other than index1', `cloudflare: { account-id: ${ACCOUNT}, dataset: d, users: blob1 }\n`, 'cloudflare.users must be index1'],
    ['an unknown key', `cloudflare: { account-id: ${ACCOUNT}, dataset: d, lable: x }\n`, 'cloudflare.lable is not a known key'],
    ['a day that is not a blob', `cloudflare: { account-id: ${ACCOUNT}, dataset: d, day: blob21 }\n`, 'cloudflare.day must be blob1 to blob20'],
    ['a dimension column that is not a blob', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    os: { column: index1 }\n`, 'cloudflare.dimensions.os.column must be blob1 to blob20'],
    ['a dimension name that is not kebab-case', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    OS: { column: blob3 }\n`, 'cloudflare.dimensions.OS: dimension names are lowercase words joined by -'],
    ['a column used twice', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  day: blob1\n  dimensions:\n    os: { column: blob3 }\n    arch: { column: blob3 }\n`, "cloudflare column 'blob3' is listed twice"],
    ['a day column that is also a dimension column', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  day: blob1\n  dimensions:\n    os: { column: blob1 }\n`, "cloudflare column 'blob1' is listed twice"],
    ['a value label that is not a string', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    client: { column: blob1, values: { gui: 1 } }\n`, 'cloudflare.dimensions.client.values.gui must be a non-empty string'],
    ['an empty value label', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    client: { column: blob1, values: { gui: "" } }\n`, 'cloudflare.dimensions.client.values.gui must be a non-empty string'],
    ['an empty value name', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    client: { column: blob1, values: { "": App } }\n`, 'cloudflare.dimensions.client.values: value names must be non-empty'],
    ['a kind other than semver', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    os: { column: blob3, kind: date }\n`, 'cloudflare.dimensions.os.kind must be semver'],
    ['released on a dimension that is not semver', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    os: { column: blob3, released: true }\n`, 'cloudflare.dimensions.os.released needs kind: semver'],
    ['two released dimensions', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    a: { column: blob1, kind: semver, released: true }\n    b: { column: blob2, kind: semver, released: true }\n`, 'cloudflare: only one dimension may be released'],
    ['a primary that is not a dimension', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  primary: { client: gui }\n`, 'cloudflare.primary.client is not a dimension'],
    ['a primary with two keys', `cloudflare:\n  account-id: ${ACCOUNT}\n  dataset: d\n  dimensions:\n    client: { column: blob1 }\n  primary: { client: gui, os: linux }\n`, 'cloudflare.primary must name one dimension and its value'],
    ['per-user without a cloudflare source', 'counters:\n  - { name: u, assets: "*", per-user: true }\n', 'counters[0].per-user needs a cloudflare source'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(ConfigError);
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

  it('reads the window of cloudflare-users, and rejects last and height', () => {
    expect(parseConfig('charts: { cloudflare-users: { from: "2026-06", title: false } }').charts['cloudflare-users']).toEqual({
      from: '2026-06-01',
      title: false,
    });
    expect(parseConfig("charts: { cloudflare-users: { range: 6m } }").charts['cloudflare-users']).toEqual({ range: '6m' });
    expect(() => parseConfig('charts: { cloudflare-users: { last: 3 } }')).toThrow('charts.cloudflare-users.last is only for downloads-per-release');
    expect(() => parseConfig('charts: { cloudflare-users: { height: 300 } }')).toThrow('charts.cloudflare-users.height is only for stars');
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

describe('chart variants', () => {
  it('reads a variant of each chart as its own options, in config order', () => {
    const config = parseConfig(`
charts:
  stars: { from: 2024-01-01, title: false, height: 400, start-at-zero: true }
  stars@full: { title: false, height: 400 }
  downloads-per-day: { range: 90d }
  downloads-per-day@year: { range: 1y }
  downloads-per-release@recent: { last: 5 }
  npm-downloads@year: { range: 1y }
`);
    expect(config.charts.variants).toEqual([
      { chart: 'stars', name: 'full', options: { title: false, height: 400 } },
      { chart: 'downloads-per-day', name: 'year', options: { range: '1y' } },
      { chart: 'downloads-per-release', name: 'recent', options: { last: 5 } },
      { chart: 'npm-downloads', name: 'year', options: { range: '1y' } },
    ]);
  });

  it('keeps the base charts as they are, and leaves variants out when none are set', () => {
    const config = parseConfig('charts: { stars: { height: 400 }, stars@full: { title: false } }');
    expect(config.charts.stars).toEqual({ height: 400 });
    expect(parseConfig('charts: { stars: {} }').charts).not.toHaveProperty('variants');
  });

  it('applies each base chart\'s rules to its variants', () => {
    expect(() => parseConfig('charts: { stars@x: { last: 5 } }')).toThrow('charts.stars@x.last is only for downloads-per-release');
    expect(() => parseConfig('charts: { downloads-per-day@x: { height: 300 } }')).toThrow('charts.downloads-per-day@x.height is only for stars');
    expect(() => parseConfig('charts: { npm-downloads@x: { color: "#fff" } }')).toThrow('charts.npm-downloads@x.color is only for stars');
    expect(() => parseConfig('charts: { downloads-per-release@x: { from: 2024, range: 1y } }')).toThrow("charts.downloads-per-release@x: from and range can't both be set");
    expect(() => parseConfig('charts: { stars@x: { every: 2 } }')).toThrow('charts.stars@x.every is not a known key');
  });

  it.each([
    ['an unknown base chart', 'charts: { foo@bar: {} }', 'charts.foo@bar: unknown chart "foo"'],
    ['a second @ in the key', 'charts: { stars@a@b: {} }', 'charts.stars@a@b: variant names are lowercase words joined by -'],
    ['a name with a capital', 'charts: { stars@Full: {} }', 'charts.stars@Full: variant names are lowercase words joined by -'],
    ['a name with an underscore', 'charts: { stars@full_size: {} }', 'charts.stars@full_size: variant names are lowercase words joined by -'],
    ['a name with a double dash', 'charts: { stars@full--size: {} }', 'charts.stars@full--size: variant names are lowercase words joined by -'],
    ['an empty name', 'charts: { stars@: {} }', 'charts.stars@: variant names are lowercase words joined by -'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });

  it('leaves ChartName to the five base charts', () => {
    expectTypeOf<ChartName>().toEqualTypeOf<'stars' | 'downloads-per-day' | 'downloads-per-release' | 'npm-downloads' | 'cloudflare-users'>();
  });
});
