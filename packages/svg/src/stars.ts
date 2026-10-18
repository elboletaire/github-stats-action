// Cumulative stars over time: one area and line in the first slot, the count at the end.

import type { Dataset } from '@github-stats-action/core';
import {
  dayOf,
  esc,
  finite,
  heading,
  monthLabel,
  niceTicks,
  px,
  seriesColor,
  svgDocument,
  svgText,
  valueAxis,
  WIDTH,
  xLabels,
  ink,
  compact,
  type Box,
  type Theme,
} from './svg';

const box: Box = { left: 56, right: WIDTH - 24, top: 72, bottom: 256 };

export function starsChart(dataset: Dataset, theme: Theme): string {
  const title = 'Stars over time';
  const note = 'Cumulative stargazers, one point per day';
  const [head] = dataset.stars;
  const last = dataset.stars.at(-1);
  const c = ink(theme);

  if (!head || !last) {
    const message = dataset.totals.stars === 0 ? 'No stars yet' : 'No stargazer history';
    return svgDocument(theme, title, `${title}: ${message}.`, [
      ...heading(title, note, theme),
      svgText({ x: WIDTH / 2, y: (box.top + box.bottom) / 2, value: message, fill: c.secondary, anchor: 'middle', size: 13 }),
    ]);
  }

  const first = dayOf(head.date);
  const span = dayOf(last.date) - first;
  const xOf = (day: number): number =>
    span > 0 ? box.left + ((finite(day) - first) / span) * (box.right - box.left) : (box.left + box.right) / 2;

  const ticks = niceTicks(last.stars);
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);

  const color = seriesColor(theme, 0);
  const points = dataset.stars.map((p) => `${xOf(dayOf(p.date)).toFixed(1)},${yOf(p.stars).toFixed(1)}`);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join('');
  const lastX = xOf(dayOf(last.date));
  const lastY = yOf(last.stars);

  const marks = span > 0 ? [0, 1, 2, 3].map((k) => first + (span * k) / 3) : [first];
  const axisLabels = marks.map((day, k) => ({
    x: xOf(day),
    value: monthLabel(day),
    anchor: marks.length === 1 || (k > 0 && k < marks.length - 1) ? ('middle' as const) : k === 0 ? ('start' as const) : ('end' as const),
  }));

  return svgDocument(theme, title, `${title}: ${last.stars} stargazers on ${last.date}.`, [
    ...heading(title, note, theme),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(axisLabels, box.bottom + 16, theme),
    `<path d="${line}L${px(lastX)} ${px(box.bottom)}L${px(xOf(first))} ${px(box.bottom)}Z" fill="${color}" fill-opacity="0.1"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<circle cx="${px(lastX)}" cy="${px(lastY)}" r="4" fill="${color}" stroke="${c.surface}" stroke-width="2"><title>${esc(last.date)}: ${last.stars} stars</title></circle>`,
    svgText({ x: lastX - 8, y: lastY - 8, value: compact(last.stars), fill: c.primary, anchor: 'end' }),
    ...hoverStrips(dataset, xOf, box),
  ]);
}

const STRIP = 4;

// Hover targets along the line: one transparent strip per 4px, titled with the last day in it,
// so a tooltip is at most a few px from any point without a rect per day.
function hoverStrips(dataset: Dataset, xOf: (day: number) => number, box: Box): string[] {
  const strips = new Map<number, { x: number; date: string; stars: number }>();
  for (const p of dataset.stars) {
    const x = xOf(dayOf(p.date));
    strips.set(Math.floor((x - box.left) / STRIP), { x, date: p.date, stars: p.stars });
  }
  return [...strips].map(([bucket, p]) => {
    const left = box.left + bucket * STRIP;
    return `<rect x="${px(left)}" y="${px(box.top)}" width="${STRIP}" height="${box.bottom - box.top}" fill-opacity="0"><title>${esc(p.date)}: ${p.stars} stars</title></rect>`;
  });
}
