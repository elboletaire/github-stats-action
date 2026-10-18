// Standalone flat SVG badge, laid out like shields.io's `flat` style.

import { escapeXml, FONT_SIZE, textWidth } from './format';

/** The shields.io colour names that can appear in a badge's `color`, as hex. */
const NAMED_COLORS: Record<string, string> = {
  brightgreen: '4c1',
  green: '97ca00',
  yellowgreen: 'a4a61d',
  yellow: 'dfb317',
  orange: 'fe7d37',
  red: 'e05d44',
  blue: '007ec6',
  grey: '555',
  gray: '555',
  lightgrey: '9f9f9f',
  success: '4c1',
  important: 'fe7d37',
  critical: 'e05d44',
  informational: '007ec6',
  inactive: '9f9f9f',
};

const HEIGHT = 20;
/** Padding on each side of a part's text, px. */
const PAD = 5;
const LABEL_FILL = '#555';

/** A shields.io colour name or a hex code without '#', as a `#` colour. */
function svgColor(color: string): string {
  const hex = NAMED_COLORS[color] ?? color;
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new Error(`not a badge colour: ${color}`);
  return `#${hex}`;
}

export function flatSvg(badge: { label: string; message: string; color: string }): string {
  const aria = escapeXml(`${badge.label}: ${badge.message}`);
  const labelText = Math.round(textWidth(badge.label) * 10) / 10;
  const messageText = Math.round(textWidth(badge.message) * 10) / 10;
  const labelBox = Math.round(labelText + 2 * PAD);
  const messageBox = Math.round(messageText + 2 * PAD);
  const width = labelBox + messageBox;
  const parts = [
    { x: labelBox / 2, value: escapeXml(badge.label), length: labelText },
    { x: labelBox + messageBox / 2, value: escapeXml(badge.message), length: messageText },
  ];
  // The shadow is the same text one px lower and dimmed, as shields.io draws it.
  const shadow = parts.map(
    (p) =>
      `<text aria-hidden="true" x="${p.x}" y="15" fill="#010101" fill-opacity=".3" textLength="${p.length}">` +
      `${p.value}</text>`,
  );
  const foreground = parts.map((p) => `<text x="${p.x}" y="14" textLength="${p.length}">${p.value}</text>`);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" role="img" aria-label="${aria}">`,
    `<title>${aria}</title>`,
    '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/>' +
      '<stop offset="1" stop-opacity=".1"/></linearGradient>',
    `<clipPath id="r"><rect width="${width}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>`,
    '<g clip-path="url(#r)">' +
      `<rect width="${labelBox}" height="${HEIGHT}" fill="${LABEL_FILL}"/>` +
      `<rect x="${labelBox}" width="${messageBox}" height="${HEIGHT}" fill="${svgColor(badge.color)}"/>` +
      `<rect width="${width}" height="${HEIGHT}" fill="url(#s)"/>` +
      '</g>',
    '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif"' +
      ` text-rendering="geometricPrecision" font-size="${FONT_SIZE}">`,
    ...shadow,
    ...foreground,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
