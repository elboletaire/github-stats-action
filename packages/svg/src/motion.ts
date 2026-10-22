// Motion for the README charts: CSS keyframes in each chart's <style>, so an <img> plays them with no script.
// A chart plays once, about two seconds in all. Base styles are the end state and animations fill backwards only,
// so a renderer without CSS animation shows the full chart. Reduced motion turns every animation off.

/** A column grows up from the baseline, a band is wiped in from the left, a line is drawn, an element fades in or pops in. */
export type Effect = 'rise' | 'wipe' | 'draw' | 'fade' | 'pop';

const RULES: Record<Effect, string> = {
  rise: '.gs-rise{animation:gs-rise 1.1s ease-out backwards;transform-box:fill-box;transform-origin:bottom}@keyframes gs-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
  wipe: '.gs-wipe{animation:gs-wipe 1.2s ease-out backwards}@keyframes gs-wipe{from{clip-path:inset(-9px 100% -9px 0)}to{clip-path:inset(-9px -9px -9px -9px)}}',
  draw: '.gs-draw{animation:gs-draw 1.6s linear backwards}@keyframes gs-draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}',
  fade: '.gs-fade{animation:gs-fade .5s ease-out backwards}@keyframes gs-fade{from{opacity:0}to{opacity:1}}',
  pop: '.gs-pop{animation:gs-pop .25s ease-out backwards;transform-box:fill-box;transform-origin:center}@keyframes gs-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}',
};

/** The `<style>` for the effects a chart uses: their classes and keyframes, and no motion under reduced motion. */
export function motionCss(effects: Effect[]): string {
  const classes = [...new Set(effects)];
  // only the chart's own classes, so an inlined SVG keeps the page's other animations
  const still = classes.map((effect) => `.gs-${effect}`).join(',');
  return classes.map((effect) => RULES[effect]).join('') + `@media (prefers-reduced-motion: reduce){${still}{animation:none!important}}`;
}

/** How long a line takes to draw, in ms: its dots land as it reaches them, the end label once it is done. */
export const DRAW_MS = 1600;

/** When items that land after a chart's main motion start, in ms: once the line is drawn or the last column has risen. */
export const LATE_MS = 1600;

/** Up to this many items of a run each rise on their own, staggered; past it the stagger is under 10 ms each, so the run rises as one group. */
export const STAGGER_MAX = 60;

/** A run of items starts one after another over 500 ms, so the run takes the same time whatever its count: the last one starts by 0.5 s. */
export const staggerDelay = (i: number, count: number): string => {
  const ms = Math.round((i * 500) / Math.max(1, count));
  return ms ? `animation-delay:${ms}ms` : '';
};

/** `children` in a group that carries the effect's class and an optional inline delay; unchanged when the chart stays still or there is nothing to animate. */
export function animated(on: boolean, effect: Effect, children: string[], delay = ''): string[] {
  if (!on || !children.length) return children;
  return [`<g class="gs-${effect}"${delay ? ` style="${delay}"` : ''}>${children.join('')}</g>`];
}
