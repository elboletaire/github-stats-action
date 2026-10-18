// One period per epoch span (plus the span before the first epoch): totals, averages and
// medians over the span's whole UTC days.

import type { CounterInfo, EpochInfo, EstimatedDaily, Period, ReleaseRow } from './types';
import { DAY_MS, median } from './estimate';

export interface PeriodInput {
  releases: readonly ReleaseRow[];
  epochs: readonly EpochInfo[];
  counters: readonly CounterInfo[];
  names: readonly string[];
  /** Midnight UTC of day 0 of `daily`. */
  d0: number;
  daily: EstimatedDaily;
}

const zeros = (names: readonly string[]): Record<string, number> =>
  Object.fromEntries(names.map((name) => [name, 0]));

export function buildPeriods(input: PeriodInput): Period[] {
  const { releases, epochs, counters, names, d0, daily } = input;
  const nd = Object.values(daily.groups)[0]?.length ?? 0;
  const periods: Period[] = [];

  for (let epoch = -1; epoch < epochs.length; epoch++) {
    const info = epoch < 0 ? null : epochs[epoch]!;
    const rs = releases.filter((r) => r.epoch === epoch);
    const first = rs[0];
    const last = rs[rs.length - 1];
    const base = { epoch, version: info?.version ?? null, label: info?.label ?? null };

    if (!first || !last) {
      periods.push({
        ...base,
        start: null,
        end: null,
        days: 0,
        releases: 0,
        firstTag: null,
        lastTag: null,
        groups: zeros(names),
        downloads: 0,
        avgPerDay: zeros(names),
        avgPerDayTotal: 0,
        medianPerDay: Object.fromEntries(names.map((name) => [name, null])),
        medianPerDayTotal: null,
        fullDays: 0,
        counters: Object.fromEntries(counters.map((c) => [c.name, { downloads: 0, counted: false }])),
      });
      continue;
    }

    const startMs = Date.parse(first.publishedAt);
    const endMs = Date.parse(last.end);
    const days = (endMs - startMs) / DAY_MS;
    const groups = zeros(names);
    for (const r of rs) for (const name of names) groups[name]! += r.groups[name] ?? 0;
    const downloads = names.reduce((sum, name) => sum + groups[name]!, 0);

    // Whole UTC days inside the span: the first full day at or after its start, up to the last full day before its end.
    const i0 = Math.max(0, Math.ceil((startMs - d0) / DAY_MS));
    const i1 = Math.min(nd, Math.floor((endMs - d0) / DAY_MS));
    const full: number[] = [];
    for (let i = i0; i < i1; i++) full.push(i);

    periods.push({
      ...base,
      start: first.publishedAt,
      end: last.end,
      days,
      releases: rs.length,
      firstTag: first.tag,
      lastTag: last.tag,
      groups,
      downloads,
      avgPerDay: Object.fromEntries(names.map((name) => [name, days > 0 ? groups[name]! / days : 0])),
      avgPerDayTotal: days > 0 ? downloads / days : 0,
      medianPerDay: Object.fromEntries(
        names.map((name) => [name, median(full.map((i) => daily.groups[name]![i]!))]),
      ),
      medianPerDayTotal: median(
        full.map((i) => names.reduce((sum, name) => sum + daily.groups[name]![i]!, 0)),
      ),
      fullDays: full.length,
      counters: Object.fromEntries(
        counters.map((c) => {
          let sum = 0;
          let counted = false;
          for (const r of rs) {
            const counter = r.counters[c.name];
            if (counter?.counted) {
              sum += counter.downloads;
              counted = true;
            }
          }
          return [c.name, { downloads: sum, counted }];
        }),
      ),
    });
  }
  return periods;
}
