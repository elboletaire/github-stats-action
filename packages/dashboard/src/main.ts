// Entry point: reads the datasets (inlined in the standalone page, fetched from data/ in the Pages build) and mounts them.

import type { Dataset } from '@github-stats-action/core';
import './style.css';
import { mount, redrawAll, type RepoChoice } from './app';
import { installTouchDismiss } from './tooltip';

interface Config {
  /** Standalone: every dataset, inlined. */
  datasets?: Dataset[];
  /** Pages: the repos to fetch from `data/<owner>/<repo>/dataset.json`. */
  repos?: string[];
}

function readConfig(): Config {
  const text = document.getElementById('gsa-config')?.textContent ?? '{}';
  try {
    return JSON.parse(text) as Config;
  } catch {
    return {};
  }
}

async function load(repo: string): Promise<Dataset> {
  const path = repo.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`data/${path}/dataset.json`);
  if (!response.ok) throw new Error(`${repo}: HTTP ${response.status}`);
  return (await response.json()) as Dataset;
}

async function boot(): Promise<void> {
  installTouchDismiss();
  const root = document.getElementById('app') as HTMLElement;
  const config = readConfig();
  let datasets: Dataset[];
  let failed = 0;
  try {
    const results = config.datasets ? null : await Promise.allSettled((config.repos ?? []).map(load));
    datasets = config.datasets ?? (results ?? []).flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    failed = results?.filter((r) => r.status === 'rejected').length ?? 0;
  } catch (error) {
    root.textContent = `Could not load the stats: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  if (datasets.length === 0) {
    root.textContent = failed ? 'Could not load any repository stats.' : 'No stats yet.';
    return;
  }

  let selected = 0;
  const show = (): void => {
    const choice: RepoChoice | undefined = datasets.length > 1
      ? {
          repos: datasets.map((d) => d.repo),
          selected,
          onSelect: (index) => {
            selected = index;
            show();
          },
        }
      : undefined;
    mount(root, datasets[selected]!, choice);
    if (failed) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = `${failed} repositor${failed === 1 ? 'y' : 'ies'} could not be loaded and ${failed === 1 ? 'is' : 'are'} left out.`;
      root.querySelector('header')?.after(note);
    }
  };
  show();

  let timer: ReturnType<typeof setTimeout> | undefined;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(redrawAll, 120);
  });
  // a configured stars colour depends on the page's theme, so the OS theme switching redraws the charts
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
}

void boot();
