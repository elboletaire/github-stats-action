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
  npm: 'cb3837',
  counter: '8957e5',
} as const;

/**
 * Every badge for the dataset, in display order. The release badges are left out without release
 * downloads, and so is the latest release when no stable one exists.
 */
export function buildBadges(dataset: Dataset): Badge[] {
  const { totals } = dataset;
  const badges: Badge[] = [];
  if (dataset.releaseDownloads) {
    badges.push({ name: 'downloads', label: 'downloads', message: formatCompact(totals.downloads), color: COLORS.total });
    // a single group would only repeat the total
    for (const group of dataset.groups.length < 2 ? [] : dataset.groups) {
      badges.push({
        name: `downloads-${slug(group.name)}`,
        label: `downloads (${group.label})`,
        message: formatCompact(totals.groups[group.name] ?? 0),
        color: COLORS.group,
      });
    }

    // core sorts releases by publish date, so the last stable one is the latest
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

  if (dataset.npm) {
    badges.push({
      name: 'npm-downloads',
      label: 'npm downloads/month',
      message: formatCompact(dataset.npm.totals.last30),
      color: COLORS.npm,
    });
    for (const pkg of dataset.npm.packages) {
      badges.push({
        name: `npm-${pkg.slug}`,
        label: `${pkg.label} npm/month`,
        message: formatCompact(pkg.totals.last30),
        color: COLORS.npm,
      });
    }
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
