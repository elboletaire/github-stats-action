// What every section shares: the section element, a redraw hook, and the legend markup.

import { esc } from '../format';

export interface Section {
  el: HTMLElement;
  /** Redraws the charts for the current width; called on load and on resize. */
  redraw?: () => void;
}

/** A `<section>` card with the given inner markup. */
export function makeSection(inner: string): HTMLElement {
  const el = document.createElement('section');
  el.innerHTML = inner;
  return el;
}

export interface LegendItem {
  label: string;
  /** A CSS colour; dashed items draw a line sample instead of a swatch. */
  color: string;
  dashed?: boolean;
}

/** A legend row. Identity needs one only when there are two or more series. */
export function legendHtml(items: readonly LegendItem[]): string {
  if (items.length < 2) return '';
  const marks = items.map((item) =>
    item.dashed
      ? `<i class="line" style="background:${item.color}"></i>`
      : `<i class="sw" style="background:${item.color}"></i>`,
  );
  return `<div class="legend">${items.map((item, i) => `<span>${marks[i]}${esc(item.label)}</span>`).join('')}</div>`;
}
