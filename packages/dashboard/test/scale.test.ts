import { describe, expect, it } from 'vitest';
import { niceMax, quarterMax, ticks } from '../src/scale';

describe('scale', () => {
  it('rounds up to a 1-2-5 step', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7.2)).toBe(8);
    expect(niceMax(373)).toBe(400);
    expect(niceMax(12201)).toBe(15000);
  });

  it('makes quarters whole numbers', () => {
    expect(quarterMax(0)).toBe(4);
    expect(quarterMax(73)).toBe(80);
    expect(quarterMax(1)).toBe(4);
  });

  it('gives evenly spaced ticks from zero', () => {
    expect(ticks(8, 4)).toEqual([0, 2, 4, 6, 8]);
  });
});
