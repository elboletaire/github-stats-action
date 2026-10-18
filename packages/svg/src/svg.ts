// Shared pieces of the SVG charts: document, scales, text, legend and bars. Plain strings,
// no DOM, so each chart is a standalone file for READMEs. Colours and sizes come from the
// theme the dashboard shares.

import { FONT, INK, MARK, TYPE, seriesColor as slotColor, type ChartName, type Dataset, type Ink, type Theme } from '@github-stats-action/core';

export type { Theme };

export const WIDTH = 800;
export const HEIGHT = 300;
export const DAY_MS = 86_400_000;

/** The side margin of every chart, and where the plot starts after the value axis. */
export const PAD = 24;
export const PLOT_LEFT = 60;

/** Whether a chart shows its title and note: its own `title` option, else `charts.titles`, else yes. */
export const showTitle = (dataset: Dataset, chart: ChartName): boolean => dataset.charts?.[chart].title ?? dataset.charts?.titles ?? true;

/** The top of the plot: lower without a title, and lower again to make room for `labelled` rows above it. */
export const plotTop = (titled: boolean, labelled = false): number => (titled ? 80 : 40) + (labelled ? 32 : 0);

export const ink = (theme: Theme): Ink => INK[theme];

export const seriesColor = (theme: Theme, slot: number): string => slotColor(theme, slot);

/** A NaN or Infinity from an empty series becomes 0, so it can't corrupt the markup. */
export const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/** A coordinate with one decimal. */
export const px = (n: number): string => finite(n).toFixed(1);

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** `1 star`, `3 stars`. */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Rough width of a sans label at `size`: enough to keep labels apart, not to typeset them. */
export const textWidth = (value: string, size: number = TYPE.xs): number => value.length * size * 0.6;

const short = (v: number): string => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toString();

/** Compact value for axes and labels: 0, 2.5, 999, 1.2K, 3M. */
export function compact(value: number): string {
  const v = finite(value);
  if (Math.abs(v) >= 1e6) return `${short(v / 1e6)}M`;
  if (Math.abs(v) >= 1e3) return `${short(v / 1e3)}K`;
  return short(v);
}

/** Clean ticks from 0 to at least `max`, about `count` steps; never finer than 1, as the values are counts. */
export function niceTicks(max: number, count = 4): number[] {
  const top = finite(max);
  if (top <= 0) return [0, 1];
  const raw = top / count;
  const base = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * base).find((s) => s >= raw) ?? base * 10);
  const steps = Math.ceil(top / step);
  return Array.from({ length: steps + 1 }, (_, i) => i * step);
}

/** Day number of a YYYY-MM-DD date (UTC). */
export const dayOf = (date: string): number => Date.parse(date) / DAY_MS;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCFullYear()}`;
}

/** Labels for a time axis spanning `span` days: `Sep 9` while under four months, `Sep 2026` beyond. */
export function timeLabel(span: number): (day: number) => string {
  if (span > 120) return monthLabel;
  return (day) => {
    const d = new Date(day * DAY_MS);
    return `${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
  };
}

