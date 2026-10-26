// The stars chart's sampled view: the README chart's samples (core's starsSamples: its window and start-at-zero)
// placed at their dates on the same day axis as the daily view, a monotone curve through them, a dot on each and
// a tooltip per sample.

import type { Dataset, StarPoint } from '@github-stats-action/core';
import { drawShares, monotonePath, starsSamples, type CurvePoint } from '@github-stats-action/core/stars';
import { type DayAxis, xTicks } from './days';
import { esc, f0 } from './format';
import { fadeFill, gridLines, resetSvg, svgEl, widthOf } from './svg';
import { quarterMax, ticks } from './scale';
import { showTip, tipOn } from './tooltip';
import { DRAW_MS, introDelay, playsIntro } from './intro';

const HEIGHT = 240;
/** The least gap between the start label and the next tick, in px. */
const START_LABEL_GAP = 60;

export interface SampledOptions {
  /** Prefix of the chart's gradient id, unique on the page. */
  id: string;
  axis: DayAxis;
  /** The samples, each with the real count its tooltip shows. */
  samples: readonly StarPoint[];
  /** The value each sample is drawn at; the first is zero when `startsAtZero`. */
  values: readonly number[];
  startsAtZero: boolean;
  /** Ascending day indices of the samples, counted by `axis`. */
  xs: readonly number[];
  color: string;
  /** Whether the chart's config animates it on load. */
  animate: boolean;
  /** The chart's height in px; the default is the dashboard's usual 240. */
  height?: number;
}

/** The samples of `d` in its `charts.stars` window, placed on `axis`, with the values they are drawn at. */
export function sampledPoints(d: Dataset, axis: DayAxis): Pick<SampledOptions, 'samples' | 'values' | 'startsAtZero' | 'xs'> {
  const { samples, plotted, startsAtZero } = starsSamples(d);
  return {
    samples,
    values: plotted,
    startsAtZero,
    xs: samples.map((p) => axis.indexOf(Date.parse(`${p.date}T00:00:00Z`))),
  };
}

/** Draws the samples into `svg` for the container's current width. */
export function drawSampled(svg: SVGSVGElement, o: SampledOptions): void {
  const W = widthOf(svg);
  const H = o.height ?? HEIGHT;
  const m = { l: 44, r: 16, t: 16, b: 28 };
  resetSvg(svg, W, H, playsIntro(o.animate));
  const { axis, samples, values, xs, color } = o;
  const n = samples.length;
  // the window holds no star: the README chart says so in its middle, and so does this view
  if (n === 0) {
    svgEl('text', { x: W / 2, y: H / 2 + 4, 'text-anchor': 'middle' }, svg).textContent = 'No stars in this window';
    return;
  }

  const first = xs[0]!;
  const last = Math.max(first + 1, xs[n - 1]!);
  const pw = W - m.l - m.r;
  const x = (day: number): number => m.l + (pw * (day - first)) / (last - first);
  const mx = quarterMax(Math.max(0, ...values));
  const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);
  const base = y(0);

  gridLines(svg, ticks(mx), y, m.l, W - m.r, f0);
  svgEl('text', { x: x(first), y: H - 8, 'text-anchor': 'start' }, svg).textContent = axis.monthYear(first);
  for (const [day, text] of xTicks(axis, first, last, Math.max(2, Math.floor(pw / 72)))) {
    if (x(day) - x(first) < START_LABEL_GAP) continue;
    svgEl('text', { x: x(day), y: H - 8, 'text-anchor': 'middle' }, svg).textContent = text;
  }

  const points: CurvePoint[] = values.map((v, i) => [x(xs[i]!), y(v)]);
  const line = monotonePath(points);
  const endX = x(xs[n - 1]!);
  svgEl('path', { d: `${line}L${endX.toFixed(1)},${base.toFixed(1)}L${x(first).toFixed(1)},${base.toFixed(1)}Z`, fill: fadeFill(svg, `${o.id}-fade`, color), class: 'fade' }, svg);
  svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, class: 'draw' }, svg);
  // each dot pops in as the drawn line reaches it: its share of the line's length, of the draw
  const shares = drawShares(points);
  values.slice(0, -1).forEach((v, i) => {
    svgEl('circle', { cx: x(xs[i]!), cy: y(v), r: 3, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, class: 'pop', ...introDelay(DRAW_MS * shares[i]!) }, svg);
  });
  const endY = y(values[n - 1]!);
  svgEl('circle', { cx: endX, cy: endY, r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, class: 'late' }, svg);
  svgEl('text', { x: endX - 8, y: Math.max(m.t + 10, endY - 10), 'text-anchor': 'end', class: 'strong late' }, svg).textContent = f0(samples[n - 1]!.stars);

  const cross = svgEl('line', { y1: m.t, y2: base, class: 'base', visibility: 'hidden' }, svg);
  const dot = svgEl('circle', { r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
  const hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: H - m.t - m.b, fill: 'transparent' }, svg);
  // the nearest sample by day, so a tap or hover lands on a point even between two of them
  tipOn(hit, (ev) => {
    const px = ev.clientX - svg.getBoundingClientRect().left;
    const target = first + ((px - m.l) / pw) * (last - first);
    let k = 0;
    xs.forEach((day, j) => {
      if (Math.abs(day - target) < Math.abs(xs[k]! - target)) k = j;
    });
    const p = samples[k]!;
    cross.setAttribute('x1', String(x(xs[k]!)));
    cross.setAttribute('x2', String(x(xs[k]!)));
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', String(x(xs[k]!)));
    dot.setAttribute('cy', String(y(values[k]!)));
    dot.setAttribute('visibility', 'visible');
    // as the README chart's tooltip: the first point keeps its real count when it is drawn at zero
    const before = k === 0 && o.startsAtZero ? ' before the window' : '';
    showTip(`<b>${esc(axis.long(xs[k]!))}</b><br>${f0(p.stars)} ${p.stars === 1 ? 'star' : 'stars'}${before}`, ev);
  });
  hit.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'touch') return;
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
  });
}
