// Downloads per release: one stacked column per release, by group. Epochs are hairline markers
// capped with a dot, their label beside the cap, placed so the labels never overlap.

import type { Dataset } from '@github-stats-action/core';
import { TYPE } from '@github-stats-action/core';
import {
  barWidth,
  compact,
  emptyNote,
  esc,
  finite,
  heading,
  ink,
  niceTicks,
  PAD,
  PLOT_LEFT,
  plotTop,
  plural,
  px,
  seriesColor,
  showTitle,
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
} from './svg';
import { windowed } from './window';

/** The plot starts lower when there are epoch labels to make room for above it. */
const plotBox = (labelled: boolean, titled: boolean): Box => ({ left: PLOT_LEFT, right: WIDTH - PAD, top: plotTop(titled, labelled), bottom: 252 });
const title = 'Downloads per release';

/** Label rows above the plot, nearest first. Past the last one a label is left out, its marker stays. */
const EPOCH_TIERS = 3;
const TIER_HEIGHT = 14;

interface Span {
  from: number;
  to: number;
  tier: number;
}

export function downloadsPerReleaseChart(all: Dataset, theme: Theme): string {
  const dataset = windowed(all, 'downloads-per-release');
  const keys: Key[] = dataset.groups.map((g) => ({ label: g.label, color: seriesColor(theme, g.color) }));
  const note = 'One column per release, stacked by group';
  const { releases } = dataset;
  const c = ink(theme);
  const titled = showTitle(dataset, 'downloads-per-release');
  const box = plotBox(
    dataset.epochs.some((_, e) => releases.some((r) => r.epoch === e)),
    titled,
  );
  if (releases.length === 0) {
    const message = all.releases.length === 0 ? 'No releases yet' : 'No releases in this window';
    return svgDocument(theme, title, `${title}: ${message.toLowerCase()}.`, [...heading(title, note, theme, keys, titled), emptyNote(message, box, theme)]);
  }

  const totals = releases.map((r) => dataset.groups.reduce((sum, g) => sum + finite(r.groups[g.name] ?? 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / top) * (box.bottom - box.top);

  const slot = (box.right - box.left) / releases.length;
  const width = barWidth(slot);
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

  // the latest release is labelled with its total, so the chart ends on a number
  const last = releases.length - 1;
  const lastTotal = totals[last] ?? 0;
  const totalLabel =
    lastTotal > 0
      ? [svgText({ x: box.left + last * slot + slot / 2, y: yOf(lastTotal) - 8, value: compact(lastTotal), fill: c.primary, anchor: 'middle', size: TYPE.sm, weight: 600 })]
      : [];

  const placed: Span[] = [];
  const markers = dataset.epochs.flatMap((epoch, e) => {
    const k = releases.findIndex((r) => r.epoch === e);
    if (k < 0) return [];
    const x = box.left + k * slot;
    const text = `${epoch.version} ${epoch.label}`;
    const spot = placeLabel(x, text, placed);
    const capY = spot ? labelY(box, spot.tier) - 4 : box.top - 8;
    return [
      `<line x1="${px(x)}" x2="${px(x)}" y1="${px(capY)}" y2="${px(box.bottom)}" stroke="${c.axis}" stroke-width="1"><title>${esc(text)}</title></line>`,
      `<circle cx="${px(x)}" cy="${px(capY)}" r="2.5" fill="${c.muted}"/>`,
      ...(spot ? [svgText({ x: spot.x, y: labelY(box, spot.tier), value: text, fill: c.secondary, anchor: spot.anchor })] : []),
    ];
  });

  const step = Math.max(1, Math.ceil(52 / slot));
  const tagLabels = releases.flatMap((r, i) => (i % step === 0 ? [{ x: box.left + i * slot + slot / 2, value: r.tag }] : []));

  return svgDocument(theme, title, `${title}: ${plural(releases.length, 'release')}, stacked by group.`, [
    ...heading(title, note, theme, keys, titled),
    ...valueAxis(ticks, yOf, box, theme),
    ...markers,
    ...columns,
    ...totalLabel,
    ...xLabels(tagLabels, box.bottom + 20, theme),
  ]);
}

const labelY = (box: Box, tier: number): number => box.top - 12 - tier * TIER_HEIGHT;

/** The first free spot for an epoch label: right of its marker, else left of it, nearest tier first. */
function placeLabel(x: number, text: string, placed: Span[]): { x: number; tier: number; anchor: 'start' | 'end' } | undefined {
  const width = textWidth(text);
  for (let tier = 0; tier < EPOCH_TIERS; tier++) {
    const options = [
      { x: x + 7, anchor: 'start' as const, from: x + 7, to: x + 7 + width },
      { x: x - 7, anchor: 'end' as const, from: x - 7 - width, to: x - 7 },
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
