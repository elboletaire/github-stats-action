// Downloads per release: one stacked column per release, with epoch markers and a table view.

import type { Dataset, ReleaseRow } from '@github-stats-action/core';
import { esc, f0, f1, isoDay } from '../format';
import { niceMax, ticks } from '../scale';
import { countedGroups } from '../model';
import { colorVar } from '../palette';
import { gridLines, resetSvg, roundedTop, svgEl, widthOf, hitRect } from '../svg';
import { stackSegments } from '../stack';
import { showTip, tipOn } from '../tooltip';
import { makeSection, legendHtml, type Section } from './common';

const STEP = 17;
const M = { l: 44, r: 12, t: 44, b: 58 };
/** Epoch labels take the row nearest the plot that has room, else the one above it; past that the marker stands alone. */
const TIERS = 2;
const TIER_H = 14;
const H = 300;

export function releases(d: Dataset): Section {
  const groups = countedGroups(d);
  if (d.releases.length === 0) return { el: makeSection('<div><h2>Downloads per release</h2><p class="note">No releases yet.</p></div>') };

  const head = `<thead><tr><th>Release</th><th>Published</th><th>Live days</th>${groups.map((g) => `<th>${esc(g.label)}</th>`).join('')}<th>Total</th>` +
    d.counters.map((c) => `<th>${esc(c.label)}</th>`).join('') +
    groups.map((g) => `<th>${esc(g.label)}/day</th>`).join('') + '</tr></thead>';
  const rows = d.releases.slice().reverse().map((r) => {
    const counters = d.counters.map((c) => {
      const s = r.counters[c.name];
      return `<td>${s?.counted ? f0(s.downloads) : '—'}</td>`;
    }).join('');
    const perDay = groups.map((g) => `<td>${r.days < 1 ? '—' : f1((r.groups[g.name] ?? 0) / r.days)}</td>`).join('');
    const total = Object.values(r.groups).reduce((s, v) => s + v, 0);
    return `<tr><td>${esc(r.tag)}</td><td>${isoDay(r.publishedAt)}</td><td>${f1(r.days)}</td>` +
      groups.map((g) => `<td>${f0(r.groups[g.name] ?? 0)}</td>`).join('') +
      `<td><b>${f0(total)}</b></td>${counters}${perDay}</tr>`;
  });

  const legend = legendHtml(groups.map((g) => ({ label: g.label, color: colorVar(g) })));
  const el = makeSection(
    `<div><h2>Downloads per release</h2>` +
    `<p class="note">Total downloads of each release's files, oldest to newest. Markers show where an epoch starts. Recent releases have had less time to collect downloads. The per-day columns show a dash for releases that were the latest for under a day, since their downloads mostly came after they were replaced.</p></div>` +
    `${legend}<div class="scroll"><svg role="img" aria-label="Stacked downloads per release by group"></svg></div>` +
    `<details><summary>Table view</summary><div class="scroll"><table>${head}<tbody>${rows.join('')}</tbody></table></div>` +
    countersNote(d) + '</details>',
  );
  const svg = el.querySelector('svg') as SVGSVGElement;
  return { el, redraw: () => drawReleases(svg, d) };
}

