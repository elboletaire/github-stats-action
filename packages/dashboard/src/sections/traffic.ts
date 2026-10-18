// Traffic: views and clones per day, with referrers and popular paths. Shown only when the dataset has traffic.

import type { Dataset, TrafficDay } from '@github-stats-action/core';
import { dayAxis } from '../days';
import { esc, f0, isoDay } from '../format';
import { drawTimeline } from '../timeline';
import { legendHtml, makeSection, type Section } from './common';

const VIEWS = 'var(--c0)';
const CLONES = 'var(--c1)';

export function traffic(d: Dataset): Section | null {
  const t = d.traffic;
  if (!t) return null;
  const all = [...t.views, ...t.clones];
  const first = all.map((x) => x.date).sort()[0];
  const byDate = (days: readonly TrafficDay[]): Map<string, TrafficDay> => new Map(days.map((x) => [x.date, x]));
  const views = byDate(t.views);
  const clones = byDate(t.clones);
  const dates = [...new Set(all.map((x) => x.date))].sort();
  const axis = dayAxis(first ?? '1970-01-01');
  const xs = dates.map((date) => axis.indexOf(Date.parse(`${date}T00:00:00Z`)));

  const daily = `<thead><tr><th>Day</th><th>Views</th><th>Unique visitors</th><th>Clones</th><th>Unique cloners</th></tr></thead><tbody>` +
    dates.map((date) => {
      const v = views.get(date);
      const c = clones.get(date);
      return `<tr><td>${esc(date)}</td><td>${f0(v?.count ?? 0)}</td><td>${f0(v?.uniques ?? 0)}</td><td>${f0(c?.count ?? 0)}</td><td>${f0(c?.uniques ?? 0)}</td></tr>`;
    }).join('') + '</tbody>';
  const referrers = `<thead><tr><th>Referrer</th><th>Views</th><th>Unique visitors</th></tr></thead><tbody>` +
    t.referrers.map((r) => `<tr><td>${esc(r.referrer)}</td><td>${f0(r.count)}</td><td>${f0(r.uniques)}</td></tr>`).join('') + '</tbody>';
  const paths = `<thead><tr><th>Path</th><th>Views</th><th>Unique visitors</th></tr></thead><tbody>` +
    t.paths.map((p) => `<tr><td>${esc(p.title || p.path)}<small>${esc(p.path)}</small></td><td>${f0(p.count)}</td><td>${f0(p.uniques)}</td></tr>`).join('') + '</tbody>';
  const asOf = t.asOf ? `Referrers and paths are GitHub's 14-day totals as of ${isoDay(t.asOf)}.` : 'Referrers and paths have not been collected yet.';

  const el = makeSection(
    `<div><h2>Traffic</h2><p class="note">Views and clones per day from GitHub's traffic API. Hover for a day.</p></div>` +
    legendHtml([{ label: 'Views', color: VIEWS }, { label: 'Clones', color: CLONES }]) +
    (xs.length ? `<div class="scroll"><svg role="img" aria-label="Views and clones per day"></svg></div>` : '<p class="note">No traffic days yet.</p>') +
    `<details><summary>Table view</summary><div class="scroll"><table>${daily}</table></div></details>` +
    `<div><h2>Referrers</h2><p class="note">${esc(asOf)}</p></div>` +
    `<div class="scroll"><table>${referrers}</table></div>` +
    `<div><h2>Popular paths</h2></div>` +
    `<div class="scroll"><table>${paths}</table></div>`,
  );
  const svg = el.querySelector('svg') as SVGSVGElement | null;
  return {
    el,
    redraw: () => {
      if (!svg || xs.length === 0) return;
      drawTimeline(svg, {
        xs,
        axis,
        unit: { one: 'per day', other: 'per day' },
        series: [
          { label: 'Views', color: VIEWS, values: dates.map((date) => views.get(date)?.count ?? null) },
          { label: 'Clones', color: CLONES, values: dates.map((date) => clones.get(date)?.count ?? null) },
        ],
      });
    },
  };
}
