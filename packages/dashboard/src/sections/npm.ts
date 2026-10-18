// npm downloads: the daily counts of the configured packages, stacked on a zoomable chart, with the
// combined tiles and a table per package. Shown only when the dataset has npm figures.

import type { Dataset } from '@github-stats-action/core';
import { esc, f0, sgn } from '../format';
import { npmDaily } from '../model';
import { colorVar } from '../palette';
import { legendHtml, makeSection, type Section } from './common';
import { wireDailyChart } from './daily-chart';

export function npm(d: Dataset): Section | null {
  const data = d.npm;
  if (!data) return null;
  const { start, series } = npmDaily(data);

  const tile = (label: string, value: number, change: string): string =>
    `<div class="kpi"><div class="l">${esc(label)}</div><div class="v">${f0(value)}</div><div class="d">${change}</div></div>`;
  const tiles =
    tile('npm downloads, last 30 days', data.totals.last30,
      `<b class="${data.totals.lastDay > 0 ? 'pos' : ''}">${sgn(data.totals.lastDay)}</b> on <span class="nw">${esc(data.latest)}</span>`) +
    tile('npm downloads, stored', data.totals.all, `since <span class="nw">${esc(data.first)}</span>`);

  // the day columns are `optional`: a phone hides them so the counts fit
  const row = (label: string, extra: string, t: { lastDay: number; last7: number; last30: number; all: number }, first: string): string =>
    `<tr><td>${label}${extra}</td><td class="optional">${f0(t.lastDay)}</td><td>${f0(t.last7)}</td><td>${f0(t.last30)}</td><td>${f0(t.all)}</td><td class="optional">${esc(first)}</td></tr>`;
  const table = `<thead><tr><th>Package</th><th class="optional">Last day</th><th>Last 7 days</th><th>Last 30 days</th><th>Stored total</th><th class="optional">First day</th></tr></thead><tbody>` +
    data.packages
      .map((p) => row(esc(p.label), p.label === p.package ? '' : `<small>${esc(p.package)}</small>`, p.totals, p.first))
      .join('') +
    row('Total', '', data.totals, data.first) +
    '</tbody>';

  const el = makeSection(
    `<div><h2>npm downloads<span class="est meas">measured</span></h2>` +
    `<p class="note">Daily npm downloads, stacked by package, on UTC days; the latest day is the last complete one. npm keeps 18 months of daily counts, so the first run backfills that window, and days stored before it stay here.</p></div>` +
    `<div class="kpis">${tiles}</div>` +
    `<div class="presets"><span class="group" data-presets></span></div>` +
    legendHtml(data.packages.map((p) => ({ label: p.label, color: colorVar(p) }))) +
    `<div class="scroll"><svg data-chart role="img" aria-label="npm downloads per day, stacked by package"></svg></div>` +
    `<div class="scroll"><svg data-strip role="img" aria-label="Overview of the whole npm series with the range shown above"></svg></div>` +
    `<div class="scroll"><table class="npm-table">${table}</table></div>`,
  );
  const redraw = wireDailyChart(el, {
    start,
    series: data.packages.map((p, j) => ({ label: p.label, color: colorVar(p), values: series[j] ?? [] })),
    stacked: true,
    // beyond four packages the end labels pile up, so the legend names them alone
    directLabels: data.packages.length <= 4,
    id: 'npm',
    describe: (v) => `${f0(v)} downloads`,
  });
  return { el, redraw };
}
