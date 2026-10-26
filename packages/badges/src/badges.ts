// The badges of one repo: a shields.io endpoint JSON and a flat SVG for each, with the same label and message.

import type { BadgeConfig, Dataset, MeasuredDay, OutputFile } from '@github-stats-action/core';
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

/** Default colour per kind of badge; the config's `badges` overrides it per badge. */
export const COLORS = {
  total: 'blue',
  group: 'brightgreen',
  release: 'orange',
  stars: 'yellow',
  docker: '2496ed',
  npm: 'cb3837',
  users: '0e7490',
  counter: '8957e5',
} as const;

/** The colour of the badge `name`: its configured one, else `fallback`. Also records `name` as one the data can make. */
type ColourOf = (name: string, fallback: string) => string;

/**
 * The week and month badges of one count; each is left out when its measured window isn't covered.
 * `color` is the base badge's colour, which a period badge takes unless it has its own entry.
 */
function periodBadges(
  name: string,
  label: string,
  color: string,
  measured: readonly MeasuredDay[],
  value: (day: MeasuredDay) => number | null,
  colourOf: ColourOf,
): Badge[] {
  return PERIODS.flatMap(({ name: period, days }) => {
    const badgeName = `${name}-${period}`;
    const badgeColour = colourOf(badgeName, color);
    const sum = measuredWindow(measured, days, value);
    // a negative sum is a shrunk total (a release was removed): no badge rather than a false count
    if (sum === undefined || sum < 0) return [];
    return [{ name: badgeName, label, message: `${formatCompact(sum)}/${period}`, color: badgeColour }];
  });
}

interface Built {
  badges: Badge[];
  /** Every name the dataset could make a badge for, shown or not (a period badge can lack history). */
  names: string[];
}

/**
 * Every badge for the dataset, in display order, with the configured colours. The release badges are
 * left out without release downloads, and so is the latest release when no stable one exists.
 */
