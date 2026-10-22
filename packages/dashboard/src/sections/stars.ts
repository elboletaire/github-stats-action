// Stars over time: the cumulative count as a daily line or as about 30 sampled points, both on a linear time
// axis from the first star, and a table of each month's last value.

import { animates, type Dataset } from '@github-stats-action/core';
import { sampleStars } from '@github-stats-action/core/stars';
import { dayAxis } from '../days';
import { esc, f0 } from '../format';
import { colorVar } from '../palette';
import { drawSampled } from '../sampled';
import { drawTimeline } from '../timeline';
import { makeSection, type Section } from './common';

type View = 'daily' | 'sampled';

/** The view the reader last chose, kept per browser only; a blocked store just means the default. */
const VIEW_KEY = 'stars-view';
const VIEWS: Array<[View, string]> = [
  ['daily', 'Daily'],
  ['sampled', 'Sampled'],
];

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'sampled' ? 'sampled' : 'daily';
  } catch {
    return 'daily';
  }
}

function saveView(view: View): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // private windows and blocked storage: the choice just isn't remembered
  }
}

export function stars(d: Dataset): Section {
  const points = d.stars;
  if (points.length === 0) {
    return { el: makeSection('<div><h2>Stars over time</h2><p class="note">No stargazers collected yet.</p></div>') };
  }
  const notes: Record<View, string> = {
    daily: 'Cumulative stars at the end of each UTC day, from the stargazers\' timestamps. Hover or tap for a day.',
    sampled: 'Cumulative stars at about 30 points along the history, from the stargazers\' timestamps. Hover or tap a point for its date.',
  };
  const axis = dayAxis(points[0]!.date);
  const xs = points.map((p) => axis.indexOf(Date.parse(`${p.date}T00:00:00Z`)));
  const values = points.map((p) => p.stars);
  const color = colorVar({ color: 0 });
  const animate = animates(d.charts, 'stars');
  const samples = sampleStars(points);
  const sampledXs = samples.map((p) => axis.indexOf(Date.parse(`${p.date}T00:00:00Z`)));

  // the last point of each month is the month's count
  const months = new Map<string, { date: string; stars: number }>();
  for (const p of points) months.set(p.date.slice(0, 7), p);
  const table = `<thead><tr><th>Month</th><th>Stars at month end</th></tr></thead><tbody>` +
    [...months.values()].map((p) => `<tr><td>${esc(p.date.slice(0, 7))}</td><td>${f0(p.stars)}</td></tr>`).join('') + '</tbody>';

  const el = makeSection(
    `<div><h2>Stars over time</h2><p class="note" data-note></p></div>` +
    `<div class="presets"><span class="group" role="group" aria-label="Chart view" data-views></span></div>` +
    `<div class="scroll"><svg role="img" aria-label="Cumulative stars over time"></svg></div>` +
    `<details><summary>Table view</summary><div class="scroll"><table>${table}</table></div></details>`,
  );
  const svg = el.querySelector('svg') as SVGSVGElement;
  const viewBox = el.querySelector('[data-views]') as HTMLElement;
  const noteEl = el.querySelector('[data-note]') as HTMLElement;

  let view = savedView();
  const draw = (): void => {
    noteEl.textContent = notes[view];
    if (view === 'sampled') {
      drawSampled(svg, { id: 'stars', axis, samples, xs: sampledXs, color, animate });
    } else {
      drawTimeline(svg, { id: 'stars', xs, axis, series: [{ label: 'Stars', color, values }], unit: { one: 'star', other: 'stars' }, startLabel: true, animate });
    }
  };
  const buttons = VIEWS.map(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      view = key;
      saveView(key);
      syncViews();
      draw();
    });
    viewBox.appendChild(button);
    return button;
  });
  const syncViews = (): void => {
    VIEWS.forEach(([key], j) => buttons[j]!.setAttribute('aria-pressed', String(view === key)));
  };
  syncViews();

  return { el, redraw: draw };
}
