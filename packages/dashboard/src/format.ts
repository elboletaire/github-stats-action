// Number and text formatting shared by every section.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Whole number with thousands separators; never "-0". */
export const f0 = (n: number): string => (Math.round(n) || 0).toLocaleString('en-US');

/** One decimal, or a dash when there is no value. */
export const f1 = (n: number | null | undefined): string =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A signed change (`+12`, `-3`, `0`), or a dash when there is none. */
export const sgn = (n: number | null | undefined): string => (n == null ? '—' : (n > 0 ? '+' : '') + f0(n));

/** `1 release`, `3 files`. */
export const plural = (n: number, word: string): string => `${f0(n)} ${word}${n === 1 ? '' : 's'}`;

/** Share of `part` in `whole`, as `12%`. */
export const percent = (part: number, whole: number): string => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;

export const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** The `YYYY-MM-DD` part of an ISO timestamp. */
export const isoDay = (iso: string): string => iso.slice(0, 10);
