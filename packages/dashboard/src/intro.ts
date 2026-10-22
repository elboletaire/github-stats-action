// The charts' intro: each chart animates once, on the first mount. Every redraw rebuilds its SVG, so a later
// draw (resize, zoom, repo switch) must not carry the intro classes or the CSS animations would replay.

let loading = true;

/** Whether a chart drawn now plays its intro: its `animate` config, and only while the first mount is drawing. */
export function playsIntro(animate: boolean): boolean {
  return animate && loading;
}

/** Ends the first mount; charts drawn from now on appear at once. */
export function finishLoad(): void {
  loading = false;
}

/** How long a line takes to draw, in ms: its dots land as it reaches them, the end label once it is done (as in style.css). */
export const DRAW_MS = 1600;

/** An inline animation delay for one element of the intro, in milliseconds. */
export function introDelay(ms: number): { style: string } {
  return { style: `animation-delay:${Math.round(ms)}ms` };
}

/** When item `i` of a run of `count` starts: the run starts one after another over 500 ms, as in the README SVGs (motion.ts). */
export function introStagger(i: number, count: number): number {
  return (500 * i) / Math.max(1, count);
}
