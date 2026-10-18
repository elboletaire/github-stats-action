import { describe, expect, it } from 'vitest';
import { escapeXml, formatCompact, slug, textWidth } from '../src/format';

describe('formatCompact', () => {
  it('keeps small counts whole', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(999)).toBe('999');
  });

  it('uses one decimal below 100 of a unit, and drops a trailing .0', () => {
    expect(formatCompact(1000)).toBe('1k');
    expect(formatCompact(1200)).toBe('1.2k');
    expect(formatCompact(12200)).toBe('12.2k');
    expect(formatCompact(99_940)).toBe('99.9k');
    expect(formatCompact(1_200_000)).toBe('1.2M');
  });

  it('uses whole numbers from 100 of a unit up', () => {
    expect(formatCompact(123_000)).toBe('123k');
    expect(formatCompact(999_400)).toBe('999k');
  });

  it('moves to the next unit when rounding reaches 1000', () => {
    expect(formatCompact(999_600)).toBe('1M');
    expect(formatCompact(999_999_999)).toBe('1B');
  });

  it('rejects values that are not counts', () => {
    expect(() => formatCompact(-1)).toThrow(RangeError);
    expect(() => formatCompact(Number.NaN)).toThrow(RangeError);
  });
});

describe('slug', () => {
  it('lowercases and joins words with dashes', () => {
    expect(slug('In-app updates')).toBe('in-app-updates');
    expect(slug('  CLI  ')).toBe('cli');
    expect(slug('Desktop app (beta)')).toBe('desktop-app-beta');
  });
});

describe('escapeXml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
  });
});

describe('textWidth', () => {
  // Shields.io's own flat SVG measures "downloads" at 59px and "12.2k" at 31px at 11px Verdana.
  it('stays within a pixel of shields.io for common badge text', () => {
    expect(textWidth('downloads')).toBeGreaterThan(57.5);
    expect(textWidth('downloads')).toBeLessThan(60.5);
    expect(textWidth('12.2k')).toBeGreaterThan(30);
    expect(textWidth('12.2k')).toBeLessThan(32);
  });

  it('grows with the text and is zero for nothing', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('WWWW')).toBeGreaterThan(textWidth('iiii'));
  });
});
