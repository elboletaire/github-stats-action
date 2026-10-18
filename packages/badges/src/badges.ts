// The badges of one repo: a shields.io endpoint JSON and a flat SVG for each, with the same label and message.

import type { Dataset, OutputFile } from '@github-stats-action/core';
import { formatCompact, slug } from './format';
import { flatSvg } from './svg';

export interface Badge {
  /** File name without extension: `badges/<name>.json` and `.svg`. */
  name: string;
  label: string;
  message: string;
  /** A shields.io colour name, or 6 hex digits without the '#'. */
  color: string;
}

/** Default colour per kind of badge; configurable later. */
export const COLORS = {
  total: 'blue',
  group: 'brightgreen',
  release: 'orange',
  stars: 'yellow',
  docker: '2496ed',
  counter: '8957e5',
} as const;

/** Every badge for the dataset, in display order. Latest release is skipped when no stable one exists. */
export function buildBadges(dataset: Dataset): Badge[] {
  const { totals } = dataset;
  const badges: Badge[] = [
    { name: 'downloads', label: 'downloads', message: formatCompact(totals.downloads), color: COLORS.total },
    ...dataset.groups.map((group) => ({
      name: `downloads-${slug(group.name)}`,
      label: `downloads (${group.label})`,
      message: formatCompact(totals.groups[group.name] ?? 0),
      color: COLORS.group,
    })),
  ];

  const latest = dataset.releases.filter((release) => !release.prerelease).at(-1);
  if (latest) {
    const downloads = Object.values(latest.groups).reduce((sum, count) => sum + count, 0);
    badges.push({
      name: 'release-latest',
      label: `${latest.tag} downloads`,
      message: formatCompact(downloads),
      color: COLORS.release,
    });
  }

  badges.push({ name: 'stars', label: 'stars', message: formatCompact(totals.stars), color: COLORS.stars });
  if (totals.docker !== null) {
    badges.push({
      name: 'docker-pulls',
      label: 'docker pulls',
      message: formatCompact(totals.docker),
      color: COLORS.docker,
    });
  }

  for (const counter of dataset.counters) {
    badges.push({
      name: `counter-${slug(counter.name)}`,
      label: counter.label,
      message: formatCompact(totals.counters[counter.name]?.downloads ?? 0),
      color: COLORS.counter,
    });
  }
  return badges;
}

/** The shields.io endpoint JSON (https://shields.io/badges/endpoint-badge). */
export function endpointJson(badge: Badge): string {
  return `${JSON.stringify({ schemaVersion: 1, label: badge.label, message: badge.message, color: badge.color })}\n`;
}

/** Badges for one repo; paths are relative to `<owner>/<repo>/`. */
export function renderBadges(dataset: Dataset): OutputFile[] {
  return buildBadges(dataset).flatMap((badge) => [
    { path: `badges/${badge.name}.json`, content: endpointJson(badge) },
    { path: `badges/${badge.name}.svg`, content: flatSvg(badge) },
  ]);
}
