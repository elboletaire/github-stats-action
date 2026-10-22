// The stats config (.github/stats.yml): parsed and validated once, with a clear error
// on the first problem. A missing file means the defaults.

import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { NPM_NAME_MAX, NPM_NAME_RE, npmSlug } from './npm';
import { compareVersions, parseVersion } from './semver';
import { RANGE_RE } from './window';

export interface GroupRule {
  name: string;
  label: string;
  /** Glob on the asset name. */
  assets: string;
}

export interface CounterRule {
  name: string;
  label: string;
  assets: string;
  /** Semver; releases before it aren't counted. */
  from?: string;
}

export interface EpochRule {
  version: string;
  label: string;
}

export interface PlatformRule {
  /** Glob on the asset name. */
  match: string;
  label: string;
}

export interface NpmRule {
  /** npm package name, `name` or `@scope/name`. */
  package: string;
  label: string;
}

/** Options of one README chart; `title` overrides `charts.titles` for that chart. */
export interface ChartConfig {
  title?: boolean;
  /** Animates the chart once on load; overrides `charts.animate` for this chart. */
  animate?: boolean;
  /** The window's first day, YYYY-MM-DD. Exclusive with `range` and `last`. */
  from?: string;
  /** The window's length counted back from the latest day: `30d`, `6m` or `1y`. */
  range?: string;
  /** Downloads per release only: the last N releases. */
  last?: number;
}

export interface ChartsConfig {
  /** Shows the visible title of the README charts; the dashboard keeps its headings. */
  titles: boolean;
  /** Animates every chart once on load, on the README SVGs and the dashboard's first draw; default true. */
  animate?: boolean;
  stars: ChartConfig;
  'downloads-per-day': ChartConfig;
  'downloads-per-release': ChartConfig;
  'npm-downloads': ChartConfig;
}

/** The charts the README SVGs are made of, by config key (the file name is the key). */
export type ChartName = Exclude<keyof ChartsConfig, 'titles' | 'animate'>;

export interface StatsConfig {
  /** Shows release downloads in every output; false hides them even when the assets have counts. */
  releases: boolean;
  groups: GroupRule[];
  ignore: string[];
  counters: CounterRule[];
  epochs: EpochRule[];
  platforms: PlatformRule[];
  charts: ChartsConfig;
  /** Docker Hub image, `namespace/name`. */
  docker?: string;
  /** npm packages to count daily; absent means no npm work at all. */
  npm?: NpmRule[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(`config: ${message}`);
    this.name = 'ConfigError';
  }
}

export const DEFAULT_CONFIG: StatsConfig = {
  releases: true,
  groups: [{ name: 'downloads', label: 'Downloads', assets: '*' }],
  ignore: [],
  counters: [],
  epochs: [],
  platforms: [],
  charts: { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {} },
};

/** One colour per package in the npm chart and the dashboard, so the list is capped at the palette's slots. */
const NPM_MAX_PACKAGES = 8;

/** Names the dataset uses for its own buckets, so a group can't take them. */
const RESERVED_GROUPS = new Set(['other', 'ignored']);
const NAME_RE = /^[A-Za-z0-9_-]+$/;
const DOCKER_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectObject(value: unknown, path: string): Obj {
  if (!isObject(value)) throw new ConfigError(`${path} must be a mapping`);
  return value;
}

function expectList(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ConfigError(`${path} must be a list`);
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(`${path} must be a non-empty string`);
  }
  return value;
}

function optionalString(obj: Obj, key: string, path: string): string | undefined {
  return obj[key] === undefined ? undefined : expectString(obj[key], `${path}.${key}`);
}

function checkKeys(obj: Obj, allowed: string[], path: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new ConfigError(`${path}.${key} is not a known key`);
  }
}

function checkName(name: string, path: string): void {
  if (!NAME_RE.test(name)) throw new ConfigError(`${path} may only use letters, digits, '-' and '_'`);
}

/** YAML reads `1.11` as a number, so a version has to be quoted to be read as one. */
function expectVersion(value: unknown, path: string): string {
  if (typeof value !== 'string' || !parseVersion(value)) {
    throw new ConfigError(`${path} must be a quoted semver version, e.g. "v1.11.0"`);
  }
  return value;
}

function unique(names: string[], what: string): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new ConfigError(`${what} '${name}' is listed twice`);
    seen.add(name);
  }
}

function parseGroups(value: unknown): GroupRule[] {
  const groups = expectList(value, 'groups').map((item, i) => {
    const path = `groups[${i}]`;
    const obj = expectObject(item, path);
    checkKeys(obj, ['name', 'label', 'assets'], path);
    const name = expectString(obj.name, `${path}.name`);
    checkName(name, `${path}.name`);
    if (RESERVED_GROUPS.has(name)) throw new ConfigError(`${path}.name '${name}' is reserved`);
    // a group named `foo-week` would take the period badge of group `foo`
    if (/(^|[-_])(week|month)$/i.test(name)) throw new ConfigError(`${path}.name '${name}' ends in a badge period`);
    return {
      name,
      label: optionalString(obj, 'label', path) ?? name,
      assets: expectString(obj.assets, `${path}.assets`),
    };
  });
  unique(groups.map((g) => g.name), 'group');
  return groups;
}

