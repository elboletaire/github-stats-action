// Output renderers. Each returns the files to write; the action and the CLI do the writing.
// The dashboard is still a stub; charts and badges live in their own packages.

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
