// Reshaping of the Dataset that more than one section needs. Pure, so it is unit tested.

import type { Dataset, GroupInfo, Period, ReleaseRow } from '@github-stats-action/core';

/** The group of files the ignore list matched: kept in the data, never counted. */
export const IGNORED = 'ignored';

/** The groups that count downloads, in config order. */
export function countedGroups(d: Dataset): GroupInfo[] {
  return d.groups.filter((g) => g.name !== IGNORED);
}

/** A period's name: its epoch's label, or the span before the first epoch. */
export function periodName(p: Period, epochs: Dataset['epochs']): string {
  if (p.epoch >= 0) return epochs[p.epoch]?.label ?? p.version ?? '';
  return epochs.length ? `Before ${epochs[0]!.version}` : 'All releases';
}

/** A period's short axis label: its epoch version, or the release count when it has none. */
export function periodShort(p: Period, epochs: Dataset['epochs']): string {
  if (p.epoch >= 0) return p.version ?? '';
  return epochs.length ? `<${epochs[0]!.version}` : 'all';
}

/** Totals per platform label of one group, summed over every release, largest first. */
export function platformTotals(d: Dataset, group: string): Array<[label: string, downloads: number]> {
  const sums = new Map<string, number>();
  for (const release of d.releases) {
    for (const file of release.files) {
      if (file.group !== group) continue;
      sums.set(file.label, (sums.get(file.label) ?? 0) + file.downloads);
    }
  }
  return [...sums.entries()].sort((a, b) => b[1] - a[1]);
}

/** One column of the all-versions table: a platform label within one group. */
export interface PivotColumn {
  key: string;
  group: GroupInfo;
  label: string;
  downloads: number;
}

/** Columns of the all-versions table: each counted group's labels, largest first, groups in config order. */
export function pivotColumns(d: Dataset): PivotColumn[] {
  const out: PivotColumn[] = [];
  for (const group of countedGroups(d)) {
    const columns = platformTotals(d, group.name).map(([label, downloads]) => ({
      key: `${group.name}\u0001${label}`,
      group,
      label,
      downloads,
    }));
    out.push(...columns);
  }
  return out;
}

/** Downloads of each pivot column in one release, keyed like `PivotColumn.key`. */
export function releaseCells(release: ReleaseRow): Map<string, number> {
  const cells = new Map<string, number>();
  for (const file of release.files) cells.set(`${file.group}\u0001${file.label}`, file.downloads);
  return cells;
}
