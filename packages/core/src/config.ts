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
  /** Also shown per daily user, from the `cloudflare` source. */
  perUser?: boolean;
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

export interface CloudflareDimensionRule {
  /** Name in the config and the stored `by` data. */
  name: string;
  label: string;
  /** The blob holding the value, `blob1` to `blob20`. */
  column: string;
  /** `semver`: the values are versions, ordered as such. */
  kind?: 'semver';
  /** Only the rows of published releases count; at most one dimension. */
  released?: boolean;
  /** Display labels by raw value; values without one show as they are. */
  values?: Record<string, string>;
}

/** An Analytics Engine dataset whose daily aggregates are kept on the data branch. */
export interface CloudflareRule {
  accountId: string;
  dataset: string;
  label: string;
  /** The point's index holding the daily user hash; only `index1` is accepted. */
  users: 'index1';
  /** The blob holding the UTC day; absent means the day of the point's timestamp. */
  day?: string;
  /** The dimension value whose users are the headline; absent counts every row. */
  primary?: { dimension: string; value: string };
  note?: string;
  dimensions: CloudflareDimensionRule[];
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
  /** Stars only: the chart's height in pixels, from 200 to 600; default 300. */
  height?: number;
  /** Stars only, with a window: the curve starts at zero, so its first segment takes in the stars from before the window. */
  startAtZero?: boolean;
  /** Stars only: the line, dots and area per mode; a plain string in the config fills both. */
  color?: { light: string; dark: string };
}

/** A named variant of a README chart, `<chart>@<name>` in the config: its own options, standalone. */
export interface ChartVariant {
  chart: ChartName;
  name: string;
  options: ChartConfig;
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
  /** Daily users from the Cloudflare source; the chart is left out without `cloudflare` days. */
  'cloudflare-users': ChartConfig;
  /** Named variants of the charts above, in config order; absent when none are set. */
  variants?: ChartVariant[];
}

/** The charts the README SVGs are made of, by config key (the file name is the key). */
export type ChartName = Exclude<keyof ChartsConfig, 'titles' | 'animate' | 'variants'>;

const CHART_NAMES: ChartName[] = ['stars', 'downloads-per-day', 'downloads-per-release', 'npm-downloads', 'cloudflare-users'];
/** The options a chart section takes; a variant takes the same ones. */
const CHART_KEYS = ['title', 'animate', 'from', 'range', 'last', 'height', 'start-at-zero', 'color'];
/** A variant's name: lowercase words joined by `-`, so it reads well in a file name. */
const VARIANT_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** One badge's options, under its name in `badges`. */
export interface BadgeConfig {
  /** 6 hex digits without the '#', as `Badge.color` takes them. */
  color: string;
}

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
  /** Analytics Engine dataset to keep daily aggregates of; absent means no Cloudflare work at all. */
  cloudflare?: CloudflareRule;
  /** Badge colours by badge name; absent means the defaults. */
  badges?: Record<string, BadgeConfig>;
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
  charts: { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {}, 'cloudflare-users': {} },
};

/** One colour per package in the npm chart and the dashboard, so the list is capped at the palette's slots. */
const NPM_MAX_PACKAGES = 8;

/** The stars chart's height in pixels; the default is the SVG's 300. */
const STARS_HEIGHT_MIN = 200;
const STARS_HEIGHT_MAX = 600;

/** Names the dataset uses for its own buckets, so a group can't take them. */
const RESERVED_GROUPS = new Set(['other', 'ignored']);
const NAME_RE = /^[A-Za-z0-9_-]+$/;
const DOCKER_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const CLOUDFLARE_ACCOUNT_RE = /^[0-9a-f]{32}$/;
const CLOUDFLARE_DATASET_RE = /^[A-Za-z0-9_]+$/;
/** The blob columns of an Analytics Engine point. */
const BLOB_RE = /^blob([1-9]|1[0-9]|20)$/;
/** `#rgb` or `#rrggbb`. Colours end up in SVG attributes, so nothing else may get through. */
export const HEX_COLOUR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

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