export function dayLabel(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TextOptions {
  x: number;
  y: number;
  value: string;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: number;
}

export function svgText(o: TextOptions): string {
  const anchor = o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '';
  const size = o.size ? ` font-size="${o.size}"` : '';
  const weight = o.weight ? ` font-weight="${o.weight}"` : '';
  return `<text x="${px(o.x)}" y="${px(o.y)}" fill="${o.fill}"${anchor}${size}${weight}>${esc(o.value)}</text>`;
}

// The whole file: fixed viewBox, a rounded card with a hairline ring, and the title and description
// for screen readers. Figures are tabular so ticks and labels line up.
export function svgDocument(theme: Theme, title: string, desc: string, body: string[]): string {
  const c = INK[theme];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">${esc(desc)}</desc>`,
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="${MARK.radius}" fill="${c.surface}" stroke="${c.border}"/>`,
    `<g font-family='${FONT.sans}' font-size="${TYPE.xs}" fill="${c.secondary}" style="font-variant-numeric:tabular-nums">`,
    ...body,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

/** A vertical fade for an area: the series hue at the line, almost nothing at the baseline. */
export function areaGradient(id: string, color: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity="${MARK.areaTop}"/><stop offset="1" stop-color="${color}" stop-opacity="${MARK.areaBottom}"/></linearGradient>`;
}

export interface Key {
  label: string;
  color: string;
}

/** The width of a legend row: a dot and a label per series, 18px apart. */
function legendWidth(keys: Key[]): number {
  return keys.reduce((sum, k) => sum + 14 + textWidth(k.label, TYPE.sm), 0) + 18 * Math.max(0, keys.length - 1);
}

/** Legend on the title line, right-aligned: a dot and a text label per series. */
function legend(keys: Key[], theme: Theme, right: number, y: number): string[] {
  const widths = keys.map((k) => 14 + textWidth(k.label, TYPE.sm));
  const total = legendWidth(keys);
  let x = right - total;
  return keys.flatMap((k, i) => {
    const at = x;
    x += (widths[i] ?? 0) + 18;
    return [
      `<circle cx="${px(at + 4)}" cy="${px(y - 4)}" r="4" fill="${k.color}"/>`,
      svgText({ x: at + 14, y, value: k.label, fill: INK[theme].secondary, size: TYPE.sm }),
    ];
  });
}

/** Title, note line and legend (when there is more than one series). Without a title, the hint (a small note that says what the data is) and the legend stay on the top line. */
export function heading(title: string, note: string, theme: Theme, keys: Key[] = [], titled = true, hint = ''): string[] {
  if (!titled) {
    // a hint that would run into the legend takes a line of its own, under the top line
    const legendLeft = WIDTH - PAD - (keys.length > 1 ? legendWidth(keys) : 0);
    const hintY = PAD + textWidth(hint, TYPE.xs) + 16 > legendLeft ? 34 : 20;
    return [
      ...(hint ? [svgText({ x: PAD, y: hintY, value: hint, fill: INK[theme].muted, size: TYPE.xs })] : []),
      ...(keys.length > 1 ? legend(keys, theme, WIDTH - PAD, 20) : []),
    ];
  }
  return [
    `<text x="${PAD}" y="32" fill="${INK[theme].primary}" font-size="${TYPE.lg}" font-weight="600">${esc(title)}</text>`,
    svgText({ x: PAD, y: 50, value: note, fill: INK[theme].muted, size: TYPE.sm }),
    ...(keys.length > 1 ? legend(keys, theme, WIDTH - PAD, 32) : []),
  ];
}

/** Hairline gridlines with a value at each tick; the zero tick is the baseline, one step darker. */
export function valueAxis(ticks: number[], yOf: (v: number) => number, box: Box, theme: Theme): string[] {
  const c = INK[theme];
  return ticks.flatMap((v) => {
    const y = yOf(v);
    return [
      `<line x1="${px(box.left)}" x2="${px(box.right)}" y1="${px(y)}" y2="${px(y)}" stroke="${v === 0 ? c.axis : c.grid}"/>`,
      svgText({ x: box.left - 10, y: y + 4, value: compact(v), fill: c.muted, anchor: 'end' }),
    ];
  });
}

/** The clear space kept between an edge label's text and a centred one. */
export const EDGE_GAP = 12;

type AxisItem = { x: number; value: string; anchor?: 'start' | 'middle' | 'end' };

/** Drops the centred labels whose text would come within EDGE_GAP of a start or end label: the edge labels win. */
export function clearOfEdges(items: AxisItem[]): AxisItem[] {
  const extent = (item: AxisItem): [number, number] => {
    const width = textWidth(item.value, TYPE.xs);
    if (item.anchor === 'start') return [item.x, item.x + width];
    if (item.anchor === 'end') return [item.x - width, item.x];
    return [item.x - width / 2, item.x + width / 2];
  };
  const edges = items.filter((item) => item.anchor === 'start' || item.anchor === 'end').map(extent);
  return items.filter((item) => {
    if (item.anchor === 'start' || item.anchor === 'end') return true;
    const [left, right] = extent(item);
    return edges.every(([from, to]) => right + EDGE_GAP <= from || left >= to + EDGE_GAP);
  });
}

/** Labels under the plot, one per mark; a centred one that runs into an edge label is left out. */
export function xLabels(items: AxisItem[], y: number, theme: Theme): string[] {
  return clearOfEdges(items).map((item) => svgText({ x: item.x, y, value: item.value, fill: INK[theme].muted, anchor: item.anchor ?? 'middle' }));
}

/** A centred message on an empty plot. */
export function emptyNote(message: string, box: Box, theme: Theme): string {
  return svgText({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 + 4, value: message, fill: INK[theme].muted, anchor: 'middle', size: TYPE.md });
}

/** A bar from the baseline: square on the baseline, rounded at the data end only. */
export function barPath(x: number, top: number, width: number, height: number, roundTop: boolean): string {
  const bottom = top + height;
  const r = roundTop ? Math.min(MARK.barRadius, width / 2, height) : 0;
  if (r === 0) return `M${px(x)} ${px(bottom)}V${px(top)}H${px(x + width)}V${px(bottom)}Z`;
  return `M${px(x)} ${px(bottom)}V${px(top + r)}Q${px(x)} ${px(top)} ${px(x + r)} ${px(top)}H${px(x + width - r)}Q${px(x + width)} ${px(top)} ${px(x + width)} ${px(top + r)}V${px(bottom)}Z`;
}

export interface Segment {
  value: number;
  color: string;
  title: string;
}

// One stacked column, bottom-up: each segment gives 1px to each neighbour, so they sit 2px apart.
// Only the top is rounded, the baseline stays square; zero values are left out. `index` is the value's
// position, so a caller can colour or group the bars by series.
export function stackBars(x: number, width: number, yOf: (v: number) => number, values: readonly number[]): { index: number; d: string }[] {
  const shown = values.flatMap((value, index) => (finite(value) > 0 ? [{ value, index }] : []));
  let base = 0;
  return shown.map((s, i) => {
    const lower = yOf(base);
    base += finite(s.value);
    const upper = yOf(base);
    const top = upper + (i < shown.length - 1 ? 1 : 0);
    const bottom = lower - (i > 0 ? 1 : 0);
    const height = Math.max(1, bottom - top);
    return { index: s.index, d: barPath(x, bottom - height, width, height, i === shown.length - 1) };
  });
}

/** A stacked column of titled segments, one `<path>` each. */
export function stack(x: number, width: number, yOf: (v: number) => number, segments: Segment[]): string[] {
  return stackBars(x, width, yOf, segments.map((s) => s.value)).map(({ index, d }) => {
    const s = segments[index]!;
    return `<path d="${d}" fill="${s.color}"><title>${esc(s.title)}</title></path>`;
  });
}

/** An end-point dot with a surface ring, titled for hover. */
export function endDot(x: number, y: number, color: string, theme: Theme, title: string): string {
  return `<circle cx="${px(x)}" cy="${px(y)}" r="${MARK.dot}" fill="${color}" stroke="${INK[theme].surface}" stroke-width="2"><title>${esc(title)}</title></circle>`;
}

/** The bar width for slots of `slot` px: capped, with air between neighbours (a hairline once they are dense). */
export function barWidth(slot: number): number {
  const gap = slot < 6 ? 1 : MARK.gap;
  return Math.min(MARK.barMax, Math.max(1, slot - gap));
}

/** Up to five indices spread over `count` items, the first and last included. */
export function sample(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];
  return [...new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (count - 1)) / 4)))];
}

/** Labels at the plot's edges hang off them; the ones between are centred. */
export function edgeAnchor(k: number, count: number): 'start' | 'middle' | 'end' {
  if (count === 1 || (k > 0 && k < count - 1)) return 'middle';
  return k === 0 ? 'start' : 'end';
}
