// Stars over time: the cumulative count per day, with a table of each month's last value.

import type { Dataset } from '@github-stats-action/core';
import { dayAxis } from '../days';
import { esc, f0 } from '../format';
import { colorVar } from '../palette';
import { drawTimeline } from '../timeline';
import { makeSection, type Section } from './common';

export function stars(d: Dataset): Section {
  const points = d.stars;
  if (points.length === 0) {
    return { el: makeSection('<div><h2>Stars over time</h2><p class="note">No stargazers collected yet.</p></div>') };
  }
  const axis = dayAxis(points[0]!.date);
  const xs = points.map((p) => axis.indexOf(Date.parse(`${p.date}T00:00:00Z`)));
  const values = points.map((p) => p.stars);

  // the last point of each month is the month's count
  const months = new Map<string, { date: string; stars: number }>();
  for (const p of points) months.set(p.date.slice(0, 7), p);
  const table = `<thead><tr><th>Month</th><th>Stars at month end</th></tr></thead><tbody>` +
    [...months.values()].map((p) => `<tr><td>${esc(p.date.slice(0, 7))}</td><td>${f0(p.stars)}</td></tr>`).join('') + '</tbody>';

  const el = makeSection(
    `<div><h2>Stars over time</h2><p class="note">Cumulative stars at the end of each UTC day, from the stargazers' timestamps. Hover for a day.</p></div>` +
    `<div class="scroll"><svg role="img" aria-label="Cumulative stars over time"></svg></div>` +
    `<details><summary>Table view</summary><div class="scroll"><table>${table}</table></div></details>`,
  );
  const svg = el.querySelector('svg') as SVGSVGElement;
  return {
    el,
    redraw: () => drawTimeline(svg, { xs, axis, series: [{ label: 'Stars', color: colorVar({ color: 0 }), values }], unit: 'stars' }),
  };
}
