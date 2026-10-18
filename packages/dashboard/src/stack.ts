// Stacked bar segments: values are stacked bottom-up, with a surface gap between neighbours.

export interface Segment {
  /** Index into the values the segment came from. */
  index: number;
  /** Pixel top and height. */
  y: number;
  height: number;
  /** The topmost segment, which gets the rounded data end. */
  top: boolean;
}

/** Stacks positive values bottom-up (`scale` maps a value to a row); each segment but the top starts `gap` px lower. */
export function stackSegments(values: readonly number[], scale: (value: number) => number, gap = 2): Segment[] {
  const positive = values.map((v) => Math.max(0, v));
  let topIndex = -1;
  positive.forEach((v, i) => {
    if (v > 0) topIndex = i;
  });
  const out: Segment[] = [];
  let base = 0;
  positive.forEach((v, index) => {
    if (v <= 0) return;
    const bottom = scale(base);
    const topEdge = scale(base + v);
    const top = index === topIndex;
    const y = top ? topEdge : Math.min(topEdge + gap, bottom - 1);
    out.push({ index, y, height: bottom - y, top });
    base += v;
  });
  return out;
}
