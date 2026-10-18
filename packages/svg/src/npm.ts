// npm downloads per week: the daily counts summed into 7-day weeks that end on the latest stored day,
// stacked by package. One path per package keeps the file small enough for a README.

import type { Dataset, NpmData } from '@github-stats-action/core';
import {
  barWidth,
  dayOf,
  edgeAnchor,
  finite,
  heading,
  niceTicks,
  PAD,
  PLOT_LEFT,
  plotTop,
  plural,
  sample,
  seriesColor,
  showTitle,
  stackBars,
  svgDocument,
  timeLabel,
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Key,
  type Theme,
} from './svg';

const WEEK = 7;
const title = 'npm downloads per week';

/** Each package's daily counts summed per week. The last week ends on the latest stored day; the first may be short. */
export function weeklySums(npm: NpmData): { ends: number[]; sums: number[][] } {
  const latest = dayOf(npm.latest);
  const count = Math.floor((latest - dayOf(npm.first)) / WEEK) + 1;
  const sums = npm.packages.map(() => new Array<number>(count).fill(0));
  npm.packages.forEach((pkg, p) => {
    for (const day of pkg.days) {
      const weeksAgo = Math.floor((latest - dayOf(day.date)) / WEEK);
      sums[p]![count - 1 - weeksAgo]! += day.downloads;
    }
  });
  const ends = Array.from({ length: count }, (_, w) => latest - (count - 1 - w) * WEEK);
  return { ends, sums };
}

export function npmDownloadsChart(dataset: Dataset, theme: Theme): string {
  const npm = dataset.npm;
  if (!npm) throw new Error('npmDownloadsChart needs dataset.npm');
  const titled = showTitle(dataset, 'npmDownloads');
  const keys: Key[] = npm.packages.map((pkg) => ({ label: pkg.label, color: seriesColor(theme, pkg.color) }));
  const { ends, sums } = weeklySums(npm);
  const count = ends.length;

  const totals = ends.map((_, w) => sums.reduce((sum, row) => sum + finite(row[w] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks.at(-1) ?? 1;
  const box: Box = { left: PLOT_LEFT, right: WIDTH - PAD, top: plotTop(titled), bottom: 252 };
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);

  const slot = (box.right - box.left) / count;
  const width = barWidth(slot);
  const rows: string[][] = npm.packages.map(() => []);
  for (let w = 0; w < count; w++) {
    const x = box.left + w * slot + (slot - width) / 2;
    for (const { index, d } of stackBars(x, width, yOf, sums.map((row) => row[w] ?? 0))) rows[index]!.push(d);
  }
  const bars = npm.packages.flatMap((pkg, p) =>
    rows[p]!.length ? [`<path d="${rows[p]!.join('')}" fill="${seriesColor(theme, pkg.color)}"/>`] : [],
  );

  const label = timeLabel(count * WEEK);
  const picks = sample(count);
  const labels = picks.map((w, k) => ({
    x: box.left + w * slot + slot / 2,
    value: label(ends[w]!),
    anchor: edgeAnchor(k, picks.length),
  }));

  const note = `Weekly sums of npm's daily counts, ${plural(count, 'week')} to ${npm.latest}`;
  return svgDocument(theme, title, `${title}: daily npm counts summed per week, stacked by package.`, [
    ...heading(title, note, theme, keys, titled, 'Weekly, from npm daily counts'),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(labels, box.bottom + 20, theme),
    ...bars,
  ]);
}
