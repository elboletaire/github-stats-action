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
  try {
    datasets = config.datasets ?? (await Promise.all((config.repos ?? []).map(load)));
  } catch (error) {
    root.textContent = `Could not load the stats: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  if (datasets.length === 0) {
    root.textContent = 'No stats yet.';
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
  };
  show();

  let timer: ReturnType<typeof setTimeout> | undefined;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(redrawAll, 120);
  });
}

void boot();
