// Cloudflare Analytics Engine figures for the Dataset: headline users per day, totals, each dimension's
// shares and the counters per daily user. Pure, no I/O.

import { OTHER } from './assets';
import { primarySubtag, type CloudflareRule } from './config';
import { addDays, dayNumber } from './npm';
import { compareVersions, parseVersion } from './semver';
import { SLOTS } from './theme';
import type {
  CloudflareCount,
  CloudflareData,
  CloudflareDay,
  CloudflareDimensionInfo,
  CloudflareSeries,
  CloudflareShare,
  MeasuredDay,
} from './types';

/** A line of the usage chart: Total, or one value of the primary dimension. */
export interface CloudflareUserSeries {
  key: string;
  label: string;
  values: { date: string; users: number }[];
}

/** The window of the 30-day figures: shares, events and counters per user. */
const LAST_DAYS = 30;
/** Values shown per dimension; the rest fold into `other`. */
const SHARE_LIMIT = 8;
/** Value lines on the usage chart: the primary value and the top others, with Total within the palette. */
const LINE_LIMIT = SLOTS - 1;
/** Fewest stored days in the window before a counter gets a per-user figure. */
const PER_USER_MIN_DAYS = 14;

/** Whether `date` is one of the `count` UTC days ending on `latest`. */
function within(date: string, latest: string, count: number): boolean {
  const ago = dayNumber(latest) - dayNumber(date);
  return ago >= 0 && ago < count;
}

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

/** A locale's English name with its code, `Turkish (tr)`; the code alone when Intl names no such language. */
function localeLabel(code: string): string {
  try {
    const name = languageNames.of(code);
    return name === code ? code : `${name} (${code})`;
  } catch {
    // Intl refuses what isn't a language tag
    return code;
  }
}

/**
 * A raw value's display label: its `values` label, else `Other` for the folded value, else a locale's name,
 * else the value itself.
 */
export function cloudflareValueLabel(dimension: CloudflareDimensionInfo | undefined, value: string): string {
  if (dimension?.values && Object.hasOwn(dimension.values, value)) return dimension.values[value]!;
  if (value === OTHER) return 'Other';
  return dimension?.locale ? localeLabel(value) : value;
}

/**
 * A day's users and events per value of a dimension, the empty value left out. Locales group by primary
 * subtag: one install has one OS locale a day, so the daily uniques of its tags add up.
 */
function valueCounts(day: CloudflareDay, name: string, locale?: boolean): Map<string, CloudflareCount> {
  const counts = new Map<string, CloudflareCount>();
  for (const [raw, count] of Object.entries(day.by[name] ?? {})) {
    const value = locale ? primarySubtag(raw) : raw;
    if (value === '') continue;
    const sum = counts.get(value) ?? { users: 0, events: 0 };
    sum.users += count.users;
    sum.events += count.events;
    counts.set(value, sum);
  }
  return counts;
}

/** The day's headline users: the primary value's when one is set, else every row's. */
function headlineOf(day: CloudflareDay, primary: CloudflareRule['primary'], locale?: boolean): number {
  return primary ? (valueCounts(day, primary.dimension, locale).get(primary.value)?.users ?? 0) : day.users;
}

/** Semver values newest first, then the values that aren't versions; other dimensions by events. */
function shareOrder(semver: boolean): (a: CloudflareShare, b: CloudflareShare) => number {
  return (a, b) => {
    const va = semver ? parseVersion(a.value) : null;
    const vb = semver ? parseVersion(b.value) : null;
    if (va && vb) return compareVersions(vb, va);
    if (va || vb) return va ? -1 : 1;
    return b.events - a.events;
  };
}

/**
 * Each dimension's values summed over the last 30 days, in share order. The ones past `SHARE_LIMIT`
 * fold into `other`.
 */
function buildShares(
  days: readonly CloudflareDay[],
  latest: string,
  dimensions: readonly CloudflareDimensionInfo[],
): Record<string, CloudflareShare[]> {
  const recent = days.filter((d) => within(d.date, latest, LAST_DAYS));
  return Object.fromEntries(
    dimensions.map((dimension) => {
      const totals = new Map<string, CloudflareShare>();
      for (const day of recent) {
        for (const [value, count] of valueCounts(day, dimension.name, dimension.locale)) {
          const share = totals.get(value) ?? { value, users: 0, events: 0 };
          share.users += count.users;
          share.events += count.events;
          totals.set(value, share);
        }
      }
      const supported = dimension.supported;
      const shares = [...totals.values()]
        .map((share) => (supported ? { ...share, supported: supported.includes(share.value) } : share))
        .sort(shareOrder(dimension.kind === 'semver'));
      const top = shares.slice(0, SHARE_LIMIT);
      const rest = shares.slice(SHARE_LIMIT);
      if (rest.length > 0) {
        top.push({
          value: OTHER,
          users: rest.reduce((sum, s) => sum + s.users, 0),
          events: rest.reduce((sum, s) => sum + s.events, 0),
        });
      }
      return [dimension.name, top];
    }),
  );
}

