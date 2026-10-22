import { describe, expect, it } from 'vitest';
import { finishLoad, introDelay, introStagger, playsIntro } from '../src/intro';

describe('intro', () => {
  it('plays only on the first mount, and only where the config animates', () => {
    expect(playsIntro(false)).toBe(false);
    expect(playsIntro(true)).toBe(true);
    finishLoad();
    expect(playsIntro(true)).toBe(false);
  });

  it('delays an element in whole milliseconds', () => {
    expect(introDelay(149.6)).toEqual({ style: 'animation-delay:150ms' });
  });

  it('starts a run over 250 ms, whatever its count', () => {
    expect(introStagger(0, 4)).toBe(0);
    expect(introStagger(2, 4)).toBe(125);
    expect(introStagger(9, 10)).toBe(225);
    expect(introStagger(0, 0)).toBe(0);
  });
});
