// Daily users from the Cloudflare source: the headline users per day as a line over a fade, the events as a
// faint line on the same axis. Both are approximate daily counts, so every label says so.

import type { Dataset } from '@github-stats-action/core';
import { animates } from '@github-stats-action/core';
import {
  areaGradient,
  compact,
  dayOf,
  edgeAnchor,
  emptyNote,
  endDot,
  finite,
  heading,
  ink,
  niceTicks,
  PAD,
  PLOT_LEFT,
  plotTop,
  plural,
  px,
  sample,
  seriesColor,
  showTitle,
  svgDocument,
  svgText,
  timeLabel,
  valueAxis,
  WIDTH,
  xLabels,
  type Box,
  type Key,
  type Theme,
} from './svg';
import { animated, LATE_MS } from './motion';
import { windowed, windowSet } from './window';

const title = 'Daily users';
const PLOT_BOTTOM = 252;

export function cloudflareUsersChart(all: Dataset, theme: Theme): string {
  const dataset = windowed(all, 'cloudflare-users');
  const cloudflare = dataset.cloudflare;
  if (!cloudflare) throw new Error('cloudflareUsersChart needs dataset.cloudflare');
  const titled = showTitle(dataset, 'cloudflare-users');
  const motion = animates(dataset.charts, 'cloudflare-users');
  const days = cloudflare.days;
  const box: Box = { left: PLOT_LEFT, right: WIDTH - PAD, top: plotTop(titled), bottom: PLOT_BOTTOM };

  if (days.length === 0) {
    const message = windowSet(all, 'cloudflare-users') ? 'No days in this window' : 'No days yet';
    return svgDocument(theme, title, `${title}: ${message.toLowerCase()}.`, [
      ...heading(title, 'Approximate users per day', theme, [], titled),
      emptyNote(message, box, theme),
    ]);
  }

  const users = seriesColor(theme, 0);
  const events = seriesColor(theme, 1);
  const keys: Key[] = [
    { label: 'Daily users (approx.)', color: users },
    { label: cloudflare.label, color: events },
  ];
  const end = days.at(-1)!;
  const ticks = niceTicks(Math.max(0, ...days.flatMap((day) => [finite(day.headline), finite(day.events)])));
  const scaleTop = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / scaleTop) * (box.bottom - box.top);

  const first = dayOf(days[0]!.date);
  const span = dayOf(end.date) - first;
  const xOf = (date: string): number =>
    span > 0 ? box.left + ((dayOf(date) - first) / span) * (box.right - box.left) : (box.left + box.right) / 2;
  const curve = (value: (day: { headline: number; events: number }) => number): string =>
    days.map((day, i) => `${i === 0 ? 'M' : 'L'}${px(xOf(day.date))} ${px(yOf(value(day)))}`).join('');
  const line = curve((day) => day.headline);
  const eventLine = curve((day) => day.events);
  const area = `${line}L${px(xOf(end.date))} ${px(box.bottom)}L${px(xOf(days[0]!.date))} ${px(box.bottom)}Z`;

  const label = timeLabel(span);
  const picks = sample(days.length);
  const labels = picks.map((i, k) => ({
    x: xOf(days[i]!.date),
    value: label(dayOf(days[i]!.date)),
    anchor: edgeAnchor(k, picks.length),
  }));

  const endX = xOf(end.date);
  const endY = yOf(end.headline);
  const note = `Approximate users per day, ${plural(days.length, 'day')} to ${end.date}`;
  return svgDocument(theme, title, `${title}: about ${end.headline} daily users on ${end.date}, approximate.`, [
    `<defs>${areaGradient('users-fade', users)}</defs>`,
    ...heading(title, note, theme, keys, titled, 'Approximate daily users'),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(labels, box.bottom + 20, theme),
    ...animated(motion, 'fade', [`<path d="${area}" fill="url(#users-fade)"/>`]),
    ...animated(motion, 'draw', [
      `<path d="${eventLine}" fill="none" stroke="${events}" stroke-opacity="0.5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${motion ? ' pathLength="1"' : ''}/>`,
    ]),
    ...animated(motion, 'draw', [
      `<path d="${line}" fill="none" stroke="${users}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${motion ? ' pathLength="1"' : ''}/>`,
    ]),
    ...animated(
      motion,
      'fade',
      [
        endDot(endX, endY, users, theme, `${end.date}: ${plural(end.headline, 'user')}, approximate`),
        svgText({ x: endX - 8, y: Math.max(box.top + 10, endY - 10), value: compact(end.headline), fill: ink(theme).primary, anchor: 'end', weight: 600 }),
      ],
      `animation-delay:${LATE_MS}ms`,
    ),
  ], motion ? ['draw', 'fade'] : []);
}
