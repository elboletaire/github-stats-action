// Measured downloads per day: the change between consecutive snapshots, stacked by group, with Docker pulls on a right axis.

import { animates, type Dataset, type MeasuredDay } from '@github-stats-action/core';
import { dayAxis, longDate } from '../days';
import { introDelay, playsIntro } from '../intro';
import { esc, f0, sgn } from '../format';
import { countedGroups } from '../model';
import { colorVar } from '../palette';
import { quarterMax, ticks } from '../scale';
import { measuredSeries, slotLabel, slotLabelDays, type MeasuredSeries } from '../slots';
import { stackSegments } from '../stack';
import { gridLines, hitRect, resetSvg, roundedTop, svgEl, widthOf } from '../svg';
import { showTip, tipOn } from '../tooltip';
import { legendHtml, makeSection, type Section } from './common';

const H = 240;
const M = { l: 44, r: 44, t: 26, b: 28 };
/** Below this many measured days the table is shown too. */
const TABLE_BELOW = 3;

export function measured(d: Dataset): Section {
  const groups = countedGroups(d);
  const entries = d.measuredDaily;
  const series = measuredSeries(entries);
  const hasDocker = entries.some((e) => e.docker !== null);
  const legend = legendHtml([
    ...groups.map((g) => ({ label: g.label, color: colorVar(g) })),
    ...(hasDocker ? [{ label: 'Docker pulls (right axis)', color: 'var(--muted)', dashed: true }] : []),
  ]);
  const first = entries[0];
  const note = first
    ? `Measured from the daily snapshots that started on ${longDate(dayAxis(first.date).iso(-first.days))}; it gains a bar every day.`
    : 'Needs two daily snapshots; the first bar appears after the next one.';

  const head = `<thead><tr><th>Day</th>${groups.map((g) => `<th>${esc(g.label)}</th>`).join('')}<th>Total</th>` +
    (hasDocker ? '<th>Docker</th>' : '') + '<th>Stars</th>' +
    d.counters.map((c) => `<th>${esc(c.label)}</th>`).join('') + '</tr></thead>';
  const rows = entries.map((e) => {
    const total = groups.reduce((s, g) => s + (e.groups[g.name] ?? 0), 0);
    return `<tr><td>${esc(longDate(e.date))}${e.days > 1 ? `<small>over ${e.days} days</small>` : ''}</td>` +
      groups.map((g) => `<td>${sgn(e.groups[g.name] ?? 0)}</td>`).join('') +
      `<td>${sgn(total)}</td>` + (hasDocker ? `<td>${sgn(e.docker)}</td>` : '') + `<td>${sgn(e.stars)}</td>` +
      d.counters.map((c) => `<td>${sgn(e.counters[c.name] ?? 0)}</td>`).join('') + '</tr>';
  });
  const table = `<table>${head}<tbody>${rows.join('')}</tbody></table>`;

  const el = makeSection(
    `<div><h2>Measured downloads per day<span class="est meas">measured</span></h2>` +
    `<p class="note">${esc(note)}</p></div>` +
    (entries.length ? legend : '') +
    `<div class="scroll" data-chart${entries.length ? '' : ' hidden'}><svg role="img" aria-label="Measured downloads per day by group, with Docker pulls on a right axis"></svg></div>` +
    `<div class="scroll" data-table${entries.length && entries.length < TABLE_BELOW ? '' : ' hidden'}>${table}</div>`,
  );
  const svg = el.querySelector('svg') as SVGSVGElement;
  const animate = animates(d.charts, 'downloads-per-day');
  return { el, redraw: () => { if (series) drawMeasured(svg, d, series, hasDocker, animate); } };
}

