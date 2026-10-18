import { describe, expect, it } from 'vitest';
import { esc, f0, f1, isoDay, percent, plural, sgn } from '../src/format';

describe('format', () => {
  it('groups thousands and never prints -0', () => {
    expect(f0(12201.4)).toBe('12,201');
    expect(f0(-0.4)).toBe('0');
  });

  it('shows a dash for a missing decimal or change', () => {
    expect(f1(null)).toBe('—');
    expect(f1(7.25)).toBe('7.3');
    expect(sgn(null)).toBe('—');
    expect(sgn(0)).toBe('0');
    expect(sgn(-3)).toBe('-3');
    expect(sgn(12)).toBe('+12');
  });

  it('pluralises and shares', () => {
    expect(plural(1, 'file')).toBe('1 file');
    expect(plural(3, 'file')).toBe('3 files');
    expect(percent(1, 4)).toBe('25%');
    expect(percent(1, 0)).toBe('0%');
  });

  it('escapes markup and keeps the day of a timestamp', () => {
    expect(esc('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    expect(isoDay('2026-10-18T13:00:00Z')).toBe('2026-10-18');
  });
});
