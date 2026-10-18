// SVG helpers: element creation, sizing, and the rounded bar end.

const NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number>;

export function svgEl(tag: string, attrs: Attrs = {}, parent?: Element): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const key of Object.keys(attrs)) el.setAttribute(key, String(attrs[key]));
  parent?.appendChild(el);
  return el as SVGElement;
}

/** Empties the chart and sets its viewBox and size. */
export function resetSvg(svg: SVGSVGElement, width: number, height: number): void {
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.replaceChildren();
}

/** The chart's drawable width: its container's, never below `min`. */
export function widthOf(svg: SVGSVGElement, min = 300): number {
  return Math.max(min, (svg.parentElement?.clientWidth ?? min) - 4);
}

/** A rectangle with its top corners rounded by `r` and a flat base. */
export function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** A vertical fade under a line, from the series hue at the top to almost nothing at the baseline; returns its fill. */
export function fadeFill(svg: SVGSVGElement, id: string, color: string, top = 0.22): string {
  const defs = svg.querySelector('defs') ?? svgEl('defs', {}, svg);
  const grad = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svgEl('stop', { 'stop-color': color, 'stop-opacity': top }, grad);
  svgEl('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0.02 }, grad);
  return `url(#${id})`;
}

/** Hairline gridlines with a label at each tick; the zero tick is the baseline, one step darker. */
export function gridLines(svg: SVGSVGElement, ticks: readonly number[], y: (v: number) => number, x1: number, x2: number, label: (v: number) => string): void {
  for (const t of ticks) {
    svgEl('line', { x1, x2, y1: y(t), y2: y(t), class: t === 0 ? 'base' : 'axis' }, svg);
    svgEl('text', { x: x1 - 8, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = label(t);
  }
}

/** A transparent rectangle that catches the pointer over a slot. */
export function hitRect(parent: Element, x: number, y: number, w: number, h: number): SVGElement {
  return svgEl('rect', { x, y, width: Math.max(0, w), height: Math.max(0, h), fill: 'transparent' }, parent);
}
