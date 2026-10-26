// Daily users from the Cloudflare source: Total as a line over a fade, and one plain line per value of the
// primary dimension. All are approximate daily counts, so the labels say so.

import type { Dataset } from '@github-stats-action/core';
import { animates, cloudflareUserSeries } from '@github-stats-action/core';
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

  const lines = cloudflareUserSeries(cloudflare);
  const colors = lines.map((_, i) => seriesColor(theme, i));
  const keys: Key[] = lines.map((line, i) => ({
    label: i === 0 ? `${line.label} (approx.)` : line.label,
    color: colors[i]!,
  }));
  const total = lines[0]!;
  const end = days.at(-1)!;
  const endUsers = total.values.at(-1)!.users;
  const ticks = niceTicks(Math.max(0, ...lines.flatMap((line) => line.values.map((v) => finite(v.users)))));
  const scaleTop = ticks.at(-1) ?? 1;
  const yOf = (v: number): number => box.bottom - (finite(v) / scaleTop) * (box.bottom - box.top);

  const first = dayOf(days[0]!.date);
  const span = dayOf(end.date) - first;
  const xOf = (date: string): number =>
    span > 0 ? box.left + ((dayOf(date) - first) / span) * (box.right - box.left) : (box.left + box.right) / 2;
  const curve = (values: { date: string; users: number }[]): string =>
    values.map((point, i) => `${i === 0 ? 'M' : 'L'}${px(xOf(point.date))} ${px(yOf(point.users))}`).join('');
  const totalLine = curve(total.values);
  const area = `${totalLine}L${px(xOf(end.date))} ${px(box.bottom)}L${px(xOf(days[0]!.date))} ${px(box.bottom)}Z`;

  const label = timeLabel(span);
  const picks = sample(days.length);
  const labels = picks.map((i, k) => ({
    x: xOf(days[i]!.date),
    value: label(dayOf(days[i]!.date)),
    anchor: edgeAnchor(k, picks.length),
  }));

  const endX = xOf(end.date);
  const endY = yOf(endUsers);
  const note = `Approximate users per day, ${plural(days.length, 'day')} to ${end.date}`;
  return svgDocument(theme, title, `${title}: about ${endUsers} daily users in total on ${end.date}, approximate.`, [
    `<defs>${areaGradient('users-fade', colors[0]!)}</defs>`,
    ...heading(title, note, theme, keys, titled, 'Approximate daily users'),
    ...valueAxis(ticks, yOf, box, theme),
    ...xLabels(labels, box.bottom + 20, theme),
    ...animated(motion, 'fade', [`<path d="${area}" fill="url(#users-fade)"/>`]),
    ...lines.slice(1).flatMap((line, i) =>
      animated(motion, 'draw', [
        `<path d="${curve(line.values)}" fill="none" stroke="${colors[i + 1]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${motion ? ' pathLength="1"' : ''}/>`,
      ]),
    ),
    ...animated(motion, 'draw', [
      `<path d="${totalLine}" fill="none" stroke="${colors[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${motion ? ' pathLength="1"' : ''}/>`,
    ]),
    ...animated(
      motion,
      'fade',
      [
        endDot(endX, endY, colors[0]!, theme, `${end.date}: ${plural(endUsers, 'user')}, approximate`),
        svgText({ x: endX - 8, y: Math.max(box.top + 10, endY - 10), value: compact(endUsers), fill: ink(theme).primary, anchor: 'end', weight: 600 }),
      ],
      `animation-delay:${LATE_MS}ms`,
    ),
  ], motion ? ['draw', 'fade'] : []);
}
