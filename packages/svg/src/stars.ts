// Cumulative stars over time on a linear time axis, from the first star to today. About 30 samples sit at
// their dates, joined by a monotone curve with a dot on each, over a fade to the baseline.

import type { Dataset, StarPoint } from '@github-stats-action/core';
import { TYPE, monotonePath, sampleStars, type CurvePoint } from '@github-stats-action/core';
import {
  areaGradient,
  compact,
  DAY_MS,
  dayOf,
  emptyNote,
  endDot,
  esc,
  finite,
  heading,
  ink,
  monthLabel,
  niceTicks,
  PAD,
  PLOT_LEFT,
  plotTop,
  plural,
  px,
  seriesColor,
  showTitle,
  svgDocument,
  svgText,
  timeLabel,
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Theme,
} from './svg';
import { windowed, windowSet } from './window';

const boxOf = (titled: boolean): Box => ({ left: PLOT_LEFT, right: WIDTH - PAD, top: plotTop(titled), bottom: 252 });

/** The least gap between two axis labels, so they never run into each other. */
const LABEL_GAP = 44;
/** Spans up to this many days label only their two ends, with days. */
const DAY_LABELS_SPAN = 120;
/** From this many days the axis labels years, below it months. */
const YEAR_SPAN = 365;

interface AxisLabel {
  x: number;
  value: string;
  anchor: 'start' | 'middle' | 'end';
}

export function starsChart(all: Dataset, theme: Theme): string {
  const dataset = windowed(all, 'stars');
  const title = 'Stars over time';
  const note = 'Cumulative stargazers';
  const titled = showTitle(dataset, 'stars');
  const box = boxOf(titled);
  const [head] = dataset.stars;
  const last = dataset.stars.at(-1);

  if (!head || !last) {
    const message = all.totals.stars === 0 ? 'No stars yet' : windowSet(all, 'stars') ? 'No stars in this window' : 'No stargazer history';
    return svgDocument(theme, title, `${title}: ${message}.`, [...heading(title, note, theme, [], titled), emptyNote(message, box, theme)]);
  }

  // the peak, not the last count: a dip (stars removed) must stay on the plot
  const peak = Math.max(...dataset.stars.map((p) => p.stars));
  const ticks = niceTicks(peak);
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);
  const color = seriesColor(theme, 0);

  const first = dayOf(head.date);
  const end = dayOf(last.date);
  const span = end - first;
  const xOf = (day: number): number =>
    span > 0 ? box.left + ((finite(day) - first) / span) * (box.right - box.left) : (box.left + box.right) / 2;

  const samples = sampleStars(dataset.stars);
  const xs = samples.map((p) => xOf(dayOf(p.date)));
  const points: CurvePoint[] = samples.map((p, i) => [xs[i]!, yOf(p.stars)]);
  const line = monotonePath(points);
  const lastX = xs[xs.length - 1]!;
  const dots = samples.slice(0, -1).map((p, i) => {
    const tip = `${p.date}: ${plural(p.stars, 'star')}`;
    return `<circle cx="${px(xs[i]!)}" cy="${px(yOf(p.stars))}" r="3" fill="${color}" stroke="${ink(theme).surface}" stroke-width="2"><title>${esc(tip)}</title></circle>`;
  });
  const hover = samples.map((p, i) => {
    // each sample owns the plot up to the midpoints with its neighbours, so a tooltip is never far from a point
    const left = i === 0 ? box.left : (xs[i - 1]! + xs[i]!) / 2;
    const right = i === samples.length - 1 ? box.right : (xs[i]! + xs[i + 1]!) / 2;
    return `<rect x="${px(left)}" y="${box.top}" width="${px(right - left)}" height="${box.bottom - box.top}" fill-opacity="0"><title>${esc(p.date)}: ${plural(p.stars, 'star')}</title></rect>`;
  });

  return svgDocument(theme, title, `${title}: ${last.stars} stargazers on ${last.date}.`, [
    `<defs>${areaGradient('stars-fade', color)}</defs>`,
    ...heading(title, note, theme, [], titled),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(timeAxis(first, end, xOf), box.bottom + 20, theme),
    `<path d="${line}L${px(lastX)} ${px(box.bottom)}L${px(xs[0]!)} ${px(box.bottom)}Z" fill="url(#stars-fade)"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...dots,
    ...endLabel(lastX, yOf(last.stars), last, color, theme, box),
    ...hover,
  ]);
}

/** The labels of a linear time axis: both ends, then each January (or month start under a year) clear of its neighbours. */
function timeAxis(first: number, last: number, xOf: (day: number) => number): AxisLabel[] {
  const label = timeLabel(last - first);
  if (last <= first) return [{ x: xOf(first), value: label(first), anchor: 'middle' }];
  const yearly = last - first >= YEAR_SPAN;
  const inner: AxisLabel[] = [];
  if (last - first > DAY_LABELS_SPAN) {
    const from = new Date(first * DAY_MS);
    const to = new Date(last * DAY_MS);
    const startMonth = from.getUTCFullYear() * 12 + from.getUTCMonth();
    const endMonth = to.getUTCFullYear() * 12 + to.getUTCMonth();
    for (let m = startMonth + 1; m <= endMonth; m++) {
      if (yearly && m % 12 !== 0) continue;
      const day = Date.UTC(Math.floor(m / 12), m % 12, 1) / DAY_MS;
      if (day <= first || day >= last) continue;
      const value = yearly ? String(Math.floor(m / 12)) : m % 12 === 0 ? monthLabel(day) : monthLabel(day).slice(0, 3);
      inner.push({ x: xOf(day), value, anchor: 'middle' });
    }
  }
  const x1 = xOf(last);
  const shown: AxisLabel[] = [{ x: xOf(first), value: label(first), anchor: 'start' }];
  for (const tick of inner) {
    if (tick.x - shown[shown.length - 1]!.x >= LABEL_GAP && x1 - tick.x >= LABEL_GAP) shown.push(tick);
  }
  shown.push({ x: x1, value: label(last), anchor: 'end' });
  return shown;
}

// The end dot and the count above it, inside the plot: to the left of the dot when the label would run past the right edge.
function endLabel(lastX: number, lastY: number, last: StarPoint, color: string, theme: Theme, box: Box): string[] {
  const count = compact(last.stars);
  const labelX = lastX + 8 + count.length * 8 > box.right ? lastX - 8 : lastX + 8;
  const labelAnchor = labelX < lastX ? 'end' : 'start';
  return [
    endDot(lastX, lastY, color, theme, `${last.date}: ${plural(last.stars, 'star')}`),
    svgText({ x: labelX, y: Math.max(box.top + 10, lastY - 10), value: count, fill: ink(theme).primary, anchor: labelAnchor, size: TYPE.md, weight: 600 }),
  ];
}
