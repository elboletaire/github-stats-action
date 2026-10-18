// daily.csv: one row per snapshot day, the totals per group, then the change since the previous row.
// Without release downloads the group and total columns are left out.

import type { DaySummary } from './summary';

function cell(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function buildDailyCsv(days: readonly DaySummary[], names: readonly string[], downloads = true): string {
  const groupCols = downloads ? [...names.map((n) => `${n}_downloads`), 'total_downloads'] : [];
  const deltaCols = downloads ? [...names.map((n) => `${n}_delta`), 'total_delta'] : [];
  const header = ['date', ...groupCols, 'docker_pulls', 'stars', 'forks', ...deltaCols, 'docker_delta', 'stars_delta'];
  const lines = [header.join(',')];
  days.forEach((day, i) => {
    const prev = days[i - 1];
    const groupDeltas = prev
      ? [...names.map((n) => (day.groups[n] ?? 0) - (prev.groups[n] ?? 0)), day.total - prev.total]
      : [...names.map(() => null), null];
    const groupCells = downloads ? [...names.map((n) => cell(day.groups[n])), cell(day.total)] : [];
    const dockerDelta = prev && day.docker !== null && prev.docker !== null ? day.docker - prev.docker : null;
    const starsDelta = prev ? day.stars - prev.stars : null;
    lines.push(
      [
        day.date,
        ...groupCells,
        cell(day.docker),
        cell(day.stars),
        cell(day.forks),
        ...(downloads ? groupDeltas.map(cell) : []),
        cell(dockerDelta),
        cell(starsDelta),
      ].join(','),
    );
  });
  return `${lines.join('\n')}\n`;
}
