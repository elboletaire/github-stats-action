// Node side of the dashboard: the files `dashboardFiles` returns, from the pages build and the
// standalone page embedded at build time (see vite.config.ts). Nothing here reads the disk.

import type { Dataset, OutputFile } from '@github-stats-action/core';
import { PAGES_BLOBS, PAGES_FILES, STANDALONE_HTML } from './embedded';

/** The placeholder element the build leaves for the datasets or the repo list. */
const CONFIG_PLACEHOLDER = '<script id="gsa-config" type="application/json">__GSA_CONFIG__</script>';

/** JSON that can sit inside a `<script>` element: `<` never closes it early. */
const embedJson = (value: unknown): string =>
  `<script id="gsa-config" type="application/json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;

// `standalone`: one page with every dataset inlined, at `dashboard/index.html`.
// `pages`: the static site, each dataset fetched from `data/<owner>/<repo>/dataset.json`.
export function dashboardFiles(datasets: readonly Dataset[], options: { mode: 'pages' | 'standalone' }): OutputFile[] {
  if (options.mode === 'standalone') {
    const html = STANDALONE_HTML.replace(CONFIG_PLACEHOLDER, () => embedJson({ datasets }));
    return [{ path: 'dashboard/index.html', content: html }];
  }
  const index = (PAGES_FILES['index.html'] ?? '').replace(CONFIG_PLACEHOLDER, () => embedJson({ repos: datasets.map((d) => d.repo) }));
  const assets = Object.entries(PAGES_FILES)
    .filter(([path]) => path !== 'index.html')
    .map(([path, content]) => ({ path, content }));
  const fonts = Object.entries(PAGES_BLOBS).map(([path, content]) => ({ path, content, encoding: 'base64' as const }));
  const data = datasets.map((d) => ({ path: `data/${d.repo}/dataset.json`, content: `${JSON.stringify(d)}\n` }));
  return [{ path: 'index.html', content: index }, ...assets, ...fonts, ...data];
}
