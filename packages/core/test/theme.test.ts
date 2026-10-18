import { describe, expect, it } from 'vitest';
import { INK, SERIES, SLOTS, seriesColor, themeCss } from '../src/theme';

const HEX = /^#[0-9a-f]{6}$/;

describe('theme tokens', () => {
  it('has eight series slots per mode, all plain hex', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(SERIES[theme]).toHaveLength(SLOTS);
      for (const hex of SERIES[theme]) expect(hex).toMatch(HEX);
    }
  });

  it('keeps a slot past the last one on the last hue instead of cycling', () => {
    expect(seriesColor('light', 0)).toBe(SERIES.light[0]);
    expect(seriesColor('dark', 7)).toBe(SERIES.dark[7]);
    expect(seriesColor('light', 99)).toBe(SERIES.light[7]);
    expect(seriesColor('light', -1)).toBe(SERIES.light[0]);
  });

  it('writes every token for both modes as CSS custom properties', () => {
    const css = themeCss();
    expect(css).toContain(`:root{--bg:${INK.light.page};`);
    expect(css).toContain(`--c0:${SERIES.light[0]}`);
    expect(css).toContain(`--c7:${SERIES.dark[7]}`);
    expect(css).toContain('@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){');
    expect(css).toContain(`:root[data-theme="dark"]{--bg:${INK.dark.page};`);
    expect(css.match(/color-scheme:dark/g)).toHaveLength(2);
    expect(css).not.toMatch(/undefined|NaN/);
  });
});
