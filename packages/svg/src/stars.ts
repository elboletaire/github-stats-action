// Cumulative stars over time: one area and line in the first slot, the count at the end.

import type { Dataset } from '@github-stats-action/core';
import { TYPE } from '@github-stats-action/core';
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
  plural,
  px,
  seriesColor,
  svgDocument,
  svgText,
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Theme,
} from './svg';

const box: Box = { left: PLOT_LEFT, right: WIDTH - PAD, top: 80, bottom: 252 };

export function starsChart(dataset: Dataset, theme: Theme): string {
  const title = 'Stars over time';
  const note = 'Cumulative stargazers, one point per day';
  const [head] = dataset.stars;
  const last = dataset.stars.at(-1);
  const c = ink(theme);

  if (!head || !last) {
    const message = dataset.totals.stars === 0 ? 'No stars yet' : 'No stargazer history';
    return svgDocument(theme, title, `${title}: ${message}.`, [...heading(title, note, theme), emptyNote(message, box, theme)]);
  }

  const first = dayOf(head.date);
  const span = dayOf(last.date) - first;
  const xOf = (day: number): number =>
    span > 0 ? box.left + ((finite(day) - first) / span) * (box.right - box.left) : (box.left + box.right) / 2;

  const ticks = niceTicks(last.stars);
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);

  const color = seriesColor(theme, 0);
  // the count only changes on some days: a day inside a flat run adds nothing to the line, so it is left out
  const kept = dataset.stars.filter((p, i, all) => {
    const prev = all[i - 1];
    const next = all[i + 1];
    return !prev || !next || prev.stars !== p.stars || next.stars !== p.stars;
  });
  const line = kept.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(xOf(dayOf(p.date)))} ${px(yOf(p.stars))}`).join('');
  const lastX = xOf(dayOf(last.date));
  const lastY = yOf(last.stars);

  const marks = span > 0 ? [0, 1, 2, 3].map((k) => first + (span * k) / 3) : [first];
  const label = timeLabel(span);
  const axisLabels = marks.map((day, k) => ({ x: xOf(day), value: label(day), anchor: edgeAnchor(k, marks.length) }));

  // the end label sits above the dot, inside the plot: to its left when it would run past the right edge
  const count = compact(last.stars);
  const labelX = lastX + 8 + count.length * 8 > box.right ? lastX - 8 : lastX + 8;
  const labelAnchor = labelX < lastX ? 'end' : 'start';

  return svgDocument(theme, title, `${title}: ${last.stars} stargazers on ${last.date}.`, [
    `<defs>${areaGradient('a', color)}</defs>`,
    ...heading(title, note, theme),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(axisLabels, box.bottom + 20, theme),
    `<path d="${line}L${px(lastX)} ${px(box.bottom)}L${px(xOf(first))} ${px(box.bottom)}Z" fill="url(#a)"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    endDot(lastX, lastY, color, theme, `${last.date}: ${plural(last.stars, 'star')}`),
    svgText({ x: labelX, y: Math.max(box.top + 10, lastY - 10), value: count, fill: c.primary, anchor: labelAnchor, size: TYPE.md, weight: 600 }),
    ...hoverStrips(dataset, xOf, box),
  ]);
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
