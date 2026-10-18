// The stats config (.github/stats.yml): parsed and validated once, with a clear error
// on the first problem. A missing file means the defaults.

import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { compareVersions, parseVersion } from './semver';

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

/** Options of one README chart; `title` overrides `charts.titles` for that chart. */
export interface ChartConfig {
  title?: boolean;
}

export interface ChartsConfig {
  /** Shows the visible title of the README charts; the dashboard keeps its headings. */
  titles: boolean;
  stars: ChartConfig;
  'downloads-per-day': ChartConfig;
  'downloads-per-release': ChartConfig;
}

/** The charts the README SVGs are made of, by file name. */
export type ChartName = Exclude<keyof ChartsConfig, 'titles'>;

export interface StatsConfig {
  groups: GroupRule[];
  ignore: string[];
  counters: CounterRule[];
  epochs: EpochRule[];
  platforms: PlatformRule[];
  charts: ChartsConfig;
  /** Docker Hub image, `namespace/name`. */
  docker?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(`config: ${message}`);
    this.name = 'ConfigError';
  }
}

export const DEFAULT_CONFIG: StatsConfig = {
  groups: [{ name: 'downloads', label: 'Downloads', assets: '*' }],
  ignore: [],
  counters: [],
  epochs: [],
  platforms: [],
  charts: { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {} },
};

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

function parseCharts(value: unknown): ChartsConfig {
  const obj = expectObject(value, 'charts');
  checkKeys(obj, ['titles', 'stars', 'downloads-per-day', 'downloads-per-release'], 'charts');
  const section = (name: string, keys: string[]): Obj => {
    const sub = obj[name] === undefined ? {} : expectObject(obj[name], `charts.${name}`);
    checkKeys(sub, keys, `charts.${name}`);
    return sub;
  };
  const stars = section('stars', ['title']);
  const perDay = section('downloads-per-day', ['title']);
  const perRelease = section('downloads-per-release', ['title']);
  return {
    titles: optionalBoolean(obj, 'titles', 'charts') ?? true,
    stars: chartOptions(optionalBoolean(stars, 'title', 'charts.stars')),
    'downloads-per-day': chartOptions(optionalBoolean(perDay, 'title', 'charts.downloads-per-day')),
    'downloads-per-release': chartOptions(optionalBoolean(perRelease, 'title', 'charts.downloads-per-release')),
  };
}

/** `{ title }` when the chart sets one, else nothing, so an unset title stays out of the config. */
function chartOptions(title: boolean | undefined): ChartConfig {
  return title === undefined ? {} : { title };
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
  checkKeys(root, ['groups', 'ignore', 'counters', 'epochs', 'platforms', 'charts', 'docker'], 'top level');

  const config: StatsConfig = {
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
