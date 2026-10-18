// Output renderers. Each returns the files to write; the action and the CLI do the writing.
// Stubs until the dashboard, svg and badges packages fill them in.

import type { Dataset } from './types';

export interface OutputFile {
  path: string;
  content: string;
}

/**
 * `standalone`: one self-contained page with every dataset inlined; paths are relative
 * to the data branch root (`dashboard/index.html`).
 * `pages`: the static site with datasets fetched from `data/<owner>/<repo>/dataset.json`;
 * paths are relative to the Pages dir (the action writes the datasets there).
 */
export function renderDashboard(datasets: readonly Dataset[], options: { mode: 'pages' | 'standalone' }): OutputFile[] {
  void datasets;
  void options;
  return [];
}

/** SVG charts for one repo; paths are relative to `<owner>/<repo>/` (`charts/*.svg`). */
export function renderCharts(dataset: Dataset): OutputFile[] {
  void dataset;
  return [];
}

/** Badges for one repo; paths are relative to `<owner>/<repo>/` (`badges/*`). */
export function renderBadges(dataset: Dataset): OutputFile[] {
  void dataset;
  return [];
}
