// SVG charts for one repo: each chart in a light and a dark file, for a <picture> in READMEs.

import type { ChartName, ChartsConfig, Dataset, OutputFile } from '@github-stats-action/core';
import { cloudflareUsersChart } from './cloudflare';
import { downloadsPerDayChart } from './downloads';
import { npmDownloadsChart } from './npm';
import { downloadsPerReleaseChart } from './releases';
import { starsChart } from './stars';
import type { Theme } from './svg';

type Chart = (dataset: Dataset, theme: Theme) => string;

/** Paths are relative to `<owner>/<repo>/`: `charts/<name>-light.svg` and `-dark.svg`. The download charts need release downloads, the npm one npm, the users one Cloudflare. */
export function renderCharts(dataset: Dataset): OutputFile[] {
  const charts: [ChartName, Chart][] = [
    ['stars', starsChart],
    ...(dataset.releaseDownloads
      ? [
          ['downloads-per-day', downloadsPerDayChart] as [ChartName, Chart],
          ['downloads-per-release', downloadsPerReleaseChart] as [ChartName, Chart],
        ]
      : []),
    ...(dataset.npm ? [['npm-downloads', npmDownloadsChart] as [ChartName, Chart]] : []),
    ...(dataset.cloudflare ? [['cloudflare-users', cloudflareUsersChart] as [ChartName, Chart]] : []),
  ];
  const themes: Theme[] = ['light', 'dark'];
  const files = (name: string, chart: Chart, data: Dataset) =>
    themes.map((theme) => ({ path: `charts/${name}-${theme}.svg`, content: chart(data, theme) }));
  // a variant is its base chart with its own options in place of the base's, so it follows the base's availability
  return charts.flatMap(([name, chart]) => [
    ...files(name, chart, dataset),
    ...(dataset.charts?.variants ?? [])
      .filter((variant) => variant.chart === name)
      .flatMap((variant) =>
        files(`${name}-${variant.name}`, chart, { ...dataset, charts: { ...dataset.charts, [name]: variant.options } as ChartsConfig }),
      ),
  ]);
}
