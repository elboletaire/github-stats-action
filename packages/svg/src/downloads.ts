// Downloads per day: measured bars by group when there are enough measured days, otherwise the
// estimated per-day series by group as stacked areas. The note says which one it is.

import type { Dataset } from '@github-stats-action/core';
import { MARK } from '@github-stats-action/core';
import {
  areaGradient,
  barWidth,
  dayOf,
  edgeAnchor,
  emptyNote,
  finite,
  heading,
  timeLabel,
  niceTicks,
  PAD,
  PLOT_LEFT,
  plural,
  px,
  sample,
  seriesColor,
  stack,
  svgDocument,
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Key,
  type Segment,
  type Theme,
} from './svg';

/** Measured bars need at least this many snapshot days; before that the estimate is shown. */
export const MIN_MEASURED_DAYS = 14;

const box: Box = { left: PLOT_LEFT, right: WIDTH - PAD, top: 80, bottom: 252 };
const title = 'Downloads per day';

export function downloadsPerDayChart(dataset: Dataset, theme: Theme): string {
  const keys: Key[] = dataset.groups.map((g) => ({ label: g.label, color: seriesColor(theme, g.color) }));
  const measured = dataset.measuredDaily.length;
  if (measured >= MIN_MEASURED_DAYS) return measuredBars(dataset, theme, keys);
  const note = `Estimated, spread over each release's live window (measured needs ${MIN_MEASURED_DAYS} days, have ${plural(measured, 'day')})`;
  return estimatedAreas(dataset, theme, keys, note);
}

function measuredBars(dataset: Dataset, theme: Theme, keys: Key[]): string {
  const days = dataset.measuredDaily;
  const totals = days.map((d) => dataset.groups.reduce((sum, g) => sum + finite(d.groups[g.name] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);

  const slot = (box.right - box.left) / days.length;
  const width = barWidth(slot);
  const bars = days.flatMap((d, i) => {
    const x = box.left + i * slot + (slot - width) / 2;
    const span = d.days > 1 ? ` (${d.days} days)` : '';
    const segments: Segment[] = dataset.groups.map((g) => {
      const value = finite(d.groups[g.name] ?? 0);
      return { value, color: seriesColor(theme, g.color), title: `${d.date}, ${g.label}: ${value}${span}` };
    });
    return stack(x, width, yOf, segments);
  });

  const picks = sample(days.length);
  const labels = picks.map((i, k) => ({
    x: box.left + i * slot + slot / 2,
    value: days[i]?.date ?? '',
    anchor: edgeAnchor(k, picks.length),
  }));

  const note = `Measured, change between daily snapshots (${plural(days.length, 'day')})`;
  return svgDocument(theme, title, `${title}: measured from daily snapshots.`, [
    ...heading(title, note, theme, keys),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(labels, box.bottom + 20, theme),
    ...bars,
  ]);
}

function estimatedAreas(dataset: Dataset, theme: Theme, keys: Key[], note: string): string {
  const { estimatedDaily } = dataset;
  const count = Math.max(0, ...dataset.groups.map((g) => estimatedDaily.groups[g.name]?.length ?? 0));
  const start = dayOf(estimatedDaily.start);
  const valueOf = (name: string, i: number): number => finite(estimatedDaily.groups[name]?.[i] ?? 0);

  const sums = Array.from({ length: count }, (_, i) => dataset.groups.reduce((sum, g) => sum + valueOf(g.name, i), 0));
  const ticks = niceTicks(Math.max(0, ...sums));
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);
  const xOf = (i: number): number => (count > 1 ? box.left + (i / (count - 1)) * (box.right - box.left) : (box.left + box.right) / 2);

  // Each group is a band stacked on the ones before it, its line along the top. A lone band fades to the
  // baseline; stacked bands each take a flat wash, since fades on top of each other blur into one.
  const stacked = dataset.groups.filter((g) => (estimatedDaily.groups[g.name] ?? []).some((v) => v > 0)).length > 1;
  let lower = new Array<number>(count).fill(0);
  const defs: string[] = [];
  const areas: string[] = [];
  dataset.groups.forEach((g, k) => {
    const base = lower;
    const upper = base.map((v, i) => v + valueOf(g.name, i));
    lower = upper;
    if (!upper.some((v, i) => v > (base[i] ?? 0))) return;
    const color = seriesColor(theme, g.color);
    const id = `day-fade-${k}`;
    if (!stacked) defs.push(areaGradient(id, color));
    areas.push(areaShape(xOf, yOf, upper, base, color, stacked ? `${color}" fill-opacity="${MARK.areaStack}` : `url(#${id})`));
  });

  const marks = sample(count);
  const label = timeLabel(count);
  const labels = marks.map((i, k) => ({ x: xOf(i), value: label(start + i), anchor: edgeAnchor(k, marks.length) }));

  const body =
    count === 0
      ? [emptyNote('No downloads yet', box, theme)]
      : [...(defs.length ? [`<defs>${defs.join('')}</defs>`] : []), ...valueAxis(ticks, yOf, box, theme), ...xLabels(labels, box.bottom + 20, theme), ...areas];

  return svgDocument(theme, title, `${title}: estimated per day by group.`, [...heading(title, note, theme, keys), ...body]);
}

// The band between `base` and `upper`, filled with `fill` (a colour or a gradient reference), with a 2px line
// along `upper`. A point on a straight run (equal to both neighbours on both edges) is dropped; the shape is unchanged.
function areaShape(xOf: (i: number) => number, yOf: (v: number) => number, upper: number[], base: number[], color: string, fill: string): string {
  const bends = (a: number[], i: number): boolean => a[i] !== a[i - 1] || a[i] !== a[i + 1];
  const kept = upper.map((_, i) => i).filter((i) => bends(upper, i) || bends(base, i));
  const top = kept.map((i, k) => `${k === 0 ? 'M' : 'L'}${px(xOf(i))} ${px(yOf(upper[i] ?? 0))}`).join('');
  const bottom = kept.map((i) => `L${px(xOf(i))} ${px(yOf(base[i] ?? 0))}`).reverse().join('');
  return [
    `<path d="${top}${bottom}Z" fill="${fill}"/>`,
    `<path d="${top}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
  ].join('');
}
