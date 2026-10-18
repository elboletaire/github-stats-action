// Cumulative stars over time: one area and line in the first slot, the count at the end. Even spacing
// (the default) puts evenly spaced star counts at equal steps; time spacing puts each day at its date.

import type { Dataset, StarPoint } from '@github-stats-action/core';
import { TYPE, monotonePath, sampleStars, sampleTicks, starsSpacing, type CurvePoint } from '@github-stats-action/core';
import {
  areaGradient,
  compact,
  dayOf,
  edgeAnchor,
  emptyNote,
  endDot,
  esc,
  finite,
  heading,
  ink,
  timeLabel,
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
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Theme,
} from './svg';

const boxOf = (titled: boolean): Box => ({ left: PLOT_LEFT, right: WIDTH - PAD, top: plotTop(titled), bottom: 252 });

/** The least gap between two axis labels, so they never run into each other. */
const LABEL_GAP = 44;

export function starsChart(dataset: Dataset, theme: Theme): string {
  const title = 'Stars over time';
  const even = starsSpacing(dataset.charts) === 'even';
  const titled = showTitle(dataset, 'stars');
  const box = boxOf(titled);
  const note = even ? 'Cumulative stargazers, samples evenly spaced by star count' : 'Cumulative stargazers, one point per day';
  const [head] = dataset.stars;
  const last = dataset.stars.at(-1);

  if (!head || !last) {
    const message = dataset.totals.stars === 0 ? 'No stars yet' : 'No stargazer history';
    return svgDocument(theme, title, `${title}: ${message}.`, [...heading(title, note, theme, [], titled), emptyNote(message, box, theme)]);
  }

  const ticks = niceTicks(last.stars);
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);
  const color = seriesColor(theme, 0);
  const shared = { title, note, theme, titled, box, yOf, color, ticks, last };

  if (even) return evenChart(dataset, shared);

  const first = dayOf(head.date);
  const span = dayOf(last.date) - first;
  const xOf = (day: number): number =>
    span > 0 ? box.left + ((finite(day) - first) / span) * (box.right - box.left) : (box.left + box.right) / 2;

  // the count only changes on some days: a day inside a flat run adds nothing to the line, so it is left out
  const kept = dataset.stars.filter((p, i, all) => {
    const prev = all[i - 1];
    const next = all[i + 1];
    return !prev || !next || prev.stars !== p.stars || next.stars !== p.stars;
  });
  const line = kept.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(xOf(dayOf(p.date)))} ${px(yOf(p.stars))}`).join('');
  const lastX = xOf(dayOf(last.date));

  const marks = span > 0 ? [0, 1, 2, 3].map((k) => first + (span * k) / 3) : [first];
  const label = timeLabel(span);
  const axisLabels = marks.map((day, k) => ({ x: xOf(day), value: label(day), anchor: edgeAnchor(k, marks.length) }));

  return svgDocument(theme, title, `${title}: ${last.stars} stargazers on ${last.date}.`, [
    `<defs>${areaGradient('stars-fade', color)}</defs>`,
    ...heading(title, note, theme, [], titled),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(axisLabels, box.bottom + 20, theme),
    `<path d="${line}L${px(lastX)} ${px(box.bottom)}L${px(xOf(first))} ${px(box.bottom)}Z" fill="url(#stars-fade)"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...endLabel(lastX, yOf(last.stars), last, color, theme, box),
    ...hoverStrips(dataset, xOf, box),
  ]);
}

interface Shared {
  title: string;
  note: string;
  theme: Theme;
  titled: boolean;
  box: Box;
  yOf: (v: number) => number;
  color: string;
  ticks: number[];
  last: StarPoint;
}

// Even spacing: the samples sit at equal steps by index, joined by a monotone curve with a dot on each.
function evenChart(dataset: Dataset, s: Shared): string {
  const { box, theme, color, title } = s;
  const samples = sampleStars(dataset.stars);
  const n = samples.length;
  const step = n > 1 ? (box.right - box.left) / (n - 1) : box.right - box.left;
  const xs = samples.map((_, i) => (n > 1 ? box.left + i * step : (box.left + box.right) / 2));
  const points: CurvePoint[] = samples.map((p, i) => [xs[i]!, s.yOf(p.stars)]);
  const line = monotonePath(points);
  const lastX = xs[n - 1]!;

  const minGap = n > 1 ? Math.max(1, Math.ceil(LABEL_GAP / step)) : 1;
  const axisLabels = sampleTicks(samples, minGap).map((t) => ({
    x: xs[t.index]!,
    value: t.label,
    anchor: t.index === 0 ? ('start' as const) : t.index === n - 1 ? ('end' as const) : ('middle' as const),
  }));

  const dots = samples.slice(0, -1).map((p, i) => {
    const tip = `${p.date}: ${plural(p.stars, 'star')}`;
    return `<circle cx="${px(xs[i]!)}" cy="${px(s.yOf(p.stars))}" r="3" fill="${color}" stroke="${ink(theme).surface}" stroke-width="2"><title>${esc(tip)}</title></circle>`;
  });
  const hover = samples.map((p, i) => {
    const width = n > 1 ? step : box.right - box.left;
    const left = n > 1 ? Math.max(box.left, xs[i]! - step / 2) : box.left;
    return `<rect x="${px(left)}" y="${box.top}" width="${px(width)}" height="${box.bottom - box.top}" fill-opacity="0"><title>${esc(p.date)}: ${plural(p.stars, 'star')}</title></rect>`;
  });

  return svgDocument(theme, title, `${title}: ${s.last.stars} stargazers on ${s.last.date}.`, [
    `<defs>${areaGradient('stars-fade', color)}</defs>`,
    ...heading(title, s.note, theme, [], s.titled),
    ...valueAxis(s.ticks, s.yOf, box, theme),
    ...xLabels(axisLabels, box.bottom + 20, theme),
    `<path d="${line}L${px(lastX)} ${px(box.bottom)}L${px(xs[0]!)} ${px(box.bottom)}Z" fill="url(#stars-fade)"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...dots,
    ...endLabel(lastX, s.yOf(s.last.stars), s.last, color, theme, box),
    ...hover,
  ]);
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

const STRIP = 4;

// Hover targets along the line: one transparent strip per 4px, titled with the last day in it,
// so a tooltip is at most a few px from any point without a rect per day.
function hoverStrips(dataset: Dataset, xOf: (day: number) => number, box: Box): string[] {
  const strips = new Map<number, { date: string; stars: number }>();
  for (const p of dataset.stars) strips.set(Math.floor((xOf(dayOf(p.date)) - box.left) / STRIP), { date: p.date, stars: p.stars });
  const height = box.bottom - box.top;
  return [...strips].map(([bucket, p]) => {
    const left = box.left + bucket * STRIP;
    return `<rect x="${left}" y="${box.top}" width="${STRIP}" height="${height}" fill-opacity="0"><title>${esc(p.date)}: ${plural(p.stars, 'star')}</title></rect>`;
  });
}
