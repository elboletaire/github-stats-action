// Downloads per release: one stacked column per release, by group. Epochs are hairline markers
// with their label above the plot, placed so the labels never overlap.

import type { Dataset } from '@github-stats-action/core';
import {
  finite,
  heading,
  ink,
  compact,
  esc,
  niceTicks,
  seriesColor,
  stack,
  svgDocument,
  svgText,
  textWidth,
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Key,
  type Theme,
  plural,
} from './svg';

const box: Box = { left: 56, right: WIDTH - 24, top: 104, bottom: 256 };
const title = 'Downloads per release';

/** Label rows above the plot, nearest first. Past the last one a label is left out, its marker stays. */
const EPOCH_TIERS = 3;
const TIER_HEIGHT = 13;
const MARKER_TOP = 60;

interface Span {
  from: number;
  to: number;
  tier: number;
}

export function downloadsPerReleaseChart(dataset: Dataset, theme: Theme): string {
  const keys: Key[] = dataset.groups.map((g) => ({ label: g.label, color: seriesColor(theme, g.color) }));
  const note = 'One column per release, stacked by group';
  const { releases } = dataset;
  const c = ink(theme);
  if (releases.length === 0) {
    return svgDocument(theme, title, `${title}: no releases yet.`, [
      ...heading(title, note, theme, keys),
      svgText({ x: WIDTH / 2, y: (box.top + box.bottom) / 2, value: 'No releases yet', fill: c.secondary, anchor: 'middle', size: 13 }),
    ]);
  }

  const totals = releases.map((r) => dataset.groups.reduce((sum, g) => sum + finite(r.groups[g.name] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);

  const slot = (box.right - box.left) / releases.length;
  const width = Math.min(24, Math.max(1, slot - 2));
  const columns = releases.flatMap((r, i) => {
    const x = box.left + i * slot + (slot - width) / 2;
    return stack(
      x,
      width,
      yOf,
      dataset.groups.map((g) => {
        const value = finite(r.groups[g.name] ?? 0);
        return { value, color: seriesColor(theme, g.color), title: `${r.tag}, ${g.label}: ${value}` };
      }),
    );
  });

  const last = releases.length - 1;
  const lastTotal = totals[last] ?? 0;
  const totalLabel =
    lastTotal > 0
      ? [svgText({ x: box.left + last * slot + slot / 2, y: yOf(lastTotal) - 4, value: compact(lastTotal), fill: c.primary, anchor: 'middle' })]
      : [];

  const placed: Span[] = [];
  const markers = dataset.epochs.flatMap((epoch, e) => {
    const k = releases.findIndex((r) => r.epoch === e);
    if (k < 0) return [];
    const x = box.left + k * slot;
    const text = `${epoch.version} ${epoch.label}`;
    const spot = placeLabel(x, text, placed);
    return [
      `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${MARKER_TOP}" y2="${box.bottom}" stroke="${c.axis}" stroke-width="1"><title>${esc(text)}</title></line>`,
      ...(spot ? [svgText({ x: spot.x, y: labelY(spot.tier), value: text, fill: c.secondary, anchor: spot.anchor })] : []),
    ];
  });

  const step = Math.max(1, Math.ceil(48 / slot));
  const tagLabels = releases.flatMap((r, i) => (i % step === 0 ? [{ x: box.left + i * slot + slot / 2, value: r.tag }] : []));

  return svgDocument(theme, title, `${title}: ${plural(releases.length, 'release')}, stacked by group.`, [
    ...heading(title, note, theme, keys),
    ...valueAxis(ticks, yOf, box, theme),
    ...markers,
    ...columns,
    ...totalLabel,
    ...xLabels(tagLabels, box.bottom + 16, theme),
  ]);
}

const labelY = (tier: number): number => box.top - 8 - tier * TIER_HEIGHT;

/** The first free spot for an epoch label: right of its marker, else left of it, nearest tier first. */
function placeLabel(x: number, text: string, placed: Span[]): { x: number; tier: number; anchor: 'start' | 'end' } | undefined {
  const width = textWidth(text);
  for (let tier = 0; tier < EPOCH_TIERS; tier++) {
    const options = [
      { x: x + 4, anchor: 'start' as const, from: x + 4, to: x + 4 + width },
      { x: x - 4, anchor: 'end' as const, from: x - 4 - width, to: x - 4 },
    ];
    for (const option of options) {
      if (option.from < 8 || option.to > WIDTH - 8) continue;
      if (placed.some((p) => p.tier === tier && option.from < p.to + 8 && p.from < option.to + 8)) continue;
      placed.push({ from: option.from, to: option.to, tier });
      return { x: option.x, tier, anchor: option.anchor };
    }
  }
  return undefined;
}