function parseIgnore(value: unknown): string[] {
  return expectList(value, 'ignore').map((item, i) => expectString(item, `ignore[${i}]`));
}

function parseCounters(value: unknown): CounterRule[] {
  const counters = expectList(value, 'counters').map((item, i) => {
    const path = `counters[${i}]`;
    const obj = expectObject(item, path);
    checkKeys(obj, ['name', 'label', 'assets', 'from'], path);
    const name = expectString(obj.name, `${path}.name`);
    checkName(name, `${path}.name`);
    const from = obj.from === undefined ? undefined : expectVersion(obj.from, `${path}.from`);
    return {
      name,
      label: optionalString(obj, 'label', path) ?? name,
      assets: expectString(obj.assets, `${path}.assets`),
      ...(from !== undefined ? { from } : {}),
    };
  });
  unique(counters.map((c) => c.name), 'counter');
  return counters;
}

function parseEpochs(value: unknown): EpochRule[] {
  const epochs = expectList(value, 'epochs').map((item, i) => {
    const path = `epochs[${i}]`;
    const obj = expectObject(item, path);
    checkKeys(obj, ['version', 'label'], path);
    const version = expectVersion(obj.version, `${path}.version`);
    return { version, label: optionalString(obj, 'label', path) ?? version };
  });
  unique(epochs.map((e) => e.version), 'epoch');
  return epochs.sort((a, b) => compareVersions(parseVersion(a.version)!, parseVersion(b.version)!));
}

function optionalBoolean(obj: Obj, key: string, path: string): boolean | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ConfigError(`${path}.${key} must be true or false`);
  return value;
}

/** The date a `from` names: `2024-06-01`, `2024-06` or `2024`, read as the first day of that span. */
function parseFrom(value: unknown, path: string): string {
  // YAML reads an unquoted 2024 as a number
  const text = typeof value === 'number' && Number.isInteger(value) ? String(value) : value;
  const match = typeof text === 'string' ? /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text) : null;
  if (match) {
    const [, year, month = '01', day = '01'] = match;
    const date = `${year}-${month}-${day}`;
    // Date rolls 2024-02-30 over to March, so the date must read back unchanged
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)) return date;
  }
  throw new ConfigError(`${path} must be a date: 2024, 2024-06 or 2024-06-01`);
}

function parseRange(value: unknown, path: string): string {
  const match = typeof value === 'string' ? RANGE_RE.exec(value) : null;
  if (match && Number(match[1]) > 0) return value as string;
  throw new ConfigError(`${path} must be a length such as 30d, 6m or 1y`);
}

/** A chart's options: its title and animation, and the window it covers (`from` or `range`, or `last` for releases). */
function parseChart(sub: Obj, chart: ChartName, path: string): ChartConfig {
  const title = optionalBoolean(sub, 'title', path);
  const animate = optionalBoolean(sub, 'animate', path);
  const hasFrom = sub.from !== undefined;
  const hasRange = sub.range !== undefined;
  const hasLast = sub.last !== undefined;
  if (hasFrom && hasRange) throw new ConfigError(`${path}: from and range can't both be set`);
  if (hasLast && chart !== 'downloads-per-release') throw new ConfigError(`${path}.last is only for downloads-per-release`);
  if (hasLast && (hasFrom || hasRange)) throw new ConfigError(`${path}: last can't be combined with from or range`);
  if (hasLast && (!Number.isInteger(sub.last) || (sub.last as number) < 1)) {
    throw new ConfigError(`${path}.last must be a whole number above zero`);
  }
  return {
    ...(title === undefined ? {} : { title }),
    ...(animate === undefined ? {} : { animate }),
    ...(hasFrom ? { from: parseFrom(sub.from, `${path}.from`) } : {}),
    ...(hasRange ? { range: parseRange(sub.range, `${path}.range`) } : {}),
    ...(hasLast ? { last: sub.last as number } : {}),
  };
}

function parseCharts(value: unknown): ChartsConfig {
  const obj = expectObject(value, 'charts');
  checkKeys(obj, ['titles', 'animate', 'stars', 'downloads-per-day', 'downloads-per-release', 'npm-downloads'], 'charts');
  const section = (chart: ChartName): ChartConfig => {
    const sub = obj[chart] === undefined ? {} : expectObject(obj[chart], `charts.${chart}`);
    checkKeys(sub, ['title', 'animate', 'from', 'range', 'last'], `charts.${chart}`);
    return parseChart(sub, chart, `charts.${chart}`);
  };
  const animate = optionalBoolean(obj, 'animate', 'charts');
  return {
    titles: optionalBoolean(obj, 'titles', 'charts') ?? true,
    ...(animate === undefined ? {} : { animate }),
    stars: section('stars'),
    'downloads-per-day': section('downloads-per-day'),
    'downloads-per-release': section('downloads-per-release'),
    'npm-downloads': section('npm-downloads'),
  };
}

