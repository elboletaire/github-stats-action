// SVG charts for one repo: each chart in a light and a dark file, for a <picture> in READMEs.

import type { ChartName, Dataset, OutputFile } from '@github-stats-action/core';
import { downloadsPerDayChart } from './downloads';
import { npmDownloadsChart } from './npm';
import { downloadsPerReleaseChart } from './releases';
import { starsChart } from './stars';
import type { Theme } from './svg';
import { windowed } from './window';

type Chart = (dataset: Dataset, theme: Theme) => string;

/** Paths are relative to `<owner>/<repo>/`: `charts/<name>-light.svg` and `-dark.svg`. The download charts need release downloads, the npm one npm. */
export function renderCharts(dataset: Dataset): OutputFile[] {
  // each chart reads its own key of the config (its window), and the npm chart's file name differs from its key
  const charts: [string, ChartName, Chart][] = [
    ['stars', 'stars', starsChart],
    ...(dataset.releaseDownloads
      ? [
          ['downloads-per-day', 'downloads-per-day', downloadsPerDayChart] as [string, ChartName, Chart],
          ['downloads-per-release', 'downloads-per-release', downloadsPerReleaseChart] as [string, ChartName, Chart],
        ]
      : []),
    ...(dataset.npm ? [['npm-downloads', 'npmDownloads', npmDownloadsChart] as [string, ChartName, Chart]] : []),
  ];
  const themes: Theme[] = ['light', 'dark'];
  return charts.flatMap(([name, key, chart]) => {
    const view = windowed(dataset, key);
    return themes.map((theme) => ({ path: `charts/${name}-${theme}.svg`, content: chart(view, theme) }));
  });
}
