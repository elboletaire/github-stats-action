// A zoomable daily chart over an overview strip: the window's lines or stacked bands, presets, a
// crosshair tooltip per day, drag-to-range on the strip, and wheel or pinch zoom. Shared by the
// estimated and npm sections, which only differ in their markup and in what a value means.

import { MARK } from '@github-stats-action/core/theme';
import { dayAxis, presetStart, clampView, zoomView, xTicks } from '../days';
import { introDelay, introStagger, playsIntro } from '../intro';
import { esc, f0 } from '../format';
import { niceMax, quarterMax, ticks } from '../scale';
import { fadeFill, gridLines, hitRect, resetSvg, svgEl, widthOf, type Attrs } from '../svg';
import { showTip, tipOn } from '../tooltip';

/** The narrowest window, in days. */
const MIN_DAYS = 6;
/** How close, in pixels, a press must be to a window edge to resize it. */
const EDGE_PX = 10;
const PRESETS: Array<[label: string, days: number]> = [['All', 0], ['1y', 365], ['90d', 90], ['30d', 30]];
const CURSORS = { l: 'ew-resize', r: 'ew-resize', pan: 'grab', new: 'crosshair' } as const;

type Zone = keyof typeof CURSORS;
type View = { a: number; b: number };

export interface DailySeries {
  /** Named in the tooltip and beside the line's end. */
  label: string;
  /** A CSS colour. */
  color: string;
  /** One value per day from the chart's start, all series the same length. */
  values: number[];
}

export interface DailyOptions {
  /** YYYY-MM-DD of day 0 (UTC). */
  start: string;
  /** Overlapping: the first series is drawn on top. Stacked: the first sits at the bottom. */
  series: DailySeries[];
  /** Each series sits on the ones before it, so the top line is the total. */
  stacked: boolean;
  /** Names each line beside its end; off for many series, which the legend alone names. */
  directLabels: boolean;
  /** A prefix for the chart's gradient ids, unique on the page. */
  id: string;
  /** Whether the chart's config animates it on load. */
  animate: boolean;
  /** The tooltip text of one series' value on one day. */
  describe(value: number): string;
}

/** The path back along a stacked band's base, from `to` down to `from`. */
function baseEdge(xOf: (i: number) => number, yOf: (v: number) => number, base: number[], from: number, to: number): string {
  const points: string[] = [];
  for (let i = to; i >= from; i--) points.push(`${xOf(i).toFixed(1)},${yOf(base[i] ?? 0).toFixed(1)}`);
  return points.join('L');
}

