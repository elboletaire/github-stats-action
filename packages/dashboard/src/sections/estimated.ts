// Estimated downloads per day: a zoomable line chart over an overview strip, with presets and a table view.

import type { Dataset } from '@github-stats-action/core';
import { dayAxis } from '../days';
import { esc, f1 } from '../format';
import { countedGroups } from '../model';
import { colorVar } from '../palette';
import { makeSection, legendHtml, type Section } from './common';
import { wireDailyChart } from './daily-chart';

export function estimated(d: Dataset): Section {
  const groups = countedGroups(d);
  const series = groups.map((g) => d.estimatedDaily.groups[g.name] ?? []);
  const n = Math.max(0, ...series.map((s) => s.length));
  if (n === 0) return { el: makeSection('<div><h2>Downloads per day over time</h2><p class="note">Nothing to estimate yet.</p></div>') };
  const axis = dayAxis(d.estimatedDaily.start);

  const table = `<thead><tr><th>Day</th>${groups.map((g) => `<th>${esc(g.label)}</th>`).join('')}</tr></thead><tbody>` +
    Array.from({ length: n }, (_, i) => `<tr><td>${esc(axis.long(i))}</td>${series.map((s) => `<td>${f1(s[i] ?? 0)}</td>`).join('')}</tr>`).join('') +
    '</tbody>';
  const el = makeSection(
    `<div><h2>Downloads per day over time<span class="est">estimated</span></h2>` +
    `<p class="note">Uniform-spread estimate: a release's downloads are assumed to arrive at a constant rate while it was the latest release, so the lines step at each release and cannot show spikes inside a window. Hover for a day. Drag the strip below to choose the range; wheel or pinch over the chart to zoom, double-click to reset.</p></div>` +
    `<div class="presets"><span class="group" data-presets></span></div>` +
    legendHtml(groups.map((g) => ({ label: g.label, color: colorVar(g) }))) +
    `<div class="scroll"><svg data-chart role="img" aria-label="Estimated downloads per day over time, by group"></svg></div>` +
    `<div class="scroll"><svg data-strip role="img" aria-label="Overview of the whole series with the range shown above"></svg></div>` +
    `<details><summary>Table view</summary><div class="scroll"><table>${table}</table></div></details>`,
  );
  const redraw = wireDailyChart(el, {
    start: d.estimatedDaily.start,
    series: groups.map((g, j) => ({ label: g.label, color: colorVar(g), values: series[j] ?? [] })),
    stacked: false,
    directLabels: true,
    id: 'estimated',
    describe: (v) => `${f1(v)}/day (est.)`,
  });
  return { el, redraw };
}
