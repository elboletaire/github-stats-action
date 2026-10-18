// Mounts the dashboard for one dataset: the header, every section in reading order, and the footer.

import type { Dataset } from '@github-stats-action/core';
import { esc, isoDay } from './format';
import { countedGroups } from './model';
import { estimated } from './sections/estimated';
import { kpis } from './sections/kpis';
import { measured } from './sections/measured';
import { periods } from './sections/periods';
import { platforms } from './sections/platforms';
import { releases } from './sections/releases';
import { snapshots } from './sections/snapshots';
import { stars } from './sections/stars';
import { traffic } from './sections/traffic';
import type { Section } from './sections/common';
import { versions } from './sections/versions';

/** With several repos, the header gets a switcher that re-mounts the page. */
export interface RepoChoice {
  repos: string[];
  selected: number;
  onSelect(index: number): void;
}

let current: Section[] = [];

export function mount(root: HTMLElement, d: Dataset, choice?: RepoChoice): void {
  const sections: Section[] = [
    kpis(d),
    periods(d),
    releases(d),
    versions(d),
    estimated(d),
    measured(d),
    platforms(d),
    stars(d),
    traffic(d),
    snapshots(d),
  ].filter((s): s is Section => s !== null);
  root.replaceChildren(header(d, choice), ...sections.map((s) => s.el), footer(d));
  current = sections;
  for (const s of sections) s.redraw?.();
}

/** Redraws the mounted charts for the current width. */
export function redrawAll(): void {
  for (const s of current) s.redraw?.();
}

function header(d: Dataset, choice: RepoChoice | undefined): HTMLElement {
  const labels = countedGroups(d).map((g) => g.label).join(' and ');
  const el = document.createElement('header');
  el.innerHTML = `<h1>Download stats</h1><p class="sub">GitHub release downloads for ${esc(d.repo)}${labels ? `, split into ${esc(labels)}` : ''}.</p>`;
  if (choice) {
    const label = document.createElement('label');
    label.className = 'repo';
    label.textContent = 'Repository ';
    const select = document.createElement('select');
    choice.repos.forEach((repo, i) => {
      const option = new Option(repo, String(i), false, i === choice.selected);
      select.appendChild(option);
    });
    select.addEventListener('change', () => choice.onSelect(Number(select.value)));
    label.appendChild(select);
    el.appendChild(label);
  }
  return el;
}

function footer(d: Dataset): HTMLElement {
  const counters = d.counters.map((c) => `${esc(c.label)} counts downloads of the files matching <code>${esc(c.assets)}</code>${c.from ? `, from ${esc(c.from)}` : ''}.`);
  const el = document.createElement('footer');
  el.innerHTML = `<p>Data built ${esc(isoDay(d.generatedAt))}, from the snapshot taken ${esc(d.snapshotAt)}. Sources: the GitHub Releases API (per-file download counts, all releases), GitHub's repository counts, and Docker Hub pulls, as stored in the daily snapshots.</p>` +
    `<p>Method: groups are split by file name, and ignored files are left out of the totals. Per-day numbers are estimates from cumulative counts spread evenly over each release's live window, so they smooth over launch-day spikes. Counts include repeat downloads and automated fetches, and GitHub never reports downloads of deleted assets.</p>` +
    (counters.length ? `<p>${counters.join(' ')}</p>` : '');
  return el;
}
