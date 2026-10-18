// Text helpers shared by the badge renderers: compact numbers, slugs, XML escaping and an
// estimated text width, so the SVGs lay out right without the font being loaded.

const SUFFIXES = ['', 'k', 'M', 'B'];

/** Font size of the badge text, in px. */
export const FONT_SIZE = 11;

/** Verdana advance widths in 1/1000 em for printable ASCII (space to ~). */
const EM_WIDTHS: Record<string, number> = {
  ' ': 352, '!': 455, '"': 548, '#': 838, $: 636, '%': 950, '&': 684, "'": 230,
  '(': 456, ')': 456, '*': 518, '+': 838, ',': 364, '-': 363, '.': 364, '/': 454,
  '0': 636, '1': 636, '2': 636, '3': 636, '4': 636, '5': 636, '6': 636, '7': 636, '8': 636, '9': 636,
  ':': 455, ';': 455, '<': 838, '=': 838, '>': 838, '?': 575, '@': 1000,
  A: 684, B: 686, C: 698, D: 770, E: 632, F: 575, G: 775, H: 752, I: 297, J: 556,
  K: 655, L: 556, M: 863, N: 748, O: 787, P: 603, Q: 787, R: 695, S: 635, T: 611,
  U: 732, V: 684, W: 989, X: 685, Y: 611, Z: 685, '[': 455, '\\': 454, ']': 455, '^': 838,
  _: 500, '`': 606,
  a: 602, b: 623, c: 552, d: 623, e: 596, f: 352, g: 623, h: 634, i: 274, j: 274,
  k: 579, l: 274, m: 974, n: 634, o: 608, p: 623, q: 623, r: 411, s: 521, t: 392,
  u: 634, v: 592, w: 818, x: 591, y: 592, z: 525, '{': 455, '|': 455, '}': 455, '~': 838,
};

/** Width of characters outside the table (non-ASCII letters, mostly). */
const DEFAULT_EM = 600;

/**
 * Compact count: `999`, `1.2k`, `12.2k`, `123k`, `1.2M`. One decimal below 100 of a unit,
 * whole numbers above. Expects a finite, non-negative number.
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`not a count: ${value}`);
  let scaled = Math.round(value);
  let unit = 0;
  while (scaled >= 1000 && unit < SUFFIXES.length - 1) {
    scaled /= 1000;
    unit++;
  }
  const text = scaled < 100 ? String(Math.round(scaled * 10) / 10) : String(Math.round(scaled));
  // 999.6k rounds to 1000k: show it as the next unit instead.
  if (Number(text) >= 1000 && unit < SUFFIXES.length - 1) return `1${SUFFIXES[unit + 1]}`;
  return `${text}${SUFFIXES[unit]}`;
}

/** Estimated rendered width of `text` at `FONT_SIZE`, in px. */
export function textWidth(text: string): number {
  let em = 0;
  for (const char of text) em += EM_WIDTHS[char] ?? DEFAULT_EM;
  return (em * FONT_SIZE) / 1000;
}

/** Lowercase, dash-separated, for file names: `In-app updates` becomes `in-app-updates`. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Escapes text for XML element content and double-quoted attributes. */
export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
