// Categorical slots: groups take a fixed slot by their config position, never a cycled hue.
// The eight hues and their light and dark steps are the validated default palette (--c0..--c7 in style.css).

import type { GroupInfo } from '@github-stats-action/core';

export const SLOTS = 8;

/** The CSS colour of a group. A ninth group shares the last slot rather than cycling the hues. */
export function colorVar(group: Pick<GroupInfo, 'color'>): string {
  return `var(--c${Math.min(Math.max(0, group.color), SLOTS - 1)})`;
}
