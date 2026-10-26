// Categorical slots: groups take a fixed slot by their config position, never a cycled hue.
// The hues are the shared theme's (core/theme.ts), written into style.css as --c0..--c7 at build time.

import type { GroupInfo, Theme } from '@github-stats-action/core';
import { SLOTS } from '@github-stats-action/core/theme';

/** The CSS colour of a group. A ninth group shares the last slot rather than cycling the hues. */
export function colorVar(group: Pick<GroupInfo, 'color'>): string {
  return `var(--c${Math.min(Math.max(0, group.color), SLOTS - 1)})`;
}

/** The theme the page shows, as style.css picks its tokens: a `data-theme` stamp when there is one, else the OS setting. */
export function pageTheme(): Theme {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
