// SVG charts for one repo: each chart in a light and a dark file, for a <picture> in READMEs.

import type { Dataset, OutputFile } from '@github-stats-action/core';
import { downloadsPerDayChart } from './downloads';
import { npmDownloadsChart } from './npm';
import { downloadsPerReleaseChart } from './releases';
import { starsChart } from './stars';
import type { Theme } from './svg';

type Chart = (dataset: Dataset, theme: Theme) => string;

/** Paths are relative to `<owner>/<repo>/`: `charts/<name>-light.svg` and `-dark.svg`. The download charts need release downloads, the npm one npm. */
export function renderCharts(dataset: Dataset): OutputFile[] {
  const charts: [string, Chart][] = [
    ['stars', starsChart],
    ...(dataset.releaseDownloads
      ? [
          ['downloads-per-day', downloadsPerDayChart] as [string, Chart],
          ['downloads-per-release', downloadsPerReleaseChart] as [string, Chart],
        ]
      : []),
    ...(dataset.npm ? [['npm-downloads', npmDownloadsChart] as [string, Chart]] : []),
  ];
  const themes: Theme[] = ['light', 'dark'];
  return charts.flatMap(([name, chart]) =>
    themes.map((theme) => ({ path: `charts/${name}-${theme}.svg`, content: chart(dataset, theme) })),
  );
}
