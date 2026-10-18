// A line chart over day indices, with a crosshair and a tooltip per nearest day. Used by stars and traffic.

import { esc, f0 } from './format';
import { quarterMax, ticks } from './scale';
import { type DayAxis, xTicks } from './days';
import { showTip, tipOn } from './tooltip';
import { fadeFill, gridLines, resetSvg, svgEl, widthOf } from './svg';

export interface TimelineSeries {
  label: string;
  color: string;
  /** One value per entry of `xs`; null where the series has no point. */
  values: Array<number | null>;
}

export interface TimelineOptions {
  /** Prefix of the chart's gradient ids, unique on the page. */
  id: string;
  /** Ascending day indices of the points, counted by `axis`. */
  xs: readonly number[];
  axis: DayAxis;
  series: readonly TimelineSeries[];
  /** Hover label of a value, by its count: "1 star", "2 stars". */
  unit: { one: string; other: string };
  /** Labels the first day's month and year, and leaves out a tick that would run into it. */
  startLabel?: boolean;
}

const HEIGHT = 240;
/** The least gap between the start label and the next tick, in px. */
const START_LABEL_GAP = 60;

/** Draws the chart into `svg` for the container's current width. */
export function drawTimeline(svg: SVGSVGElement, o: TimelineOptions): void {
  const W = widthOf(svg);
  const H = HEIGHT;
  const m = { l: 44, r: 16, t: 16, b: 28 };
  resetSvg(svg, W, H);
  const first = o.xs[0] ?? 0;
  const last = Math.max(first + 1, o.xs[o.xs.length - 1] ?? first + 1);
  const pw = W - m.l - m.r;
  const x = (i: number): number => m.l + (pw * (i - first)) / (last - first);
  const mx = quarterMax(Math.max(0, ...o.series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const y = (v: number): number => m.t + (H - m.t - m.b) * (1 - v / mx);

  gridLines(svg, ticks(mx), y, m.l, W - m.r, f0);
  if (o.startLabel) svgEl('text', { x: x(first), y: H - 8, 'text-anchor': 'start' }, svg).textContent = o.axis.monthYear(first);
  for (const [i, text] of xTicks(o.axis, first, last, Math.max(2, Math.floor(pw / 72)))) {
    if (o.startLabel && x(i) - x(first) < START_LABEL_GAP) continue;
    svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, svg).textContent = text;
  }

  // one series gets a fade under its line and its last value at the end; several share the legend and the tooltip
  const single = o.series.length === 1;
  o.series.forEach((s, j) => {
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
    if (!d) return;
    if (single) {
      const runs = d.split('M').filter(Boolean);
      const area = runs.map((run) => {
        const pts = run.split('L');
        const [x0] = pts[0]!.split(',');
        const [x1] = pts[pts.length - 1]!.split(',');
        return `M${x0},${y(0).toFixed(1)}L${run}L${x1},${y(0).toFixed(1)}Z`;
      }).join('');
      svgEl('path', { d: area, fill: fadeFill(svg, `${o.id}-fade-${j}`, s.color) }, svg);
    }
    svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    const lastK = s.values.length - 1;
    const lastV = s.values[lastK];
    if (single && lastV != null) {
      const ex = x(o.xs[lastK] ?? last);
      const ey = y(lastV);
      svgEl('circle', { cx: ex, cy: ey, r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: ex - 8, y: Math.max(m.t + 10, ey - 10), 'text-anchor': 'end', class: 'strong' }, svg).textContent = f0(lastV);
    }
  });

  const cross = svgEl('line', { y1: m.t, y2: y(0), class: 'base', visibility: 'hidden' }, svg);
  const dots = o.series.map((s) => svgEl('circle', { r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg));
  const hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: H - m.t - m.b, fill: 'transparent' }, svg);
  // tipOn handles the tooltip for mouse and tap; the crosshair follows the same pointer
  tipOn(hit, (ev) => {
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
    const rows = o.series.map((s) => {
      const value = s.values[k];
      const unit = value === 1 ? o.unit.one : o.unit.other;
      return `${esc(s.label)}: ${value == null ? '—' : f0(value)} ${esc(unit)}`;
    });
    showTip(`<b>${esc(o.axis.long(day))}</b><br>${rows.join('<br>')}`, ev);
  });
  hit.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'touch') return;
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
  });
}