function expectHex(value: unknown, path: string): string {
  // an unquoted `#` starts a YAML comment, so the value reads as null
  if (value === null) {
    throw new ConfigError(`${path} must be a hex colour such as "#e3b341" (quote it: a bare # starts a YAML comment)`);
  }
  if (typeof value !== 'string' || !HEX_COLOUR_RE.test(value)) {
    throw new ConfigError(`${path} must be a hex colour such as #e3b341`);
  }
  return value.toLowerCase();
}

/** One colour for both modes, or a `light` and a `dark` one. */
function parseColor(value: unknown, path: string): { light: string; dark: string } {
  if (!isObject(value)) {
    const color = expectHex(value, path);
    return { light: color, dark: color };
  }
  checkKeys(value, ['light', 'dark'], path);
  return { light: expectHex(value.light, `${path}.light`), dark: expectHex(value.dark, `${path}.dark`) };
}

/** Each badge's colour, expanded from `#rgb` to 6 hex digits. Badge names can't be checked here: they come from the data. */
function parseBadges(value: unknown): Record<string, BadgeConfig> {
  const obj = expectObject(value, 'badges');
  return Object.fromEntries(
    Object.entries(obj).map(([name, item]) => {
      const path = `badges.${name}`;
      const sub = expectObject(item, path);
      checkKeys(sub, ['color'], path);
      const hex = expectHex(sub.color, `${path}.color`).slice(1);
      return [name, { color: hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex }];
    }),
  );
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

function parseCounters(value: unknown, hasCloudflare: boolean): CounterRule[] {
  const counters = expectList(value, 'counters').map((item, i) => {
    const path = `counters[${i}]`;
    const obj = expectObject(item, path);
    checkKeys(obj, ['name', 'label', 'assets', 'from', 'per-user'], path);
    const name = expectString(obj.name, `${path}.name`);
    checkName(name, `${path}.name`);
    const from = obj.from === undefined ? undefined : expectVersion(obj.from, `${path}.from`);
    const perUser = optionalBoolean(obj, 'per-user', path);
    if (perUser && !hasCloudflare) throw new ConfigError(`${path}.per-user needs a cloudflare source`);
    return {
      name,
      label: optionalString(obj, 'label', path) ?? name,
      assets: expectString(obj.assets, `${path}.assets`),
      ...(from !== undefined ? { from } : {}),
      ...(perUser ? { perUser } : {}),
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
  const startAtZero = optionalBoolean(sub, 'start-at-zero', path);
  const hasFrom = sub.from !== undefined;
  const hasRange = sub.range !== undefined;
  const hasLast = sub.last !== undefined;
  const hasHeight = sub.height !== undefined;
  const hasColor = sub.color !== undefined;
  if (hasFrom && hasRange) throw new ConfigError(`${path}: from and range can't both be set`);
  if (hasLast && chart !== 'downloads-per-release') throw new ConfigError(`${path}.last is only for downloads-per-release`);
  if (hasLast && (hasFrom || hasRange)) throw new ConfigError(`${path}: last can't be combined with from or range`);
  if (hasLast && (!Number.isInteger(sub.last) || (sub.last as number) < 1)) {
    throw new ConfigError(`${path}.last must be a whole number above zero`);
  }
  if (hasHeight && chart !== 'stars') throw new ConfigError(`${path}.height is only for stars`);
  if (hasHeight && (!Number.isInteger(sub.height) || (sub.height as number) < STARS_HEIGHT_MIN || (sub.height as number) > STARS_HEIGHT_MAX)) {
    throw new ConfigError(`${path}.height must be a whole number from ${STARS_HEIGHT_MIN} to ${STARS_HEIGHT_MAX}`);
  }
  if (startAtZero !== undefined && chart !== 'stars') throw new ConfigError(`${path}.start-at-zero is only for stars`);
  if (hasColor && chart !== 'stars') throw new ConfigError(`${path}.color is only for stars`);
  return {
    ...(title === undefined ? {} : { title }),
    ...(animate === undefined ? {} : { animate }),
    ...(hasHeight ? { height: sub.height as number } : {}),
    ...(startAtZero === undefined ? {} : { startAtZero }),
    ...(hasFrom ? { from: parseFrom(sub.from, `${path}.from`) } : {}),
    ...(hasRange ? { range: parseRange(sub.range, `${path}.range`) } : {}),
    ...(hasLast ? { last: sub.last as number } : {}),
    ...(hasColor ? { color: parseColor(sub.color, `${path}.color`) } : {}),
  };
}

/** `<chart>@<name>` keys: each variant is parsed as its base chart, so the base's rules apply to it. */
function parseVariant(key: string, obj: Obj): ChartVariant {
  const path = `charts.${key}`;
  const at = key.indexOf('@');
  const chart = key.slice(0, at);
  const name = key.slice(at + 1);
  if (!CHART_NAMES.includes(chart as ChartName)) throw new ConfigError(`${path}: unknown chart "${chart}"`);
  if (!VARIANT_NAME_RE.test(name)) throw new ConfigError(`${path}: variant names are lowercase words joined by -`);
  const sub = expectObject(obj[key], path);
  checkKeys(sub, CHART_KEYS, path);
  return { chart: chart as ChartName, name, options: parseChart(sub, chart as ChartName, path) };
}

function parseCharts(value: unknown): ChartsConfig {
  const obj = expectObject(value, 'charts');
  const variantKeys = Object.keys(obj).filter((key) => key.includes('@'));
  checkKeys(obj, ['titles', 'animate', ...CHART_NAMES, ...variantKeys], 'charts');
  const section = (chart: ChartName): ChartConfig => {
    const sub = obj[chart] === undefined ? {} : expectObject(obj[chart], `charts.${chart}`);
    checkKeys(sub, CHART_KEYS, `charts.${chart}`);
    return parseChart(sub, chart, `charts.${chart}`);
  };
  const animate = optionalBoolean(obj, 'animate', 'charts');
  const variants = variantKeys.map((key) => parseVariant(key, obj));
  return {
    titles: optionalBoolean(obj, 'titles', 'charts') ?? true,
    ...(animate === undefined ? {} : { animate }),
    stars: section('stars'),
    'downloads-per-day': section('downloads-per-day'),
    'downloads-per-release': section('downloads-per-release'),
    'npm-downloads': section('npm-downloads'),
    'cloudflare-users': section('cloudflare-users'),
    ...(variants.length > 0 ? { variants } : {}),
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

/** `values` maps each raw value to its label: `{ gui: App, cli: CLI }`. */
function parseCloudflareValues(value: unknown, path: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(expectObject(value, path)).map(([raw, label]) => {
      if (raw.trim() === '') throw new ConfigError(`${path}: value names must be non-empty`);
      return [raw, expectString(label, `${path}.${raw}`)];
    }),
  );
}

function parseCloudflareDimensions(value: unknown, path: string): CloudflareDimensionRule[] {
  const obj = expectObject(value, `${path}.dimensions`);
  return Object.entries(obj).map(([name, item]) => {
    const dimPath = `${path}.dimensions.${name}`;
    if (!VARIANT_NAME_RE.test(name)) throw new ConfigError(`${dimPath}: dimension names are lowercase words joined by -`);
    const sub = expectObject(item, dimPath);
    checkKeys(sub, ['column', 'label', 'kind', 'released', 'values'], dimPath);
    const column = expectString(sub.column, `${dimPath}.column`);
    if (!BLOB_RE.test(column)) throw new ConfigError(`${dimPath}.column must be blob1 to blob20`);
    if (sub.kind !== undefined && sub.kind !== 'semver') throw new ConfigError(`${dimPath}.kind must be semver`);
    const kind = sub.kind === 'semver' ? 'semver' : undefined;
    const released = optionalBoolean(sub, 'released', dimPath);
    if (released !== undefined && kind === undefined) throw new ConfigError(`${dimPath}.released needs kind: semver`);
    const values = sub.values === undefined ? undefined : parseCloudflareValues(sub.values, `${dimPath}.values`);
    return {
      name,
      label: optionalString(sub, 'label', dimPath) ?? name,
      column,
      ...(kind ? { kind } : {}),
      ...(released === undefined ? {} : { released }),
      ...(values === undefined ? {} : { values }),
    };
  });
}

/** `primary` names one dimension and the value whose users are the headline: `{ client: gui }`. */
function parseCloudflarePrimary(value: unknown, dimensions: CloudflareDimensionRule[], path: string): { dimension: string; value: string } {
  const entries = Object.entries(expectObject(value, path));
  const [entry] = entries;
  if (entries.length !== 1 || !entry) throw new ConfigError(`${path} must name one dimension and its value, e.g. { client: gui }`);
  const [dimension, raw] = entry;
  if (!dimensions.some((d) => d.name === dimension)) throw new ConfigError(`${path}.${dimension} is not a dimension`);
  return { dimension, value: expectString(raw, `${path}.${dimension}`) };
}

function parseCloudflare(value: unknown): CloudflareRule {
  const path = 'cloudflare';
  const obj = expectObject(value, path);
  checkKeys(obj, ['account-id', 'dataset', 'label', 'users', 'day', 'primary', 'note', 'dimensions'], path);
  const accountId = expectString(obj['account-id'], `${path}.account-id`);
  if (!CLOUDFLARE_ACCOUNT_RE.test(accountId)) throw new ConfigError(`${path}.account-id must be 32 lowercase hex digits`);
  const dataset = expectString(obj.dataset, `${path}.dataset`);
  if (!CLOUDFLARE_DATASET_RE.test(dataset)) throw new ConfigError(`${path}.dataset may only use letters, digits and _`);
  const users = optionalString(obj, 'users', path) ?? 'index1';
  if (users !== 'index1') throw new ConfigError(`${path}.users must be index1, the daily user hash`);
  const day = optionalString(obj, 'day', path);
  if (day !== undefined && !BLOB_RE.test(day)) throw new ConfigError(`${path}.day must be blob1 to blob20`);
  const dimensions = obj.dimensions === undefined ? [] : parseCloudflareDimensions(obj.dimensions, path);
  if (dimensions.filter((d) => d.released).length > 1) throw new ConfigError(`${path}: only one dimension may be released`);
  unique([...(day === undefined ? [] : [day]), ...dimensions.map((d) => d.column)], 'cloudflare column');
  const primary = obj.primary === undefined ? undefined : parseCloudflarePrimary(obj.primary, dimensions, `${path}.primary`);
  const note = optionalString(obj, 'note', path);
  return {
    accountId,
    dataset,
    label: optionalString(obj, 'label', path) ?? dataset,
    users: 'index1',
    ...(day === undefined ? {} : { day }),
    ...(primary === undefined ? {} : { primary }),
    ...(note === undefined ? {} : { note }),
    dimensions,
  };
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
  checkKeys(root, ['releases', 'groups', 'ignore', 'counters', 'epochs', 'platforms', 'charts', 'docker', 'npm', 'cloudflare', 'badges'], 'top level');

  const cloudflare = root.cloudflare === undefined ? undefined : parseCloudflare(root.cloudflare);
  const config: StatsConfig = {
    releases: optionalBoolean(root, 'releases', 'top level') ?? true,
    groups: root.groups === undefined ? structuredClone(DEFAULT_CONFIG.groups) : parseGroups(root.groups),
    ignore: root.ignore === undefined ? [] : parseIgnore(root.ignore),
    counters: root.counters === undefined ? [] : parseCounters(root.counters, cloudflare !== undefined),
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
  if (cloudflare) config.cloudflare = cloudflare;
  if (root.badges !== undefined) config.badges = parseBadges(root.badges);
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
