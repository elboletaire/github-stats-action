// SVG charts for one repo: each chart in a light and a dark file, for a <picture> in READMEs.

import type { Dataset, OutputFile } from '@github-stats-action/core';
import { downloadsPerDayChart } from './downloads';
import { downloadsPerReleaseChart } from './releases';
import { starsChart } from './stars';
import type { Theme } from './svg';

const CHARTS = [
  ['stars', starsChart],
  ['downloads-per-day', downloadsPerDayChart],
  ['downloads-per-release', downloadsPerReleaseChart],
] as const;

/** Paths are relative to `<owner>/<repo>/`: `charts/<name>-light.svg` and `-dark.svg`. */
export function renderCharts(dataset: Dataset): OutputFile[] {
  const themes: Theme[] = ['light', 'dark'];
  return CHARTS.flatMap(([name, chart]) =>
    themes.map((theme) => ({ path: `charts/${name}-${theme}.svg`, content: chart(dataset, theme) })),
  );
}