/** The dataset's Cloudflare figures from the stored days; undefined when none has a day. */
export function buildCloudflareData(rule: CloudflareRule, series: CloudflareSeries): CloudflareData | undefined {
  if (series.days.length === 0) return undefined;
  const primary = rule.primary;
  const primaryLocale = rule.dimensions.find((d) => d.name === primary?.dimension)?.locale;
  const days = series.days.map((day) => ({ ...day, headline: headlineOf(day, primary, primaryLocale) }));
  const last = days.at(-1)!;
  const latest = last.date;
  const recent7 = days.filter((d) => within(d.date, latest, 7));
  const recent30 = days.filter((d) => within(d.date, latest, LAST_DAYS));
  return {
    label: rule.label,
    ...(rule.note ? { note: rule.note } : {}),
    ...(primary ? { primary } : {}),
    latest,
    first: days[0]!.date,
    dimensions: rule.dimensions.map(({ name, label, kind, values, locale, supported, chart }) => ({
      name,
      label,
      ...(kind ? { kind } : {}),
      ...(values ? { values } : {}),
      ...(locale ? { locale } : {}),
      ...(supported ? { supported } : {}),
      ...(chart ? { chart } : {}),
    })),
    days,
    totals: {
      usersLatest: last.headline,
      usersAvg7: Math.round(recent7.reduce((sum, d) => sum + d.headline, 0) / recent7.length),
      usersAvg30: Math.round(recent30.reduce((sum, d) => sum + d.headline, 0) / recent30.length),
      eventsLast30: recent30.reduce((sum, d) => sum + d.events, 0),
      otherEvents7: primary
        ? recent7.reduce((sum, d) => sum + d.events - (valueCounts(d, primary.dimension, primaryLocale).get(primary.value)?.events ?? 0), 0)
        : 0,
    },
    shares: buildShares(series.days, latest, rule.dimensions),
  };
}

/**
 * The usage chart's lines over the stored days: Total first, then with `primary` set, one line per value of its
 * dimension seen in the days, the primary value first and the rest by users, up to `LINE_LIMIT`. A day without
 * a value counts 0.
 */
export function cloudflareUserSeries(cf: CloudflareData): CloudflareUserSeries[] {
  const total: CloudflareUserSeries = {
    key: 'total',
    label: 'Total',
    values: cf.days.map((day) => ({ date: day.date, users: day.users })),
  };
  const primary = cf.primary;
  if (!primary) return [total];
  const dimension = cf.dimensions.find((d) => d.name === primary.dimension);
  const perDay = cf.days.map((day) => valueCounts(day, primary.dimension, dimension?.locale));
  const sums = new Map<string, number>();
  for (const counts of perDay) {
    for (const [value, count] of counts) sums.set(value, (sums.get(value) ?? 0) + count.users);
  }
  const lines = [...sums.entries()]
    .sort(([a, usersA], [b, usersB]) => {
      if (a === primary.value || b === primary.value) return a === primary.value ? -1 : 1;
      return usersB - usersA;
    })
    .slice(0, LINE_LIMIT)
    .map(([value]) => ({
      key: value,
      label: cloudflareValueLabel(dimension, value),
      values: cf.days.map((day, i) => ({ date: day.date, users: perDay[i]!.get(value)?.users ?? 0 })),
    }));
  return [total, ...lines];
}

/**
 * A dimension's daily users as lines to stack: one per value, the top `LINE_LIMIT` by users over the last 30
 * days; the rest, and any value with no users in those 30 days, fold into `other`. So each day's lines add up to
 * the users the dimension counts, which leaves out the empty value and the rows its `where` drops.
 */
export function cloudflareDimensionSeries(cf: CloudflareData, name: string): CloudflareUserSeries[] {
  const dimension = cf.dimensions.find((d) => d.name === name);
  if (!dimension) return [];
  const perDay = cf.days.map((day) => valueCounts(day, name, dimension.locale));
  const ranked = new Map<string, number>();
  cf.days.forEach((day, i) => {
    for (const [value, count] of perDay[i]!) {
      const users = within(day.date, cf.latest, LAST_DAYS) ? count.users : 0;
      ranked.set(value, (ranked.get(value) ?? 0) + users);
    }
  });
  const values = [...ranked.keys()].sort((a, b) => ranked.get(b)! - ranked.get(a)!);
  const shown = values.filter((value) => ranked.get(value)! > 0).slice(0, LINE_LIMIT);
  const lines: CloudflareUserSeries[] = shown.map((value) => ({
    key: value,
    label: cloudflareValueLabel(dimension, value),
    values: cf.days.map((day, i) => ({ date: day.date, users: perDay[i]!.get(value)?.users ?? 0 })),
  }));
  const rest = values.filter((value) => !shown.includes(value));
  if (rest.length > 0) {
    lines.push({
      key: OTHER,
      label: 'Other',
      values: cf.days.map((day, i) => ({
        date: day.date,
        users: rest.reduce((sum, value) => sum + (perDay[i]!.get(value)?.users ?? 0), 0),
      })),
    });
  }
  return lines;
}

/**
 * A counter's increase per daily user over the 30 days ending on the latest Cloudflare day. Undefined unless
 * the window has enough Cloudflare days and a snapshot at or before its start to measure the increase from.
 */
export function counterPerUser(
  measured: readonly MeasuredDay[],
  counter: string,
  cf: CloudflareData,
): number | undefined {
  const start = addDays(cf.latest, 1 - LAST_DAYS);
  const days = cf.days.filter((d) => within(d.date, cf.latest, LAST_DAYS));
  const gains = measured.filter((m) => within(m.date, cf.latest, LAST_DAYS));
  const first = gains[0];
  if (days.length < PER_USER_MIN_DAYS || !first || addDays(first.date, -first.days) > start) return undefined;
  const users = days.reduce((sum, d) => sum + d.headline, 0) / days.length;
  if (users === 0) return undefined;
  // A first gain that starts before the window counts only its part inside it.
  const share = Math.min(1, (dayNumber(first.date) - dayNumber(start) + 1) / first.days);
  const increase = gains.reduce((sum, m) => sum + (m.counters[counter] ?? 0) * (m === first ? share : 1), 0);
  return Math.round((increase / users) * 100) / 100;
}
