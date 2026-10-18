// Shared pieces of the SVG charts: document, scales, text, legend and bars. Plain strings,
// no DOM, so each chart is a standalone file for READMEs.

export type Theme = 'light' | 'dark';

export const WIDTH = 800;
export const HEIGHT = 300;
export const DAY_MS = 86_400_000;

export interface Ink {
  surface: string;
  primary: string;
  secondary: string;
  muted: string;
  grid: string;
  axis: string;
}

/** Chart chrome per mode: surface, text tokens, gridline and baseline. */
const INK: Record<Theme, Ink> = {
  light: { surface: '#fcfcfb', primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
  dark: { surface: '#1a1a19', primary: '#f0efec', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
};

export const ink = (theme: Theme): Ink => INK[theme];

/** The categorical slots of the reference palette, in their fixed order, per mode. */
const CATEGORICAL: Record<Theme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#0c9080', '#b57f00', '#c44a80', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

/** A series' colour by its slot. Past the eighth there is no hue left, so it takes the muted ink. */
export function seriesColor(theme: Theme, slot: number): string {
  return CATEGORICAL[theme][slot] ?? INK[theme].muted;
}

/** A NaN or Infinity from an empty series becomes 0, so it can't corrupt the markup. */
export const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/** A coordinate with one decimal. */
export const px = (n: number): string => finite(n).toFixed(1);

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Rough width of a sans label at `size`: enough to keep labels apart, not to typeset them. */
export const textWidth = (value: string, size = 11): number => value.length * size * 0.6;

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

/** The whole file: fixed viewBox, a surface rect, and the title and description for screen readers. */
export function svgDocument(theme: Theme, title: string, desc: string, body: string[]): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">${esc(desc)}</desc>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${INK[theme].surface}"/>`,
    `<g font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="11" fill="${INK[theme].secondary}">`,
    ...body,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

export interface Key {
  label: string;
  color: string;
}

/** Legend on the title line, right-aligned: a swatch and a text label per series. */
function legend(keys: Key[], theme: Theme, right: number, y: number): string[] {
  const widths = keys.map((k) => 16 + textWidth(k.label));
  const total = widths.reduce((sum, w) => sum + w, 0) + 16 * Math.max(0, keys.length - 1);
  let x = right - total;
  return keys.flatMap((k, i) => {
    const at = x;
    x += (widths[i] ?? 0) + 16;
    return [
      `<rect x="${px(at)}" y="${px(y - 9)}" width="10" height="10" rx="2" fill="${k.color}"/>`,
      svgText({ x: at + 16, y, value: k.label, fill: INK[theme].secondary }),
    ];
  });
}

/** Title, note line and legend (when there is more than one series). */
export function heading(title: string, note: string, theme: Theme, keys: Key[] = []): string[] {
  return [
    svgText({ x: 24, y: 28, value: title, fill: INK[theme].primary, size: 14, weight: 600 }),
    svgText({ x: 24, y: 46, value: note, fill: INK[theme].secondary }),
    ...(keys.length > 1 ? legend(keys, theme, WIDTH - 24, 28) : []),
  ];
}

/** Gridlines with a value at each tick; the zero tick is the baseline. */
export function valueAxis(ticks: number[], yOf: (v: number) => number, box: Box, theme: Theme): string[] {
  const c = INK[theme];
  return ticks.flatMap((v) => {
    const y = yOf(v);
    return [
      `<line x1="${px(box.left)}" x2="${px(box.right)}" y1="${px(y)}" y2="${px(y)}" stroke="${v === 0 ? c.axis : c.grid}" stroke-width="1"/>`,
      svgText({ x: box.left - 8, y: y + 4, value: compact(v), fill: c.muted, anchor: 'end' }),
    ];
  });
}

/** Labels under the plot, one per mark. */
export function xLabels(items: { x: number; value: string; anchor?: 'start' | 'middle' | 'end' }[], y: number, theme: Theme): string[] {
  return items.map((item) => svgText({ x: item.x, y, value: item.value, fill: INK[theme].muted, anchor: item.anchor ?? 'middle' }));
}

/** A bar from the baseline: square on the baseline, 4px rounded at the data end only. */
export function barPath(x: number, top: number, width: number, height: number, roundTop: boolean): string {
  const bottom = top + height;
  const r = roundTop ? Math.min(4, width / 2, height) : 0;
  if (r === 0) return `M${px(x)} ${px(bottom)}V${px(top)}H${px(x + width)}V${px(bottom)}Z`;
  return `M${px(x)} ${px(bottom)}V${px(top + r)}Q${px(x)} ${px(top)} ${px(x + r)} ${px(top)}H${px(x + width - r)}Q${px(x + width)} ${px(top)} ${px(x + width)} ${px(top + r)}V${px(bottom)}Z`;
}

export interface Segment {
  value: number;
  color: string;
  title: string;
}

// One stacked column, bottom-up: each segment gives 1px to each neighbour, so they sit 2px apart.
// Only the top is rounded, the baseline stays square; zero segments are left out.
export function stack(x: number, width: number, yOf: (v: number) => number, segments: Segment[]): string[] {
  const shown = segments.filter((s) => finite(s.value) > 0);
  let base = 0;
  return shown.map((s, i) => {
    const lower = yOf(base);
    base += finite(s.value);
    const upper = yOf(base);
    const top = upper + (i < shown.length - 1 ? 1 : 0);
    const bottom = lower - (i > 0 ? 1 : 0);
    const height = Math.max(1, bottom - top);
    const d = barPath(x, bottom - height, width, height, i === shown.length - 1);
    return `<path d="${d}" fill="${s.color}"><title>${esc(s.title)}</title></path>`;
  });
}
