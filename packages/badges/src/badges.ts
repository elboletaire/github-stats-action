// The badges of one repo: a shields.io endpoint JSON and a flat SVG for each, with the same label and message.

import type { Dataset, MeasuredDay, OutputFile } from '@github-stats-action/core';
import { formatCompact, slug } from './format';
import { measuredWindow, PERIODS, starsGained } from './periods';
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

/** The week and month badges of one count; each is left out when its measured window isn't covered. */
function periodBadges(
  name: string,
  label: string,
  color: string,
  measured: readonly MeasuredDay[],
  value: (day: MeasuredDay) => number | null,
): Badge[] {
  return PERIODS.flatMap(({ name: period, days }) => {
    const sum = measuredWindow(measured, days, value);
    // a negative sum is a shrunk total (a release was removed): no badge rather than a false count
    if (sum === undefined || sum < 0) return [];
    return [{ name: `${name}-${period}`, label, message: `${formatCompact(sum)}/${period}`, color }];
  });
}

/**
 * Every badge for the dataset, in display order. The release badges are left out without release
 * downloads, and so is the latest release when no stable one exists.
 */
export function buildBadges(dataset: Dataset): Badge[] {
  const { totals, measuredDaily: measured } = dataset;
  const badges: Badge[] = [];
  if (dataset.releaseDownloads) {
    const names = dataset.groups.map((group) => group.name);
    badges.push({ name: 'downloads', label: 'downloads', message: formatCompact(totals.downloads), color: COLORS.total });
    badges.push(
      ...periodBadges('downloads', 'downloads', COLORS.total, measured, (day) =>
        names.reduce((sum, name) => sum + (day.groups[name] ?? 0), 0),
      ),
    );
    // a single group would only repeat the total
    for (const group of dataset.groups.length < 2 ? [] : dataset.groups) {
      const name = `downloads-${slug(group.name)}`;
      const label = `downloads (${group.label})`;
      badges.push({ name, label, message: formatCompact(totals.groups[group.name] ?? 0), color: COLORS.group });
      badges.push(...periodBadges(name, label, COLORS.group, measured, (day) => day.groups[group.name] ?? 0));
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
  for (const { name, days } of PERIODS) {
    const gained = starsGained(dataset.stars, days);
    if (gained !== undefined) {
      badges.push({
        name: `stars-${name}`,
        label: 'stars',
        message: `${gained < 0 ? '-' : '+'}${formatCompact(Math.abs(gained))} this ${name}`,
        color: COLORS.stars,
      });
    }
  }

  if (totals.docker !== null) {
    badges.push({
      name: 'docker-pulls',
      label: 'docker pulls',
      message: formatCompact(totals.docker),
      color: COLORS.docker,
    });
    const pulls = measuredWindow(measured, 30, (day) => day.docker);
    if (pulls !== undefined && pulls >= 0) {
      badges.push({
        name: 'docker-pulls-month',
        label: 'docker pulls',
        message: `${formatCompact(pulls)}/month`,
        color: COLORS.docker,
      });
    }
  }

  if (dataset.npm) {
    badges.push({
      name: 'npm-downloads',
      label: 'npm downloads/month',
      message: formatCompact(dataset.npm.totals.last30),
      color: COLORS.npm,
    });
    badges.push({
      name: 'npm-downloads-week',
      label: 'npm downloads/week',
      message: formatCompact(dataset.npm.totals.last7),
      color: COLORS.npm,
    });
    badges.push({
      name: 'npm-downloads-total',
      label: 'npm downloads',
      message: `${formatCompact(dataset.npm.totals.all)} total`,
      color: COLORS.npm,
    });
    for (const pkg of dataset.npm.packages) {
      badges.push({
        name: `npm-${pkg.slug}`,
        label: `${pkg.label} npm/month`,
        message: formatCompact(pkg.totals.last30),
        color: COLORS.npm,
      });
      badges.push({
        name: `npm-${pkg.slug}-week`,
        label: `${pkg.label} npm/week`,
        message: formatCompact(pkg.totals.last7),
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
