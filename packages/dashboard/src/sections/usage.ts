// Usage: the Cloudflare Analytics Engine figures, approximate daily users on a zoomable chart with a share
// table per dimension. Shown only when the dataset has Cloudflare figures; every users figure is approximate.

import { animates, type CloudflareData, type Dataset } from '@github-stats-action/core';
import { esc, f0, percent } from '../format';
import { cloudflareDaily } from '../model';
import { makeSection, type Section } from './common';
import { wireDailyChart } from './daily-chart';

const USERS = 'var(--c0)';

/** The section's markup without its chart: the tile, the chart's frame, one table per dimension and the note. */
export function usageHtml(cf: CloudflareData): string {
  const { totals } = cf;
  const other = cf.primary
    ? `<div class="d">plus ${f0(totals.otherEvents7)} ${esc(cf.label.toLowerCase())} on the last 7 days</div>`
    : '';
  const tile = `<div class="kpi"><div class="l">Daily users</div><div class="v">${f0(totals.usersAvg7)}</div><div class="d">7-day average, approx.</div>${other}</div>`;

  const tables = cf.dimensions.map((dimension) => {
    const shares = cf.shares[dimension.name] ?? [];
    const events = shares.reduce((sum, s) => sum + s.events, 0);
    const body = shares.length
      ? `<div class="scroll"><table><thead><tr><th>Value</th><th>Users (approx.)</th><th>Events</th><th>Share</th></tr></thead><tbody>` +
        shares.map((s) => `<tr><td>${esc(s.value)}</td><td>${f0(s.users)}</td><td>${f0(s.events)}</td><td>${percent(s.events, events)}</td></tr>`).join('') +
        `</tbody></table></div>`
      : '<p class="note">No events in the last 30 days.</p>';
    return `<div><h3>${esc(dimension.label)}, last 30 days</h3></div>` + body;
  });

  return (
    `<div><h2>Usage<span class="est">approximate</span></h2>` +
    `<p class="note">Daily users from Cloudflare Analytics Engine, on UTC days; users are approximate counts, and the latest day is the last complete one. Hover for a day. Drag the strip below to choose the range; wheel or pinch over the chart to zoom, double-click to reset.</p></div>` +
    `<div class="kpis">${tile}</div>` +
    `<div class="presets"><span class="group" data-presets></span></div>` +
    `<div class="scroll"><svg data-chart role="img" aria-label="Approximate daily users per day"></svg></div>` +
    `<div class="scroll"><svg data-strip role="img" aria-label="Overview of the whole series with the range shown above"></svg></div>` +
    tables.join('') +
    (cf.note ? `<p class="note">${esc(cf.note)}</p>` : '')
  );
}

export function usage(d: Dataset): Section | null {
  const cf = d.cloudflare;
  if (!cf) return null;
  const { start, values } = cloudflareDaily(cf);
  const el = makeSection(usageHtml(cf));
  const redraw = wireDailyChart(el, {
    start,
    series: [{ label: 'Daily users (approx.)', color: USERS, values }],
    stacked: false,
    directLabels: true,
    id: 'usage',
    animate: animates(d.charts),
    describe: (v) => `${f0(v)} users (approx.)`,
  });
  return { el, redraw };
}
