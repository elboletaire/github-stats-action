// The stars chart's sampled view: about 30 samples placed at their dates on the same day axis as the daily
// view, a monotone curve through them, a dot on each and a tooltip per sample.

import { monotonePath, type CurvePoint } from '@github-stats-action/core/stars';
import type { StarPoint } from '@github-stats-action/core';
import { type DayAxis, xTicks } from './days';
import { esc, f0 } from './format';
import { fadeFill, gridLines, resetSvg, svgEl, widthOf } from './svg';
import { quarterMax, ticks } from './scale';
import { showTip, tipOn } from './tooltip';

const HEIGHT = 240;
/** The least gap between the start label and the next tick, in px. */
const START_LABEL_GAP = 60;

export interface SampledOptions {
  /** Prefix of the chart's gradient id, unique on the page. */
  id: string;
  axis: DayAxis;
  samples: readonly StarPoint[];
  /** Ascending day indices of the samples, counted by `axis`. */
  xs: readonly number[];
  color: string;
}

/** Draws the samples into `svg` for the container's current width. */
export function drawSampled(svg: SVGSVGElement, o: SampledOptions): void {
  const W = widthOf(svg);
  const H = HEIGHT;
  const m = { l: 44, r: 16, t: 16, b: 28 };
  resetSvg(svg, W, H);
  const { axis, samples, xs, color } = o;
  const n = samples.length;
  if (n === 0) return;

  const first = xs[0]!;
  const last = Math.max(first + 1, xs[n - 1]!);
  const pw = W - m.l - m.r;
  const x = (day: number): number => m.l + (pw * (day - first)) / (last - first);
  const mx = quarterMax(Math.max(0, ...samples.map((p) => p.stars)));
  const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);
  const base = y(0);

  gridLines(svg, ticks(mx), y, m.l, W - m.r, f0);
  svgEl('text', { x: x(first), y: H - 8, 'text-anchor': 'start' }, svg).textContent = axis.monthYear(first);
  for (const [day, text] of xTicks(axis, first, last, Math.max(2, Math.floor(pw / 72)))) {
    if (x(day) - x(first) < START_LABEL_GAP) continue;
    svgEl('text', { x: x(day), y: H - 8, 'text-anchor': 'middle' }, svg).textContent = text;
  }

  const points: CurvePoint[] = samples.map((p, i) => [x(xs[i]!), y(p.stars)]);
  const line = monotonePath(points);
  const endX = x(xs[n - 1]!);
  svgEl('path', { d: `${line}L${endX.toFixed(1)},${base.toFixed(1)}L${x(first).toFixed(1)},${base.toFixed(1)}Z`, fill: fadeFill(svg, `${o.id}-fade`, color) }, svg);
  svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  samples.slice(0, -1).forEach((p, i) => {
    svgEl('circle', { cx: x(xs[i]!), cy: y(p.stars), r: 3, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
  });
  const endY = y(samples[n - 1]!.stars);
  svgEl('circle', { cx: endX, cy: endY, r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
  svgEl('text', { x: endX - 8, y: Math.max(m.t + 10, endY - 10), 'text-anchor': 'end', class: 'strong' }, svg).textContent = f0(samples[n - 1]!.stars);

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
    dot.setAttribute('cy', String(y(p.stars)));
    dot.setAttribute('visibility', 'visible');
    showTip(`<b>${esc(axis.long(xs[k]!))}</b><br>${f0(p.stars)} ${p.stars === 1 ? 'star' : 'stars'}`, ev);
  });
  hit.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'touch') return;
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
  });
}
