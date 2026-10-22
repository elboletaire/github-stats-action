import { describe, expect, it } from 'vitest';
import { finishLoad, introDelay, playsIntro } from '../src/intro';

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
});
