// daily.csv: one row per day with a snapshot or an npm count. Columns only for what the repo has: release
// downloads, Docker and npm. Snapshot columns are blank on npm-only days; deltas are against the previous snapshot.

import type { DaySummary } from './summary';
import type { NpmPackageStats } from './types';

function cell(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export interface CsvOptions {
  /** Release-download columns: per group and total, with their deltas. */
  downloads: boolean;
  /** The Docker Hub columns, when an image is configured. */
  docker: boolean;
  /** One column per package in config order, plus `npm_total`; their counts are per day, so they have no deltas. */
  npm: readonly NpmPackageStats[];
}

export function buildDailyCsv(days: readonly DaySummary[], names: readonly string[], options: CsvOptions): string {
  const { downloads, docker, npm } = options;
  const groupCols = downloads ? [...names.map((n) => `${n}_downloads`), 'total_downloads'] : [];
  const deltaCols = downloads ? [...names.map((n) => `${n}_delta`), 'total_delta'] : [];
  const npmCols = npm.length > 0 ? [...npm.map((p) => `npm_${p.slug}`), 'npm_total'] : [];
  const header = [
    'date',
    ...groupCols,
    ...(docker ? ['docker_pulls'] : []),
    'stars',
    'forks',
    ...deltaCols,
    ...(docker ? ['docker_delta'] : []),
    'stars_delta',
    ...npmCols,
  ];
  const npmByDay = npm.map((p) => new Map(p.days.map((d) => [d.date, d.downloads])));
  const dates = [...new Set([...days.map((d) => d.date), ...npm.flatMap((p) => p.days.map((d) => d.date))])].sort();
  const index = new Map(days.map((d, i) => [d.date, i]));
  const lines = [header.join(',')];
  for (const date of dates) {
    const i = index.get(date);
    const day = i === undefined ? undefined : days[i];
    const prev = i === undefined ? undefined : days[i - 1];
    const groupDeltas =
      day && prev
        ? [...names.map((n) => (day.groups[n] ?? 0) - (prev.groups[n] ?? 0)), day.total - prev.total]
        : [...names.map(() => null), null];
    const groupCells = downloads ? [...names.map((n) => cell(day?.groups[n])), cell(day?.total)] : [];
    const dockerDelta =
      day && prev && day.docker !== null && prev.docker !== null ? day.docker - prev.docker : null;
    const starsDelta = day && prev ? day.stars - prev.stars : null;
    const npmValues = npmByDay.map((m) => m.get(date));
    const npmTotal = npmValues.some((v) => v !== undefined)
      ? npmValues.reduce<number>((sum, v) => sum + (v ?? 0), 0)
      : undefined;
    lines.push(
      [
        date,
        ...groupCells,
        ...(docker ? [cell(day?.docker)] : []),
        cell(day?.stars),
        cell(day?.forks),
        ...(downloads ? groupDeltas.map(cell) : []),
        ...(docker ? [cell(dockerDelta)] : []),
        cell(starsDelta),
        ...(npm.length > 0 ? [...npmValues.map(cell), cell(npmTotal)] : []),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
