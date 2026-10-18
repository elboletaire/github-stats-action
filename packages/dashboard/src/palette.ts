// Categorical slots: groups take a fixed slot by their config position, never a cycled hue.
// The hues are the shared theme's (core/theme.ts), written into style.css as --c0..--c7 at build time.

import type { GroupInfo } from '@github-stats-action/core';
import { SLOTS } from '@github-stats-action/core/theme';

/** The CSS colour of a group. A ninth group shares the last slot rather than cycling the hues. */
export function colorVar(group: Pick<GroupInfo, 'color'>): string {
  return `var(--c${Math.min(Math.max(0, group.color), SLOTS - 1)})`;
}
