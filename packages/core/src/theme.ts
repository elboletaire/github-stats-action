// The visual language the README charts and the dashboard share: one palette, one type scale and one
// set of mark sizes. Browser code imports this file alone (`@github-stats-action/core/theme`), so it
// must stay free of Node imports.

export type Theme = 'light' | 'dark';

/** Chart chrome per mode: surfaces, text tokens, gridlines and the two status inks. */
export interface Ink {
  /** The chart card. */
  surface: string;
  /** The page behind the cards. */
  page: string;
  primary: string;
  secondary: string;
  /** Axis ticks and small labels. */
  muted: string;
  /** Hairline gridlines. */
  grid: string;
  /** The baseline and markers. */
  axis: string;
  /** The hairline ring around a card. */
  border: string;
  good: string;
  warn: string;
}

export const INK: Record<Theme, Ink> = {
  light: {
    surface: '#fcfcfb',
    page: '#f6f7f8',
    primary: '#0b0b0b',
    secondary: '#52514e',
    muted: '#6f6e69',
    grid: '#e8eaeb',
    axis: '#dcdedf',
    border: '#dcdedf',
    good: '#1f7a4d',
    warn: '#9a6700',
  },
  dark: {
    surface: '#1a1a19',
    page: '#121314',
    primary: '#f0efec',
    secondary: '#c3c2b7',
    muted: '#a09f98',
    grid: '#2a2b2e',
    axis: '#33343a',
    border: '#33343a',
    good: '#5fc08a',
    warn: '#d9a441',
  },
};

// The categorical slots, in a fixed order that passes the dataviz validator in both modes (adjacent
// pairs: CVD ΔE 9.9 light / 8.9 dark, normal vision 18.3 / 18.9, all >= 3:1 on their surface).
export const SERIES: Record<Theme, readonly string[]> = {
  light: ['#2a6ddc', '#e5642e', '#0d9683', '#b07c00', '#c4497e', '#1f861f', '#6b58e0', '#dc3f3f'],
  dark: ['#4189ea', '#dd5f2f', '#1c9f74', '#c4860f', '#d45287', '#2b962b', '#9085e9', '#e66767'],
};

export const SLOTS = 8;

/** A series' colour by its slot; past the last slot there is no hue left, so it takes the last one. */
export function seriesColor(theme: Theme, slot: number): string {
  return SERIES[theme][Math.min(Math.max(0, slot), SLOTS - 1)] ?? INK[theme].muted;
}

/** Font sizes in px, a 1.25 scale from 11 up. */
export const TYPE = { xs: 11, sm: 12, md: 13, base: 14, lg: 16, xl: 19, xxl: 24, hero: 30 } as const;

export const FONT = {
  sans: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
} as const;

/** Mark sizes every chart draws with. */
export const MARK = {
  /** A bar never fills its slot past this width. */
  barMax: 24,
  /** The rounded data end of a bar. */
  barRadius: 4,
  /** Surface gap between stacked segments. */
  gap: 2,
  line: 2,
  /** End and hover dots, with a 2px ring in the surface colour. */
  dot: 4,
  /** An area fades from this opacity at its line to nothing at the baseline. */
  areaTop: 0.22,
  areaBottom: 0.02,
  /** Stacked bands take a flat wash each instead of a fade. */
  areaStack: 0.18,
  /** Card corner radius. */
  radius: 12,
} as const;

const vars = (theme: Theme): string => {
  const ink = INK[theme];
  const entries: [string, string][] = [
    ['bg', ink.page],
    ['surface', ink.surface],
    ['ink', ink.primary],
    ['ink2', ink.secondary],
    ['muted', ink.muted],
    ['grid', ink.grid],
    ['line', ink.axis],
    ['border', ink.border],
    ['good', ink.good],
    ['warn', ink.warn],
    ...SERIES[theme].map((hex, i): [string, string] => [`c${i}`, hex]),
  ];
  return `${entries.map(([name, value]) => `--${name}:${value};`).join('')}color-scheme:${theme};`;
};

// CSS custom properties for both modes: light by default, dark by the OS setting unless the page
// stamps data-theme="light", and dark whenever it stamps data-theme="dark".
export function themeCss(): string {
  return [
    `:root{${vars('light')}--sans:${FONT.sans};--mono:${FONT.mono};}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars('dark')}}}`,
    `:root[data-theme="dark"]{${vars('dark')}}`,
  ].join('\n');
}
