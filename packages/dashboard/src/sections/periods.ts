// Periods: one row per epoch span, with totals, averages and medians per day, and a chart of the averages.

import type { Dataset } from '@github-stats-action/core';
import { esc, f0, f1, plural } from '../format';
import { niceMax, ticks } from '../scale';
import { countedGroups, periodName, periodShort } from '../model';
import { colorVar } from '../palette';
import { resetSvg, roundedTop, svgEl, widthOf } from '../svg';
import { showTip, tipOn } from '../tooltip';
import { makeSection, legendHtml, type Section } from './common';

export function periods(d: Dataset): Section {
  const groups = countedGroups(d);
  const counters = d.counters;
  const cell = (text: string): string => `<td>${text}</td>`;
  const head = `<thead><tr><th>Period</th><th>Releases</th>${groups.map((g) => `<th>${esc(g.label)}</th>`).join('')}<th>Total</th>` +
    counters.map((c) => `<th>${esc(c.label)}</th>`).join('') +
    groups.map((g) => `<th>Avg/day ${esc(g.label)}</th>`).join('') + '<th>Avg/day all</th>' +
    groups.map((g) => `<th>Median/day ${esc(g.label)}</th>`).join('') + '<th>Median/day all</th></tr></thead>';

  const rows = d.periods.map((p) => {
    const none = p.releases === 0;
    const range = p.firstTag === null ? '' : `<small>${esc(p.firstTag)}${p.lastTag && p.lastTag !== p.firstTag ? ` to ${esc(p.lastTag)}` : ''}</small>`;
    return `<tr><td>${esc(periodName(p, d.epochs))}${range}</td><td>${p.releases}</td>` +
      groups.map((g) => cell(f0(p.groups[g.name] ?? 0))).join('') +
      cell(`<b>${f0(p.downloads)}</b>`) +
      counters.map((c) => {
        const s = p.counters[c.name];
        return cell(s?.counted ? f0(s.downloads) : '—');
      }).join('') +
      groups.map((g) => cell(none ? '—' : f1(p.avgPerDay[g.name] ?? 0))).join('') +
      cell(none ? '—' : f1(p.avgPerDayTotal)) +
      groups.map((g) => cell(f1(p.medianPerDay[g.name] ?? null))).join('') +
      cell(f1(p.medianPerDayTotal)) + '</tr>';
  });
  const span = 2 * groups.length + 2;
  const total = `<tr><td><b>All time</b></td><td>${d.releases.length}</td>` +
    groups.map((g) => cell(`<b>${f0(d.totals.groups[g.name] ?? 0)}</b>`)).join('') +
    cell(`<b>${f0(d.totals.downloads)}</b>`) +
    counters.map((c) => cell(f0(d.totals.counters[c.name]?.downloads ?? 0))).join('') +
    `<td colspan="${span}"></td></tr>`;

  const last = d.periods.at(-1);
  const dashNote = last && last.releases > 0 && last.fullDays === 0
    ? `<p class="note">Medians show a dash for ${esc(periodName(last, d.epochs))}: it has no whole calendar day yet, and its average per day extrapolates a short window.</p>`
    : '';
  const legend = legendHtml(groups.map((g) => ({ label: g.label, color: colorVar(g) })));
  const el = makeSection(
    `<div><h2>Periods<span class="est">estimated</span></h2>` +
    `<p class="note">GitHub only exposes cumulative counts per file, so per-day figures are estimates: each release's downloads are spread evenly over the days it was the latest release (until the next release, or now). Totals are exact. Medians are over whole calendar days (UTC) inside the period.</p></div>` +
    `<div class="scroll"><table class="periods">${head}<tbody>${rows.join('')}${total}</tbody></table></div>${dashNote}` +
    `${legend}<div class="scroll"><svg role="img" aria-label="Average estimated downloads per day by period"></svg></div>`,
  );
  const svg = el.querySelector('svg') as SVGSVGElement;
  const box = el.querySelector('.scroll') as HTMLElement;
  box.addEventListener('scroll', () => fadeEdge(box));
  return {
    el,
    redraw: () => {
      fadeEdge(box);
      drawPeriods(svg, d);
    },
  };
}

/** Marks the table box as scrollable past its right edge, so the fade hints at the columns beyond. */
function fadeEdge(box: HTMLElement): void {
  box.classList.toggle('more', box.scrollWidth - box.clientWidth - box.scrollLeft > 1);
}

function drawPeriods(svg: SVGSVGElement, d: Dataset): void {
  const groups = countedGroups(d);
  const P = d.periods;
  const W = widthOf(svg);
  const H = 230;
  const m = { l: 44, r: 10, t: 14, b: 44 };
  resetSvg(svg, W, H);
  const mx = niceMax(Math.max(0, ...P.flatMap((p) => groups.map((g) => p.avgPerDay[g.name] ?? 0))));
  const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);
  const slot = (W - m.l - m.r) / Math.max(1, P.length);
  for (const t of ticks(mx)) {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'axis' }, svg);
    svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = f0(t);
  }
  svgEl('text', { x: m.l, y: 10 }, svg).textContent = 'Average estimated downloads per day';

  P.forEach((p, i) => {
    const cx = m.l + slot * (i + 0.5);
    const bw = Math.min(36, (slot - 8) / Math.max(1, groups.length));
    groups.forEach((g, j) => {
      const v = p.avgPerDay[g.name] ?? 0;
      const x = cx - (groups.length * bw) / 2 + j * bw + 1;
      const h = y(0) - y(v);
      if (h <= 0) return;
      const bar = svgEl('path', { d: roundedTop(x, y(v), bw - 2, h, 4), fill: colorVar(g) }, svg);
      svgEl('text', { x: x + (bw - 2) / 2, y: y(v) - 4, 'text-anchor': 'middle', class: 'ink' }, svg).textContent = f1(v);
      tipOn(bar, (ev) => showTip(
        `<b>${esc(periodName(p, d.epochs))}</b><br>${esc(g.label)}: ${f1(v)}/day avg (est.)<br>${f0(p.groups[g.name] ?? 0)} downloads over ${p.days.toFixed(1)} ${p.days === 1 ? 'day' : 'days'}`,
        ev,
      ));
    });
    svgEl('text', { x: cx, y: H - m.b + 16, 'text-anchor': 'middle', class: 'ink' }, svg).textContent = periodShort(p, d.epochs);
    svgEl('text', { x: cx, y: H - m.b + 30, 'text-anchor': 'middle' }, svg).textContent = plural(p.releases, 'release');
  });
}