function build(dataset: Dataset, configured: Record<string, BadgeConfig>): Built {
  const names: string[] = [];
  const colourOf: ColourOf = (name, fallback) => {
    names.push(name);
    return configured[name]?.color ?? fallback;
  };
  const { totals, measuredDaily: measured } = dataset;
  const badges: Badge[] = [];
  if (dataset.releaseDownloads) {
    const groups = dataset.groups.map((group) => group.name);
    const totalColour = colourOf('downloads', COLORS.total);
    badges.push({ name: 'downloads', label: 'downloads', message: formatCompact(totals.downloads), color: totalColour });
    badges.push(
      ...periodBadges(
        'downloads',
        'downloads',
        totalColour,
        measured,
        (day) => groups.reduce((sum, name) => sum + (day.groups[name] ?? 0), 0),
        colourOf,
      ),
    );
    // a single group would only repeat the total
    for (const group of dataset.groups.length < 2 ? [] : dataset.groups) {
      const name = `downloads-${slug(group.name)}`;
      const label = `downloads (${group.label})`;
      const groupColour = colourOf(name, COLORS.group);
      badges.push({ name, label, message: formatCompact(totals.groups[group.name] ?? 0), color: groupColour });
      badges.push(...periodBadges(name, label, groupColour, measured, (day) => day.groups[group.name] ?? 0, colourOf));
    }

    // core sorts releases by publish date, so the last stable one is the latest
    const latest = dataset.releases.filter((release) => !release.prerelease).at(-1);
    const latestColour = colourOf('release-latest', COLORS.release);
    if (latest) {
      const downloads = Object.values(latest.groups).reduce((sum, count) => sum + count, 0);
      badges.push({
        name: 'release-latest',
        label: `${latest.tag} downloads`,
        message: formatCompact(downloads),
        color: latestColour,
      });
    }
  }

  const starsColour = colourOf('stars', COLORS.stars);
  badges.push({ name: 'stars', label: 'stars', message: formatCompact(totals.stars), color: starsColour });
  for (const { name, days } of PERIODS) {
    const periodColour = colourOf(`stars-${name}`, starsColour);
    const gained = starsGained(dataset.stars, days);
    if (gained !== undefined) {
      badges.push({
        name: `stars-${name}`,
        label: 'stars',
        message: `${gained < 0 ? '-' : '+'}${formatCompact(Math.abs(gained))} this ${name}`,
        color: periodColour,
      });
    }
  }

  if (totals.docker !== null) {
    const dockerColour = colourOf('docker-pulls', COLORS.docker);
    badges.push({ name: 'docker-pulls', label: 'docker pulls', message: formatCompact(totals.docker), color: dockerColour });
    const monthColour = colourOf('docker-pulls-month', dockerColour);
    const pulls = measuredWindow(measured, 30, (day) => day.docker);
    if (pulls !== undefined && pulls >= 0) {
      badges.push({
        name: 'docker-pulls-month',
        label: 'docker pulls',
        message: `${formatCompact(pulls)}/month`,
        color: monthColour,
      });
    }
  }

  if (dataset.npm) {
    const npmColour = colourOf('npm-downloads', COLORS.npm);
    badges.push({
      name: 'npm-downloads',
      label: 'npm downloads/month',
      message: formatCompact(dataset.npm.totals.last30),
      color: npmColour,
    });
    badges.push({
      name: 'npm-downloads-week',
      label: 'npm downloads/week',
      message: formatCompact(dataset.npm.totals.last7),
      color: colourOf('npm-downloads-week', npmColour),
    });
    badges.push({
      name: 'npm-downloads-total',
      label: 'npm downloads',
      message: `${formatCompact(dataset.npm.totals.all)} total`,
      color: colourOf('npm-downloads-total', COLORS.npm),
    });
    for (const pkg of dataset.npm.packages) {
      const packageColour = colourOf(`npm-${pkg.slug}`, COLORS.npm);
      badges.push({
        name: `npm-${pkg.slug}`,
        label: `${pkg.label} npm/month`,
        message: formatCompact(pkg.totals.last30),
        color: packageColour,
      });
      badges.push({
        name: `npm-${pkg.slug}-week`,
        label: `${pkg.label} npm/week`,
        message: formatCompact(pkg.totals.last7),
        color: colourOf(`npm-${pkg.slug}-week`, packageColour),
      });
    }
  }

  if (dataset.cloudflare) {
    const usersColour = colourOf('users-daily', COLORS.users);
    badges.push({
      name: 'users-daily',
      label: 'avg daily users (7d)',
      message: formatCompact(dataset.cloudflare.totals.usersAvg7),
      color: usersColour,
    });
    badges.push({
      name: 'users-daily-month',
      label: 'avg daily users (30d)',
      message: formatCompact(dataset.cloudflare.totals.usersAvg30),
      color: colourOf('users-daily-month', usersColour),
    });
    badges.push({
      name: 'users-daily-latest',
      label: `users on ${dataset.cloudflare.latest}`,
      message: formatCompact(dataset.cloudflare.totals.usersLatest),
      color: colourOf('users-daily-latest', usersColour),
    });
  }

  for (const counter of dataset.counters) {
    const name = `counter-${slug(counter.name)}`;
    badges.push({
      name,
      label: counter.label,
      message: formatCompact(totals.counters[counter.name]?.downloads ?? 0),
      color: colourOf(name, COLORS.counter),
    });
  }
  return { badges, names };
}

/** Every badge for the dataset, in display order, with the configured colours. */
export function buildBadges(dataset: Dataset, configured: Record<string, BadgeConfig> = {}): Badge[] {
  return build(dataset, configured).badges;
}

/** The configured names that no badge of this dataset could take: a typo, or a badge the data no longer makes. */
export function unknownBadges(dataset: Dataset, configured: Record<string, BadgeConfig> = {}): string[] {
  const names = new Set(build(dataset, {}).names);
  return Object.keys(configured).filter((name) => !names.has(name));
}

/** The shields.io endpoint JSON (https://shields.io/badges/endpoint-badge). */
export function endpointJson(badge: Badge): string {
  return `${JSON.stringify({ schemaVersion: 1, label: badge.label, message: badge.message, color: badge.color })}\n`;
}

/** Badges for one repo; paths are relative to `<owner>/<repo>/`. */
export function renderBadges(dataset: Dataset, configured: Record<string, BadgeConfig> = {}): OutputFile[] {
  return buildBadges(dataset, configured).flatMap((badge) => [
    { path: `badges/${badge.name}.json`, content: endpointJson(badge) },
    { path: `badges/${badge.name}.svg`, content: flatSvg(badge) },
  ]);
}