function drawMeasured(svg: SVGSVGElement, d: Dataset, series: MeasuredSeries, hasDocker: boolean, animate: boolean): void {
  const groups = countedGroups(d);
  const W = widthOf(svg);
  resetSvg(svg, W, H, playsIntro(animate));
  const N = series.last + 1;
  const pw = W - M.l - M.r;
  const sw = pw / N;
  const bw = Math.max(1, Math.min(24, sw - 2));
  const cx = (day: number): number => M.l + sw * (day + 0.5);
  const pos = (v: number | null | undefined): number => Math.max(0, v ?? 0);
  const entries = [...series.byDay.entries()];

  // only the positive part is drawn; a negative change sits on the baseline and its sign stays in the tip
  const mx = quarterMax(Math.max(0, ...entries.map(([, e]) => groups.reduce((s, g) => s + pos(e.groups[g.name]), 0))));
  const dx = quarterMax(Math.max(0, ...entries.map(([, e]) => pos(e.docker))));
  const y = (v: number): number => M.t + (H - M.t - M.b) * (1 - v / mx);
  const yd = (v: number): number => M.t + (H - M.t - M.b) * (1 - v / dx);

  gridLines(svg, ticks(mx), y, M.l, W - M.r, f0);
  svgEl('text', { x: 2, y: M.t - 10, class: 'ink' }, svg).textContent = 'downloads';
  if (hasDocker) {
    for (const t of ticks(dx)) svgEl('text', { x: W - M.r + 8, y: yd(t) + 4 }, svg).textContent = f0(t);
    svgEl('text', { x: W - 2, y: M.t - 10, 'text-anchor': 'end' }, svg).textContent = 'Docker';
  }

  // the columns grow in day order, the whole run within 400 ms; a stack grows as one, from its baseline
  for (const [day, e] of entries) {
    const x = cx(day) - bw / 2;
    const column = svgEl('g', { class: 'grow', ...introDelay((400 * day) / N) }, svg);
    for (const seg of stackSegments(groups.map((g) => pos(e.groups[g.name])), y)) {
      const group = groups[seg.index];
      if (!group) continue;
      if (seg.top) svgEl('path', { d: roundedTop(x, seg.y, bw, seg.height, 4), fill: colorVar(group) }, column);
      else svgEl('rect', { x, y: seg.y, width: bw, height: seg.height, fill: colorVar(group) }, column);
    }
  }

  if (hasDocker) {
    // a day without a Docker count breaks the line rather than bridging it
    let line = '';
    let open = false;
    for (let day = 0; day <= series.last; day++) {
      const e = series.byDay.get(day);
      if (!e || e.docker === null) {
        open = false;
        continue;
      }
      line += `${open ? 'L' : 'M'}${cx(day).toFixed(1)},${yd(pos(e.docker)).toFixed(1)}`;
      open = true;
    }
    svgEl('path', { d: line, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, class: 'draw' }, svg);
    if (sw >= 8) {
      for (const [day, e] of entries) {
        if (e.docker === null) continue;
        svgEl('circle', { cx: cx(day), cy: yd(pos(e.docker)), r: 4, fill: 'var(--muted)', stroke: 'var(--surface)', 'stroke-width': 2, class: 'late' }, svg);
      }
    }
  }

  for (const day of slotLabelDays(series, sw)) {
    svgEl('text', { x: cx(day), y: H - 8, 'text-anchor': 'middle' }, svg).textContent = slotLabel(series, day, sw);
  }

  // one hit area per day, the whole slot, so a bar or dot is easy to hit
  for (let day = 0; day <= series.last; day++) {
    const e = series.byDay.get(day);
    const hit = hitRect(svg, M.l + sw * day, M.t, sw, H - M.t - M.b);
    tipOn(hit, (ev) => showTip(e ? changeTip(e, d) : `<b>${esc(series.axis.long(day))}</b><br>No snapshot that day`, ev));
  }
}

function changeTip(e: MeasuredDay, d: Dataset): string {
  const groups = countedGroups(d);
  const total = groups.reduce((s, g) => s + (e.groups[g.name] ?? 0), 0);
  const rows = [
    ...(e.days > 1 ? [`Change over ${e.days} days`] : []),
    ...groups.map((g) => `${esc(g.label)}: ${sgn(e.groups[g.name] ?? 0)}`),
    `Total: ${sgn(total)}`,
    `Docker: ${sgn(e.docker)}`,
    `Stars: ${sgn(e.stars)}`,
    ...d.counters.map((c) => `${esc(c.label)}: ${sgn(e.counters[c.name] ?? 0)}`),
  ];
  return `<b>${esc(longDate(e.date))}</b><br>${rows.join('<br>')}`;
}
