// A line chart over day indices, with a crosshair and a tooltip per nearest day. Used by stars and traffic.

import { esc, f0 } from './format';
import { niceMax, ticks } from './scale';
import { type DayAxis, xTicks } from './days';
import { hideTip, showTip } from './tooltip';
import { resetSvg, svgEl, widthOf } from './svg';

export interface TimelineSeries {
  label: string;
  color: string;
  /** One value per entry of `xs`; null where the series has no point. */
  values: Array<number | null>;
}

export interface TimelineOptions {
  /** Ascending day indices of the points, counted by `axis`. */
  xs: readonly number[];
  axis: DayAxis;
  series: readonly TimelineSeries[];
  /** Hover label of a value, e.g. "stars". */
  unit: string;
}

const HEIGHT = 240;

/** Draws the chart into `svg` for the container's current width. */
export function drawTimeline(svg: SVGSVGElement, o: TimelineOptions): void {
  const W = widthOf(svg);
  const H = HEIGHT;
  const m = { l: 44, r: 12, t: 14, b: 28 };
  resetSvg(svg, W, H);
  const first = o.xs[0] ?? 0;
  const last = Math.max(first + 1, o.xs[o.xs.length - 1] ?? first + 1);
  const pw = W - m.l - m.r;
  const x = (i: number): number => m.l + (pw * (i - first)) / (last - first);
  const mx = niceMax(Math.max(0, ...o.series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);

  for (const t of ticks(mx)) {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'axis' }, svg);
    svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = f0(t);
  }
  for (const [i, text] of xTicks(o.axis, first, last, Math.max(2, Math.floor(pw / 72)))) {
    svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, svg).textContent = text;
  }

  for (const s of o.series) {
    let d = '';
    let open = false;
    o.xs.forEach((day, k) => {
      const v = s.values[k];
      // a missing value breaks the line rather than bridging it
      if (v == null) {
        open = false;
        return;
      }
      d += `${open ? 'L' : 'M'}${x(day).toFixed(1)},${y(v).toFixed(1)}`;
      open = true;
    });
    if (d) svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  }

  const cross = svgEl('line', { y1: m.t, y2: y(0), stroke: 'var(--muted)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  const dots = o.series.map((s) => svgEl('circle', { r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg));
  const hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: H - m.t - m.b, fill: 'transparent' }, svg);
  hit.addEventListener('pointermove', (ev) => {
    const px = ev.clientX - svg.getBoundingClientRect().left;
    const target = first + ((px - m.l) / pw) * (last - first);
    let k = 0;
    o.xs.forEach((day, j) => {
      if (Math.abs(day - target) < Math.abs((o.xs[k] ?? 0) - target)) k = j;
    });
    const day = o.xs[k] ?? first;
    cross.setAttribute('x1', String(x(day)));
    cross.setAttribute('x2', String(x(day)));
    cross.setAttribute('visibility', 'visible');
    o.series.forEach((s, j) => {
      const v = s.values[k];
      const dot = dots[j];
      if (!dot) return;
      dot.setAttribute('cx', String(x(day)));
      dot.setAttribute('cy', String(y(v ?? 0)));
      dot.setAttribute('visibility', v == null ? 'hidden' : 'visible');
    });
    const rows = o.series.map((s) => `${esc(s.label)}: ${s.values[k] == null ? '—' : f0(s.values[k] as number)} ${esc(o.unit)}`);
    showTip(`<b>${esc(o.axis.long(day))}</b><br>${rows.join('<br>')}`, ev);
  });
  hit.addEventListener('pointerleave', () => {
    hideTip();
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
  });
}
