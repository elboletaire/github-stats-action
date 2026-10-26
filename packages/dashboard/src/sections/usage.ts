// Usage: the Cloudflare Analytics Engine figures, approximate daily users (Total, and each value of the primary
// dimension) on a zoomable chart with a share table per dimension, and a stacked daily chart per dimension that
// asks for one. Shown only when the dataset has Cloudflare figures; every users figure is approximate.

import { animates, cloudflareDimensionSeries, cloudflareValueLabel, type CloudflareData, type CloudflareDimensionInfo, type CloudflareShare, type Dataset } from '@github-stats-action/core';
import { esc, f0, percent } from '../format';
import { cloudflareDaily } from '../model';
import { colorVar } from '../palette';
import { legendHtml, makeSection, type Section } from './common';
import { wireDailyChart, type DailySeries } from './daily-chart';

/** A dimension drawn as stacked daily lines, with its series on the day axis. */
type DimensionChart = { dimension: CloudflareDimensionInfo; series: DailySeries[] };

/** The dimensions that ask for a daily chart, with their lines; a dimension without lines has no chart. */
function dimensionCharts(cf: CloudflareData): DimensionChart[] {
  return cf.dimensions
    .filter((dimension) => dimension.chart)
    .map((dimension) => ({
      dimension,
      series: cloudflareDaily(cf, cloudflareDimensionSeries(cf, dimension.name)).lines.map((line, i) => ({
        label: line.label,
        color: colorVar({ color: i }),
        values: line.values,
      })),
    }))
    .filter(({ series }) => series.length > 0);
}

/** A share's translation cell: yes or not yet for a supported dimension, blank for the folded `other` row. */
function translated(share: CloudflareShare): string {
  if (share.supported === undefined) return '<td></td>';
  return share.supported ? '<td>yes</td>' : '<td class="pending">not yet</td>';
}

/** The section's markup without its charts' data: the tile, the chart frames, one table per dimension and the note. */
export function usageHtml(cf: CloudflareData, charts: DimensionChart[] = dimensionCharts(cf)): string {
  const { totals } = cf;
  const other = cf.primary
    ? `<div class="d">plus ${f0(totals.otherEvents7)} ${esc(cf.label.toLowerCase())} outside ${esc(cf.primary.dimension)} ${esc(cf.primary.value)}, last 7 days</div>`
    : '';
  const tile = `<div class="kpi"><div class="l">Daily users</div><div class="v">${f0(totals.usersAvg7)}</div><div class="d">7-day average, approx.</div>${other}</div>`;

  const tables = cf.dimensions.map((dimension) => {
    const shares = cf.shares[dimension.name] ?? [];
    const events = shares.reduce((sum, s) => sum + s.events, 0);
    const supported = Boolean(dimension.supported);
    const body = shares.length
      ? `<div class="scroll"><table><thead><tr><th>Value</th><th>Users (approx.)</th><th>Events</th><th>Share</th>${supported ? '<th>Translated</th>' : ''}</tr></thead><tbody>` +
        shares
          .map((s) => {
            const cells = `<td>${esc(cloudflareValueLabel(dimension, s.value))}</td><td>${f0(s.users)}</td><td>${f0(s.events)}</td><td>${percent(s.events, events)}</td>`;
            return `<tr>${cells}${supported ? translated(s) : ''}</tr>`;
          })
          .join('') +
        `</tbody></table></div>`
      : '<p class="note">No events in the last 30 days.</p>';
    return `<div><h3>${esc(dimension.label)}, last 30 days</h3></div>` + body;
  });

  const chartMarkup = charts.map(({ dimension, series }) =>
    `<div data-dimension-chart="${dimension.name}"><h3>${esc(dimension.label)}, daily users (approx.)</h3>` +
    `<div class="presets"><span class="group" data-presets></span></div>` +
    legendHtml(series.map((s) => ({ label: s.label, color: s.color }))) +
    `<div class="scroll"><svg data-chart role="img" aria-label="${esc(dimension.label)} approximate daily users per day, stacked"></svg></div>` +
    `<div class="scroll"><svg data-strip role="img" aria-label="Overview of the whole ${esc(dimension.label)} series with the range shown above"></svg></div></div>`,
  );

  return (
    `<div><h2>Usage<span class="est">approximate</span></h2>` +
    `<p class="note">Daily users from Cloudflare Analytics Engine, on UTC days; users are approximate counts, and the latest day is the last complete one. Hover for a day. Drag the strip below to choose the range; wheel or pinch over the chart to zoom, double-click to reset.</p></div>` +
    `<div class="kpis">${tile}</div>` +
    `<div data-main-chart><div class="presets"><span class="group" data-presets></span></div>` +
    `<div class="scroll"><svg data-chart role="img" aria-label="Approximate daily users per day"></svg></div>` +
    `<div class="scroll"><svg data-strip role="img" aria-label="Overview of the whole series with the range shown above"></svg></div></div>` +
    chartMarkup.join('') +
    tables.join('') +
    (cf.note ? `<p class="note">${esc(cf.note)}</p>` : '')
  );
}

export function usage(d: Dataset): Section | null {
  const cf = d.cloudflare;
  if (!cf) return null;
  const { start, lines } = cloudflareDaily(cf);
  const charts = dimensionCharts(cf);
  const el = makeSection(usageHtml(cf, charts));
  const animate = animates(d.charts, 'cloudflare-users');
  const redraws = [
    wireDailyChart(el.querySelector('[data-main-chart]') as HTMLElement, {
      start,
      series: lines.map((line, i) => ({
        label: i === 0 ? `${line.label} (approx.)` : line.label,
        color: colorVar({ color: i }),
        values: line.values,
      })),
      stacked: false,
      // beyond four lines the end labels pile up
      directLabels: lines.length <= 4,
      id: 'usage',
      animate,
      describe: (v) => `${f0(v)} users (approx.)`,
    }),
  ];
  for (const { dimension, series } of charts) {
    redraws.push(
      wireDailyChart(el.querySelector(`[data-dimension-chart="${dimension.name}"]`) as HTMLElement, {
        start,
        series,
        stacked: true,
        // beyond four lines the end labels pile up, so the legend names them alone
        directLabels: series.length <= 4,
        id: `usage-${dimension.name}`,
        animate,
        describe: (v) => `${f0(v)} users (approx.)`,
      }),
    );
  }
  return { el, redraw: () => redraws.forEach((redraw) => redraw()) };
}
