// Estimated downloads per day: a zoomable line chart over an overview strip, with presets and a table view.

import type { Dataset } from '@github-stats-action/core';
import { dayAxis, presetStart, clampView, zoomView, xTicks } from '../days';
import { esc, f0, f1 } from '../format';
import { niceMax, quarterMax, ticks } from '../scale';
import { countedGroups } from '../model';
import { colorVar } from '../palette';
import { fadeFill, gridLines, hitRect, resetSvg, svgEl, widthOf } from '../svg';
import { hideTip, showTip, tipOn } from '../tooltip';
import { makeSection, legendHtml, type Section } from './common';

/** The narrowest window, in days. */
const MIN_DAYS = 6;
/** How close, in pixels, a press must be to a window edge to resize it. */
const EDGE_PX = 10;
const PRESETS: Array<[label: string, days: number]> = [['All', 0], ['1y', 365], ['90d', 90], ['30d', 30]];
const CURSORS = { l: 'ew-resize', r: 'ew-resize', pan: 'grab', new: 'crosshair' } as const;

type Zone = keyof typeof CURSORS;
type View = { a: number; b: number };

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
  const chart = el.querySelector('[data-chart]') as SVGSVGElement;
  const strip = el.querySelector('[data-strip]') as SVGSVGElement;
  const presetBox = el.querySelector('[data-presets]') as HTMLElement;

  let view: View = { a: 0, b: n - 1 };
  let chartGeo = { W: 0, left: 0, right: 0 };
  let stripGeo = { W: 0, left: 0, right: 0 };

  const setView = (next: View): void => {
    view = clampView(next.a, next.b, n, MIN_DAYS);
    drawChart();
    drawStrip();
    syncPresets();
  };

  // the presets, ending today; the readout after them names the window
  const buttons = PRESETS.map(([label, days]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => setView({ a: presetStart(days, n), b: n - 1 }));
    presetBox.appendChild(button);
    return button;
  });
  const readout = document.createElement('span');
  readout.className = 'note';
  presetBox.parentElement!.appendChild(readout);
  // a short series makes several presets cover the same window: only the widest reads as chosen
  const syncPresets = (): void => {
    let chosen = false;
    PRESETS.forEach(([, days], j) => {
      const on = !chosen && view.a === presetStart(days, n) && view.b === n - 1;
      chosen ||= on;
      buttons[j]!.setAttribute('aria-pressed', String(on));
    });
    readout.textContent = `${axis.long(view.a)} to ${axis.long(view.b)}`;
  };
  syncPresets();

  // the chart: the window's lines, a crosshair and a tooltip per day
  const drawChart = (): void => {
    const W = widthOf(chart);
    const H = 280;
    // the right margin makes room for the end labels, up to a share of the width on a phone
    const longest = Math.max(0, ...groups.map((g) => g.label.length * 6.5));
    const m = { l: 44, r: Math.min(Math.round(longest) + 20, Math.round(W * 0.3)), t: 16, b: 28 };
    const { a, b } = view;
    const L = Math.max(1, b - a);
    const pw = W - m.l - m.r;
    resetSvg(chart, W, H);
    chartGeo = { W, left: m.l, right: m.r };
    const mx = quarterMax(Math.max(1, ...series.flatMap((s) => s.slice(a, b + 1))));
    const x = (i: number): number => m.l + (pw * (i - a)) / L;
    const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);

    gridLines(chart, ticks(mx), y, m.l, W - m.r, f0);
    // a year-long-or-more view keeps its start year at the left edge, so the first year tick beside it is dropped
    if (L > 400) svgEl('text', { x: m.l, y: H - 8 }, chart).textContent = String(axis.year(a));
    for (const [i, text] of xTicks(axis, a, b, Math.max(2, Math.floor(pw / 72)))) {
      if (L > 400 && x(i) < m.l + 30) continue;
      svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, chart).textContent = text;
      svgEl('line', { x1: x(i), x2: x(i), y1: y(0), y2: y(0) + 4, class: 'axis' }, chart);
    }

    // the first group is drawn last, so it sits on top
    [...groups.entries()].reverse().forEach(([j, g]) => {
      const s = series[j] ?? [];
      const color = colorVar(g);
      const pts = s.slice(a, b + 1).map((v, k) => `${x(a + k).toFixed(1)},${y(v).toFixed(1)}`).join('L');
      svgEl('path', { d: `M${x(a)},${y(0)}L${pts}L${x(b)},${y(0)}Z`, fill: fadeFill(chart, `es${j}`, color) }, chart);
      svgEl('path', { d: `M${pts}`, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, chart);
      svgEl('circle', { cx: x(b), cy: y(s[b] ?? 0), r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, chart);
    });
    // end labels beside the dots, nudged apart when two lines end close together
    const ends = groups.map((g, j) => ({ g, y: y(series[j]?.[b] ?? 0) })).sort((p, q) => p.y - q.y);
    ends.forEach((e, k) => {
      const above = ends[k - 1];
      if (above && e.y - above.y < 13) e.y = above.y + 13;
    });
    for (const e of ends) {
      const endX = x(b);
      // the label goes left of the line when it would still run past the right edge
      const left = endX + 10 + e.g.label.length * 6.5 > W - 2;
      svgEl('text', { x: left ? endX - 10 : endX + 10, y: Math.min(H - m.b - 4, e.y + 4), class: 'ink', 'text-anchor': left ? 'end' : 'start' }, chart).textContent = e.g.label;
    }

    const cross = svgEl('line', { y1: m.t, y2: y(0), class: 'base', visibility: 'hidden' }, chart);
    const dots = groups.map((g) => svgEl('circle', { r: 4, fill: colorVar(g), stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, chart));
    const hit = hitRect(chart, m.l, m.t, pw, H - m.t - m.b);
    tipOn(hit, (ev) => {
      const px = ev.clientX - chart.getBoundingClientRect().left;
      const i = Math.max(a, Math.min(b, Math.round(a + ((px - m.l) / pw) * L)));
      cross.setAttribute('x1', String(x(i)));
      cross.setAttribute('x2', String(x(i)));
      cross.setAttribute('visibility', 'visible');
      series.forEach((s, j) => {
        dots[j]?.setAttribute('cx', String(x(i)));
        dots[j]?.setAttribute('cy', String(y(s[i] ?? 0)));
        dots[j]?.setAttribute('visibility', 'visible');
      });
      const rows = groups.map((g, j) => `${esc(g.label)}: ${f1(series[j]?.[i] ?? 0)}/day (est.)`);
      showTip(`<b>${esc(axis.long(i))}</b><br>${rows.join('<br>')}`, ev);
    });
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((dot) => dot.setAttribute('visibility', 'hidden'));
    });
  };

  // the overview: the whole series, faded, with the window on top and its two edges as handles
  const spanOf = (): number => stripGeo.W - stripGeo.left - stripGeo.right;
  const stripX = (i: number): number => stripGeo.left + (spanOf() * i) / Math.max(1, n - 1);
  const stripIndex = (px: number): number => ((px - stripGeo.left) * Math.max(1, n - 1)) / spanOf();
  const drawStrip = (): void => {
    const W = widthOf(strip);
    const H = 56;
    const m = { l: 44, r: 44, t: 4, b: 4 };
    resetSvg(strip, W, H);
    stripGeo = { W, left: m.l, right: m.r };
    const mx = niceMax(Math.max(1, ...series.flat()));
    const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);
    groups.forEach((g, j) => {
      const s = series[j] ?? [];
      const pts = s.map((v, i) => `${stripX(i).toFixed(1)},${y(v).toFixed(1)}`).join('L');
      svgEl('path', { d: `M${stripX(0)},${y(0)}L${pts}L${stripX(n - 1)},${y(0)}Z`, fill: colorVar(g), 'fill-opacity': 0.16 }, strip);
      svgEl('path', { d: `M${pts}`, fill: 'none', stroke: colorVar(g), 'stroke-opacity': 0.7, 'stroke-width': 1, 'stroke-linejoin': 'round' }, strip);
    });
    svgEl('line', { x1: m.l, x2: W - m.r, y1: y(0) + 0.5, y2: y(0) + 0.5, class: 'base' }, strip);
    // the days outside the window are veiled; the window has a hairline frame and two pill handles
    const x0 = stripX(view.a);
    const x1 = stripX(view.b);
    svgEl('rect', { x: m.l, y: 0, width: x0 - m.l, height: H, fill: 'var(--surface)', 'fill-opacity': 0.72 }, strip);
    svgEl('rect', { x: x1, y: 0, width: W - m.r - x1, height: H, fill: 'var(--surface)', 'fill-opacity': 0.72 }, strip);
    svgEl('rect', { x: x0 + 0.5, y: 0.5, width: Math.max(0, x1 - x0 - 1), height: H - 1, fill: 'none', stroke: 'var(--ink2)', 'stroke-opacity': 0.6, 'stroke-width': 1, rx: 3 }, strip);
    for (const hx of [x0, x1]) svgEl('rect', { x: hx - 3.5, y: H / 2 - 10, width: 7, height: 20, rx: 3.5, fill: 'var(--ink2)', stroke: 'var(--surface)', 'stroke-width': 1.5 }, strip);
  };

  const zoneOf = (px: number): Zone => {
    const x0 = stripX(view.a);
    const x1 = stripX(view.b);
    const reach = Math.min(EDGE_PX, (x1 - x0) / 3);
    const dl = Math.abs(px - x0);
    const dr = Math.abs(px - x1);
    if (Math.min(dl, dr) <= reach) return dl <= dr ? 'l' : 'r';
    return px > x0 && px < x1 ? 'pan' : 'new';
  };
  const pxIn = (svg: SVGSVGElement, ev: { clientX: number }): number => ev.clientX - svg.getBoundingClientRect().left;
  let drag: { mode: Zone; px0: number; a0: number; b0: number; anchor: number } | null = null;
  strip.addEventListener('pointerdown', (ev) => {
    const px = pxIn(strip, ev);
    drag = { mode: zoneOf(px), px0: px, a0: view.a, b0: view.b, anchor: Math.max(0, Math.min(n - 1, Math.round(stripIndex(px)))) };
    strip.setPointerCapture(ev.pointerId);
  });
  strip.addEventListener('pointermove', (ev) => {
    const px = pxIn(strip, ev);
    if (!drag) {
      strip.style.cursor = CURSORS[zoneOf(px)];
      return;
    }
    const cur = Math.round(stripIndex(px));
    const di = Math.round(((px - drag.px0) * (n - 1)) / spanOf());
    const { a0, b0, anchor } = drag;
    if (drag.mode === 'pan') setView({ a: a0 + di, b: b0 + di });
    else if (drag.mode === 'l') setView({ a: Math.min(Math.max(0, cur), b0 - MIN_DAYS), b: b0 });
    else if (drag.mode === 'r') setView({ a: a0, b: Math.max(Math.min(n - 1, cur), a0 + MIN_DAYS) });
    else if (cur >= anchor) setView({ a: anchor, b: Math.max(cur, anchor + MIN_DAYS) });
    else setView({ a: Math.min(cur, anchor - MIN_DAYS), b: anchor });
  });
  const endDrag = (): void => {
    drag = null;
  };
  strip.addEventListener('pointerup', endDrag);
  strip.addEventListener('pointercancel', endDrag);

  const reset = (): void => setView({ a: 0, b: n - 1 });
  strip.addEventListener('dblclick', reset);
  chart.addEventListener('dblclick', reset);

  // the index under a chart pixel, within the current window
  const chartIndex = (px: number): number => Math.max(view.a, Math.min(view.b, view.a + ((px - chartGeo.left) / (chartGeo.W - chartGeo.left - chartGeo.right)) * (view.b - view.a)));
  chart.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const len = view.b - view.a;
      const centre = chartIndex(pxIn(chart, ev));
      const t = (centre - view.a) / len;
      // small trackpad deltas round back to the same length, so move at least a day
      let next = Math.round(len * Math.exp(ev.deltaY * (ev.deltaMode ? 0.04 : 0.002)));
      if (next === len && ev.deltaY) next = len + Math.sign(ev.deltaY);
      setView(zoomView(centre, t, next, n, MIN_DAYS));
    },
    { passive: false },
  );

  // two fingers scale the window around their starting midpoint (the chart is touch-action: pan-y)
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; len: number; centre: number; t: number } | null = null;
  const midpoint = (): { px: number; d: number } => {
    const [p, q] = [...touches.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { px: (p.x + q.x) / 2 - chart.getBoundingClientRect().left, d: Math.hypot(p.x - q.x, p.y - q.y) };
  };
  chart.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (touches.size === 2) {
      const mid = midpoint();
      if (mid.d > 0) {
        const len = view.b - view.a;
        const centre = chartIndex(mid.px);
        pinch = { d: mid.d, len, centre, t: (centre - view.a) / len };
      }
    }
  });
  chart.addEventListener('pointermove', (ev) => {
    if (!touches.has(ev.pointerId)) return;
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && touches.size === 2) {
      const mid = midpoint();
      if (mid.d > 0) setView(zoomView(pinch.centre, pinch.t, (pinch.len * pinch.d) / mid.d, n, MIN_DAYS));
    }
  });
  const endTouch = (ev: PointerEvent): void => {
    touches.delete(ev.pointerId);
    if (touches.size < 2) pinch = null;
  };
  chart.addEventListener('pointerup', endTouch);
  chart.addEventListener('pointercancel', endTouch);

  return {
    el,
    redraw: () => {
      drawChart();
      drawStrip();
    },
  };
}