function parsePlatforms(value: unknown): PlatformRule[] {
  return expectList(value, 'platforms').map((item, i) => {
    const path = `platforms[${i}]`;
    const obj = expectObject(item, path);
    checkKeys(obj, ['match', 'label'], path);
    return {
      match: expectString(obj.match, `${path}.match`),
      label: expectString(obj.label, `${path}.label`),
    };
  });
}

function parseNpm(value: unknown): NpmRule[] {
  const rules = expectList(value, 'npm').map((item, i) => {
    const path = `npm[${i}]`;
    const obj = typeof item === 'string' ? { package: item } : expectObject(item, path);
    checkKeys(obj, ['package', 'label'], path);
    const name = expectString(obj.package, `${path}.package`);
    if (name.length > NPM_NAME_MAX || !NPM_NAME_RE.test(name)) {
      throw new ConfigError(`${path}.package '${name}' is not an npm package name`);
    }
    const slug = npmSlug(name);
    // the combined npm badges take these names, and a name ending in -week is another package's week badge
    if (['downloads', 'downloads-week', 'downloads-total'].includes(slug)) {
      throw new ConfigError(`${path}.package '${name}' clashes with the combined npm badge (npm-${slug})`);
    }
    if (slug.endsWith('-week')) throw new ConfigError(`${path}.package '${name}' ends in -week, the week badge's suffix`);
    return { package: name, label: optionalString(obj, 'label', path) ?? name };
  });
  if (rules.length > NPM_MAX_PACKAGES) {
    throw new ConfigError(`npm lists ${rules.length} packages; at most ${NPM_MAX_PACKAGES}, one colour each`);
  }
  unique(rules.map((r) => npmSlug(r.package)), 'npm package');
  return rules;
}

/**
 * Whether a chart animates on load: its own `animate`, else the global one, else yes. Without a
 * chart name (the dashboard's sections with no README chart) only the global one applies.
 */
export function animates(charts: ChartsConfig | undefined, name?: ChartName): boolean {
  return (name ? charts?.[name]?.animate : undefined) ?? charts?.animate ?? true;
}

/** Parses and validates the YAML text; an empty document gives the defaults. */
export function parseConfig(text: string): StatsConfig {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (error) {
    throw new ConfigError(`not valid YAML: ${(error as Error).message}`);
  }
  if (doc === null || doc === undefined) return structuredClone(DEFAULT_CONFIG);
  const root = expectObject(doc, 'the file');
  checkKeys(root, ['releases', 'groups', 'ignore', 'counters', 'epochs', 'platforms', 'charts', 'docker', 'npm'], 'top level');

  const config: StatsConfig = {
    releases: optionalBoolean(root, 'releases', 'top level') ?? true,
    groups: root.groups === undefined ? structuredClone(DEFAULT_CONFIG.groups) : parseGroups(root.groups),
    ignore: root.ignore === undefined ? [] : parseIgnore(root.ignore),
    counters: root.counters === undefined ? [] : parseCounters(root.counters),
    epochs: root.epochs === undefined ? [] : parseEpochs(root.epochs),
    platforms: root.platforms === undefined ? [] : parsePlatforms(root.platforms),
    charts: root.charts === undefined ? structuredClone(DEFAULT_CONFIG.charts) : parseCharts(root.charts),
  };
  if (root.docker !== undefined) {
    const docker = expectString(root.docker, 'docker');
    if (!DOCKER_RE.test(docker)) throw new ConfigError(`docker must be 'namespace/name', got '${docker}'`);
    config.docker = docker;
  }
  if (root.npm !== undefined) config.npm = parseNpm(root.npm);
  return config;
}

/** Where the config is looked for when no path is given. */
export const DEFAULT_CONFIG_PATH = '.github/stats.yml';

export interface LoadedConfig {
  config: StatsConfig;
  /** The file read, or null when the default path was missing and the defaults are in use. */
  file: string | null;
}

// Reads the config file. Only the default path may be missing, silently giving the defaults;
// a path the user named must exist, so a typo can't quietly drop every group and ignore rule.
export async function loadConfigFile(path: string, options: { explicit: boolean }): Promise<LoadedConfig> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (options.explicit) throw new Error(`config file not found: ${path}`);
    return { config: parseConfig(''), file: null };
  }
  return { config: parseConfig(text), file: path };
}

/** Reads the config file; a missing file is not an error and gives the defaults. */
export async function loadConfig(path: string): Promise<StatsConfig> {
  return (await loadConfigFile(path, { explicit: false })).config;
}
