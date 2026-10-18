// Axis maths: round tops and tick positions.

/** The smallest 1-2-5 style step at or above `value` (at least 1), so axes end on round numbers. */
export function niceMax(value: number): number {
  const top = Math.max(1, value);
  const power = 10 ** Math.floor(Math.log10(top));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (step * power >= top) return step * power;
  return 10 * power;
}

/** A top whose quarters are whole numbers, so the four gridlines land on round values. */
export function quarterMax(value: number): number {
  return niceMax(Math.ceil(Math.max(4, value) / 4)) * 4;
}

/** Evenly spaced tick values from 0 to `max`, `count` intervals. */
export function ticks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => step * i);
}
