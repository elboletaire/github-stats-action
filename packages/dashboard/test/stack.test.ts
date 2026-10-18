import { describe, expect, it } from 'vitest';
import { stackSegments } from '../src/stack';

describe('stackSegments', () => {
  const scale = (v: number): number => 100 - v;

  it('stacks bottom-up with a 2px gap above every segment but the top', () => {
    const segments = stackSegments([10, 0, 5], scale);
    expect(segments).toEqual([
      { index: 0, y: 92, height: 8, top: false },
      { index: 2, y: 85, height: 5, top: true },
    ]);
  });

  it('clamps negative values to the baseline', () => {
    const segments = stackSegments([-4, 6], scale);
    expect(segments).toEqual([{ index: 1, y: 94, height: 6, top: true }]);
  });

  it('keeps every segment at least one pixel tall', () => {
    const segments = stackSegments([1, 1], scale);
    expect(segments.every((s) => s.height >= 1)).toBe(true);
    expect(stackSegments([0, 0], scale)).toEqual([]);
  });
});
