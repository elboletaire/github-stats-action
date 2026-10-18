// daily.csv: one row per snapshot day, the totals per group, then the change since the previous row.

import type { DaySummary } from './summary';

function cell(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function buildDailyCsv(days: readonly DaySummary[], names: readonly string[]): string {
  const header = [
    'date',
    ...names.map((n) => `${n}_downloads`),
    'total_downloads',
    'docker_pulls',
    'stars',
    'forks',
    ...names.map((n) => `${n}_delta`),
    'total_delta',
    'docker_delta',
    'stars_delta',
  ];
  const lines = [header.join(',')];
  days.forEach((day, i) => {
    const prev = days[i - 1];
    const deltas = prev
      ? [
          ...names.map((n) => (day.groups[n] ?? 0) - (prev.groups[n] ?? 0)),
          day.total - prev.total,
          day.docker === null || prev.docker === null ? null : day.docker - prev.docker,
          day.stars - prev.stars,
        ]
      : [...names.map(() => null), null, null, null];
    lines.push(
      [
        day.date,
        ...names.map((n) => cell(day.groups[n])),
        cell(day.total),
        cell(day.docker),
        cell(day.stars),
        cell(day.forks),
        ...deltas.map(cell),
      ].join(','),
    );
  });
  return `${lines.join('\n')}\n`;
}
