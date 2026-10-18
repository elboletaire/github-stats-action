// The README charts' windows: each chart is drawn from the dataset cut to its own days, so the chart
// functions don't know about windows. The dashboard keeps its own zoom and isn't windowed.

import {
  rangeStart,
  utcDate,
  type ChartName,
  type Dataset,
  type EstimatedDaily,
  type NpmData,
  type StarPoint,
} from '@github-stats-action/core';
import { dayLabel, dayOf } from './svg';

/** The first and last day a chart covers, YYYY-MM-DD, both inclusive. */
export interface ChartWindow {
  start: string;
  end: string;
}

/** Whether the config sets a window for `chart`, so an empty chart can say the window matched nothing. */
export function windowSet(dataset: Dataset, chart: ChartName): boolean {
  const options = dataset.charts?.[chart];
  return options?.from !== undefined || options?.range !== undefined || options?.last !== undefined;
}

/** The days a chart covers: its `from`, or its `range` counted back from the end. Undefined shows all history. */
export function windowOf(dataset: Dataset, chart: ChartName): ChartWindow | undefined {
  const options = dataset.charts?.[chart];
  if (!options || (options.from === undefined && options.range === undefined)) return undefined;
  // the end is the data's latest day: the snapshot's, or npm's last stored day, which is where the npm chart ends
  const end = chart === 'npm-downloads' && dataset.npm ? dataset.npm.latest : utcDate(Date.parse(dataset.snapshotAt));
  return { start: options.from ?? rangeStart(options.range!, end), end };
}

const inWindow = (day: string, w: ChartWindow): boolean => day >= w.start && day <= w.end;

/** The curve starts at the count on the window's first day, or on the first star when the window reaches back past it. */
function clipStars(stars: StarPoint[], w: ChartWindow): StarPoint[] {
  const first = stars[0];
  if (!first) return [];
  const from = w.start > first.date ? w.start : first.date;
  if (from > w.end) return [];
  const before = stars.filter((p) => p.date <= from).at(-1);
  return [{ date: from, stars: before?.stars ?? 0 }, ...stars.filter((p) => p.date > from && p.date <= w.end)];
}

/** The estimate's days inside the window; its start moves to the first of them, so the axis starts there. */
function clipEstimate(estimate: EstimatedDaily, w: ChartWindow): EstimatedDaily {
  const origin = dayOf(estimate.start);
  const count = Math.max(0, ...Object.values(estimate.groups).map((values) => values.length));
  const from = Math.min(count, Math.max(0, dayOf(w.start) - origin));
  const to = Math.min(count, Math.max(0, dayOf(w.end) - origin + 1));
  return {
    start: dayLabel(origin + from),
    groups: Object.fromEntries(Object.entries(estimate.groups).map(([name, values]) => [name, values.slice(from, to)])),
  };
}

/** The releases kept, and the epochs whose first release is among them: an epoch that began before the window has no marker. */
function clipReleases(dataset: Dataset, w: ChartWindow | undefined, last: number | undefined): Dataset {
  const inside = w ? dataset.releases.filter((r) => inWindow(utcDate(Date.parse(r.publishedAt)), w)) : dataset.releases;
  const kept = last === undefined ? inside : inside.slice(-last);
  const shown = dataset.epochs.flatMap((_, i) => {
    const first = dataset.releases.find((r) => r.epoch === i);
    return first !== undefined && kept.includes(first) ? [i] : [];
  });
  // the releases point at the epochs that are still shown, by their new index; -1 for a hidden one
  return {
    ...dataset,
    epochs: shown.map((i) => dataset.epochs[i]!),
    releases: kept.map((r) => ({ ...r, epoch: shown.indexOf(r.epoch) })),
  };
}

/** The npm weeks start at the window's first day, so the first week is the short one that begins there. */
function clipNpm(npm: NpmData, w: ChartWindow): NpmData {
  return {
    ...npm,
    first: npm.first > w.start ? npm.first : w.start,
    packages: npm.packages.map((pkg) => ({ ...pkg, days: pkg.days.filter((d) => inWindow(d.date, w)) })),
  };
}

/** The dataset cut to what `chart` shows: the chart functions draw whatever they are given. */
export function windowed(dataset: Dataset, chart: ChartName): Dataset {
  const w = windowOf(dataset, chart);
  const last = dataset.charts?.[chart]?.last;
  if (chart === 'stars' && w) return { ...dataset, stars: clipStars(dataset.stars, w) };
  if (chart === 'downloads-per-day' && w) {
    return {
      ...dataset,
      measuredDaily: dataset.measuredDaily.filter((d) => inWindow(d.date, w)),
      estimatedDaily: clipEstimate(dataset.estimatedDaily, w),
    };
  }
  if (chart === 'downloads-per-release' && (w || last !== undefined)) {
    return clipReleases(dataset, w, last);
  }
  if (chart === 'npm-downloads' && w && dataset.npm) return { ...dataset, npm: clipNpm(dataset.npm, w) };
  return dataset;
}