function drawReleases(svg: SVGSVGElement, d: Dataset): void {
  const groups = countedGroups(d);
  const R = d.releases;
  const W = widthOf(svg, M.l + M.r + STEP * R.length);
  resetSvg(svg, W, H);
  const mx = niceMax(Math.max(0, ...R.map((r) => groupTotal(r, groups))));
  const y = (v: number): number => M.t + (H - M.t - M.b) * (1 - v / mx);
  const slot = (W - M.l - M.r) / R.length;
  // a column never fills its slot: capped, the leftover is air; tags lie flat once the slots are wide enough
  const bw = Math.min(32, slot - 4);
  const flat = slot >= 64;

  gridLines(svg, ticks(mx), y, M.l, W - M.r, f0);

  R.forEach((r, i) => {
    const x = M.l + slot * i + (slot - bw) / 2;
    const segments = stackSegments(groups.map((g) => r.groups[g.name] ?? 0), y);
    for (const seg of segments) {
      const group = groups[seg.index];
      if (!group) continue;
      if (seg.top) svgEl('path', { d: roundedTop(x, seg.y, bw, seg.height, 4), fill: colorVar(group) }, svg);
      else svgEl('rect', { x, y: seg.y, width: bw, height: seg.height, fill: colorVar(group) }, svg);
    }
    const label = flat
      ? svgEl('text', { x: M.l + slot * (i + 0.5), y: H - M.b + 18, 'text-anchor': 'middle' }, svg)
      : svgEl('text', { transform: `translate(${M.l + slot * (i + 0.5) + 3},${H - M.b + 10}) rotate(-60)`, 'text-anchor': 'end' }, svg);
    label.textContent = r.tag;
    const hit = hitRect(svg, M.l + slot * i, M.t, slot, H - M.t - M.b);
    tipOn(hit, (ev) => showTip(releaseTip(r, d), ev));
  });

  // epoch markers where an epoch starts; none when the config names no epochs
  let prev = -1;
  const placed: Array<{ from: number; to: number; tier: number }> = [];
  R.forEach((r, i) => {
    if (r.epoch < 0 || r.epoch === prev) return;
    prev = r.epoch;
    const x = M.l + slot * i;
    const label = d.epochs[r.epoch]?.version ?? '';
    const width = label.length * 6.5;
    // right of the marker, else left of it, nearest tier first
    const spot = Array.from({ length: TIERS }, (_, tier) => tier).flatMap((tier) =>
      [{ x: x + 7, anchor: 'start', from: x + 7, to: x + 7 + width }, { x: x - 7, anchor: 'end', from: x - 7 - width, to: x - 7 }]
        .filter((o) => o.from >= 2 && o.to <= W - 2 && !placed.some((p) => p.tier === tier && o.from < p.to + 8 && p.from < o.to + 8))
        .map((o) => ({ ...o, tier })),
    )[0];
    const capY = M.t - 12 - (spot?.tier ?? 0) * TIER_H;
    if (i > 0) {
      svgEl('line', { x1: x, x2: x, y1: capY, y2: y(0), class: 'sep' }, svg);
      svgEl('circle', { cx: x, cy: capY, r: 2.5, class: 'cap' }, svg);
    }
    if (!spot) return;
    placed.push({ from: spot.from, to: spot.to, tier: spot.tier });
    svgEl('text', { x: spot.x, y: capY + 4, class: 'ink', 'text-anchor': spot.anchor }, svg).textContent = label;
  });
}

/** Says from which release each counter counts, since its column shows a dash before that. */
export function countersNote(d: Dataset): string {
  const lines = d.counters.filter((c) => c.from).map((c) => `${esc(c.label)} counts from ${esc(c.from ?? '')}; earlier releases show a dash.`);
  return lines.length ? `<p class="note">${lines.join(' ')}</p>` : '';
}

function groupTotal(r: ReleaseRow, groups: readonly { name: string }[]): number {
  return groups.reduce((sum, g) => sum + (r.groups[g.name] ?? 0), 0);
}

function releaseTip(r: ReleaseRow, d: Dataset): string {
  const groups = countedGroups(d);
  const rows = groups.map((g) => `${esc(g.label)}: ${f0(r.groups[g.name] ?? 0)}`);
  const counted = d.counters.filter((c) => r.counters[c.name]?.counted).map((c) => `${esc(c.label)}: ${f0(r.counters[c.name]!.downloads)}`);
  return `<b>${esc(r.tag)}</b> ${isoDay(r.publishedAt)}<br>${[...rows, `Total: ${f0(groupTotal(r, groups))}`, ...counted, `Live ${r.days.toFixed(1)} ${r.days === 1 ? 'day' : 'days'}`].join('<br>')}`;
}
