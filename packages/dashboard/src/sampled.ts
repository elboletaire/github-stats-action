// The stars chart in even spacing: the samples at equal steps by index, a monotone curve through them,
// a dot on each and a tooltip per sample. The sibling of timeline.ts, which spaces the days by date.

import type { StarPoint } from '@github-stats-action/core';
import { monotonePath, sampleTicks, type CurvePoint } from '@github-stats-action/core/stars';
import { longDate } from './days';
import { esc, f0 } from './format';
import { fadeFill, gridLines, resetSvg, svgEl, widthOf } from './svg';
import { quarterMax, ticks } from './scale';
import { showTip, tipOn } from './tooltip';

const HEIGHT = 240;
/** The least gap between two axis labels, in px. */
const LABEL_GAP = 44;

/** Draws the samples into `svg` for the container's current width. */
export function drawSampled(svg: SVGSVGElement, samples: readonly StarPoint[], color: string, id: string): void {
  const W = widthOf(svg);
  const H = HEIGHT;
  const m = { l: 44, r: 16, t: 16, b: 28 };
  resetSvg(svg, W, H);
  const n = samples.length;
  const pw = W - m.l - m.r;
  const mx = quarterMax(Math.max(0, ...samples.map((p) => p.stars)));
  const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);
  const x = (i: number): number => (n > 1 ? m.l + (pw * i) / (n - 1) : m.l + pw / 2);
  const base = y(0);

  gridLines(svg, ticks(mx), y, m.l, W - m.r, f0);
  const minGap = n > 1 ? Math.max(1, Math.ceil(LABEL_GAP / (pw / (n - 1)))) : 1;
  for (const tick of sampleTicks(samples, minGap)) {
    const anchor = tick.index === 0 ? 'start' : tick.index === n - 1 ? 'end' : 'middle';
    svgEl('text', { x: x(tick.index), y: H - 8, 'text-anchor': anchor }, svg).textContent = tick.label;
  }
  if (n === 0) return;

  const points: CurvePoint[] = samples.map((p, i) => [x(i), y(p.stars)]);
  const line = monotonePath(points);
  const last = n - 1;
  svgEl('path', { d: `${line}L${x(last).toFixed(1)},${base.toFixed(1)}L${x(0).toFixed(1)},${base.toFixed(1)}Z`, fill: fadeFill(svg, `${id}-fade`, color) }, svg);
  svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  samples.slice(0, -1).forEach((p, i) => {
    svgEl('circle', { cx: x(i), cy: y(p.stars), r: 3, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
  });
  const endX = x(last);
  const endY = y(samples[last]!.stars);
  svgEl('circle', { cx: endX, cy: endY, r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
  svgEl('text', { x: endX - 8, y: Math.max(m.t + 10, endY - 10), 'text-anchor': 'end', class: 'strong' }, svg).textContent = f0(samples[last]!.stars);

  const cross = svgEl('line', { y1: m.t, y2: base, class: 'base', visibility: 'hidden' }, svg);
  const dot = svgEl('circle', { r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
  const hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: H - m.t - m.b, fill: 'transparent' }, svg);
  // the nearest sample by index, so a tap or hover lands on a point even between two of them
  tipOn(hit, (ev) => {
    const px = ev.clientX - svg.getBoundingClientRect().left;
    const i = Math.min(last, Math.max(0, Math.round(((px - m.l) / pw) * last)));
    const p = samples[i]!;
    cross.setAttribute('x1', String(x(i)));
    cross.setAttribute('x2', String(x(i)));
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', String(x(i)));
    dot.setAttribute('cy', String(y(p.stars)));
    dot.setAttribute('visibility', 'visible');
    showTip(`<b>${esc(longDate(p.date))}</b><br>${f0(p.stars)} ${p.stars === 1 ? 'star' : 'stars'}`, ev);
  });
  hit.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'touch') return;
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
  });
}
