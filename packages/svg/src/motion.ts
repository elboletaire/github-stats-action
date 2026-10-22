// Motion for the README charts: CSS keyframes in each chart's own <style>, so an SVG in an <img> still
// plays with no script. A chart plays once on load, about a second in all, and ends on the static chart:
// the base styles are the end state and the animations only fill backwards, so a renderer without CSS
// animation shows the whole chart. Reduced motion turns every animation off.

/** A column grows up from the baseline, a band is wiped in from the left, a line is drawn, an element fades in. */
export type Effect = 'rise' | 'wipe' | 'draw' | 'fade';

const RULES: Record<Effect, string> = {
  rise: '.gs-rise{animation:gs-rise .6s ease-out both;transform-box:fill-box;transform-origin:bottom}@keyframes gs-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
  wipe: '.gs-wipe{animation:gs-wipe .6s ease-out both}@keyframes gs-wipe{from{clip-path:inset(-9px 100% -9px 0)}to{clip-path:inset(-9px -9px -9px -9px)}}',
  draw: '.gs-draw{stroke-dasharray:1;animation:gs-draw .8s ease-out both}@keyframes gs-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
  fade: '.gs-fade{animation:gs-fade .3s ease-out both}@keyframes gs-fade{from{opacity:0}to{opacity:1}}',
};

/** The `<style>` for the effects a chart uses: their classes and keyframes, and no motion under reduced motion. */
export function motionCss(effects: Effect[]): string {
  return [...new Set(effects)].map((effect) => RULES[effect]).join('') + '@media (prefers-reduced-motion: reduce){*{animation:none!important}}';
}

/** A run of items starts one after another over 250 ms, so the run takes the same time whatever its count: the last one ends by 0.85 s. */
export const staggerDelay = (i: number, count: number): string => `animation-delay:${Math.round((i * 250) / Math.max(1, count))}ms`;

/** `children` in a group that carries the effect's class and an optional inline delay; unchanged when the chart stays still. */
export function animated(on: boolean, effect: Effect, children: string[], delay = ''): string[] {
  if (!on) return children;
  return [`<g class="gs-${effect}"${delay ? ` style="${delay}"` : ''}>${children.join('')}</g>`];
}