/** Wires the chart, strip, presets and readout inside `el`, which holds `[data-chart]`, `[data-strip]` and `[data-presets]`. Returns the redraw. */
export function wireDailyChart(el: HTMLElement, options: DailyOptions): () => void {
  const { series, stacked } = options;
  const n = Math.max(0, ...series.map((s) => s.values.length));
  const axis = dayAxis(options.start);
  const chart = el.querySelector('[data-chart]') as SVGSVGElement;
  const strip = el.querySelector('[data-strip]') as SVGSVGElement;
  const presetBox = el.querySelector('[data-presets]') as HTMLElement;

  // each series' base (the edge it sits on) and top (its line), as cumulative sums when stacked
  const bases: number[][] = [];
  const tops: number[][] = [];
  let lower = new Array<number>(n).fill(0);
  for (const s of series) {
    const base = stacked ? lower : new Array<number>(n).fill(0);
    const top = Array.from({ length: n }, (_, i) => base[i]! + (s.values[i] ?? 0));
    bases.push(base);
    tops.push(top);
    lower = top;
  }

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

  // the series wipe in one after another within 250 ms; a dot or label lands once its series' wipe (0.6 s, as in style.css) is done
  const wipeAt = (j: number): number => introStagger(j, series.length);

  // the chart: the window's lines, a crosshair and a tooltip per day
  const drawChart = (): void => {
    const W = widthOf(chart);
    const H = 280;
    // the right margin makes room for the end labels, up to a share of the width on a phone
    const longest = Math.max(0, ...series.map((s) => s.label.length * 6.5));
    const m = { l: 44, r: Math.min(Math.round(longest) + 20, Math.round(W * 0.3)), t: 16, b: 28 };
    const { a, b } = view;
    const L = Math.max(1, b - a);
    const pw = W - m.l - m.r;
    resetSvg(chart, W, H, playsIntro(options.animate));
    chartGeo = { W, left: m.l, right: m.r };
    const mx = quarterMax(Math.max(1, ...tops.flatMap((t) => t.slice(a, b + 1))));
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

    // the first series is drawn last, so it sits on top when overlapping
    [...series.entries()].reverse().forEach(([j, s]) => {
      const top = tops[j]!;
      const base = bases[j]!;
      const wipe = { class: 'wipe', ...introDelay(wipeAt(j)) };
      const pts = top.slice(a, b + 1).map((v, k) => `${x(a + k).toFixed(1)},${y(v).toFixed(1)}`).join('L');
      const d = stacked
        ? `M${pts}L${baseEdge(x, y, base, a, b)}Z`
        : `M${x(a)},${y(0)}L${pts}L${x(b)},${y(0)}Z`;
      const fill: Attrs = stacked ? { fill: s.color, 'fill-opacity': MARK.areaStack } : { fill: fadeFill(chart, `${options.id}-fade-${j}`, s.color) };
      svgEl('path', { d, ...fill, ...wipe }, chart);
      svgEl('path', { d: `M${pts}`, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...wipe }, chart);
      svgEl('circle', { cx: x(b), cy: y(top[b] ?? 0), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, class: 'late', ...introDelay(wipeAt(j) + 600) }, chart);
    });
    // end labels beside the dots, nudged apart when two lines end close together
    const ends = series.map((s, j) => ({ s, j, y: y(tops[j]![b] ?? 0) })).sort((p, q) => p.y - q.y);
    ends.forEach((e, k) => {
      const above = ends[k - 1];
      if (above && e.y - above.y < 13) e.y = above.y + 13;
    });
    for (const e of options.directLabels ? ends : []) {
      const endX = x(b);
      // the label goes left of the line when it would still run past the right edge
      const left = endX + 10 + e.s.label.length * 6.5 > W - 2;
      svgEl('text', { x: left ? endX - 10 : endX + 10, y: Math.min(H - m.b - 4, e.y + 4), class: 'ink late', 'text-anchor': left ? 'end' : 'start', ...introDelay(wipeAt(e.j) + 600) }, chart).textContent = e.s.label;
    }

    const cross = svgEl('line', { y1: m.t, y2: y(0), class: 'base', visibility: 'hidden' }, chart);
    const dots = series.map((s) => svgEl('circle', { r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, chart));
    const hit = hitRect(chart, m.l, m.t, pw, H - m.t - m.b);
    tipOn(hit, (ev) => {
      const px = ev.clientX - chart.getBoundingClientRect().left;
      const i = Math.max(a, Math.min(b, Math.round(a + ((px - m.l) / pw) * L)));
      cross.setAttribute('x1', String(x(i)));
      cross.setAttribute('x2', String(x(i)));
      cross.setAttribute('visibility', 'visible');
      series.forEach((_, j) => {
        dots[j]?.setAttribute('cx', String(x(i)));
        dots[j]?.setAttribute('cy', String(y(tops[j]![i] ?? 0)));
        dots[j]?.setAttribute('visibility', 'visible');
      });
      const rows = series.map((s) => `${esc(s.label)}: ${options.describe(s.values[i] ?? 0)}`);
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
    resetSvg(strip, W, H, playsIntro(options.animate));
    stripGeo = { W, left: m.l, right: m.r };
    const mx = niceMax(Math.max(1, ...tops.flat()));
    const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);
    series.forEach((s, j) => {
      const top = tops[j]!;
      const pts = top.map((v, i) => `${stripX(i).toFixed(1)},${y(v).toFixed(1)}`).join('L');
      const d = stacked
        ? `M${pts}L${baseEdge(stripX, y, bases[j]!, 0, n - 1)}Z`
        : `M${stripX(0)},${y(0)}L${pts}L${stripX(n - 1)},${y(0)}Z`;
      svgEl('path', { d, fill: s.color, 'fill-opacity': 0.16, class: 'fade' }, strip);
      svgEl('path', { d: `M${pts}`, fill: 'none', stroke: s.color, 'stroke-opacity': 0.7, 'stroke-width': 1, 'stroke-linejoin': 'round', class: 'fade' }, strip);
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

  return () => {
    drawChart();
    drawStrip();
  };
}
