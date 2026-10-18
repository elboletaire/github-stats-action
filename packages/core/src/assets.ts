// Which group a release asset is counted in, and the label it shows under.

import type { PlatformRule, StatsConfig } from './config';
import { matchGlob } from './glob';

export const IGNORED = 'ignored';
export const OTHER = 'other';

/** Ignored files are checked first, then the first matching group; anything else is `other`. */
export function classifyAsset(name: string, config: StatsConfig): string {
  if (config.ignore.some((pattern) => matchGlob(name, pattern))) return IGNORED;
  const group = config.groups.find((g) => matchGlob(name, g.assets));
  return group ? group.name : OTHER;
}

/** Without a matching platform rule, the asset name minus the tag, the repo name and archive suffixes. */
export function platformLabel(
  name: string,
  tag: string,
  repo: string,
  rules: readonly PlatformRule[],
): string {
  const rule = rules.find((r) => matchGlob(name, r.match));
  if (rule) return rule.label;
  let base = name;
  while (/\.(tar\.gz|zip|md5)$/.test(base)) base = base.replace(/\.(tar\.gz|zip|md5)$/, '');
  const repoName = repo.split('/')[1] ?? repo;
  for (const part of [tag, tag.replace(/^v/, ''), repoName]) base = base.split(part).join('-');
  return base.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || name;
}
