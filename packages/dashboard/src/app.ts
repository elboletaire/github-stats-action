// Mounts the dashboard for one dataset: the header, every section in reading order, and the footer.

import type { Dataset } from '@github-stats-action/core';
import { esc, isoDay } from './format';
import { finishLoad } from './intro';
import { countedGroups } from './model';
import { estimated } from './sections/estimated';
import { kpis } from './sections/kpis';
import { measured } from './sections/measured';
import { npm } from './sections/npm';
import { periods } from './sections/periods';
import { platforms } from './sections/platforms';
import { releases } from './sections/releases';
import { snapshots } from './sections/snapshots';
import { stars } from './sections/stars';
import { traffic } from './sections/traffic';
import { usage } from './sections/usage';
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
  // the release sections need release downloads; without them the page is stars, npm and the rest
  const sections: Array<Section | null> = [
    kpis(d),
    d.releaseDownloads ? periods(d) : null,
    d.releaseDownloads ? releases(d) : null,
    d.releaseDownloads ? versions(d) : null,
    d.releaseDownloads ? estimated(d) : null,
    d.releaseDownloads ? measured(d) : null,
    d.releaseDownloads ? platforms(d) : null,
    npm(d),
    usage(d),
    stars(d),
    traffic(d),
    snapshots(d),
  ];
  const shown = sections.filter((s): s is Section => s !== null);
  root.replaceChildren(header(d, choice), ...shown.map((s) => s.el), footer(d));
  current = shown;
  for (const s of shown) s.redraw?.();
  // the intro plays on the first mount only; the repo switcher and resizes redraw without it
  finishLoad();
}

/** Redraws the mounted charts for the current width. */
export function redrawAll(): void {
  for (const s of current) s.redraw?.();
}

/** Joins words as an English list: `A`, `A and B`, `A, B, and C`. */
export function joinWords(words: readonly string[]): string {
  if (words.length < 3) return words.join(' and ');
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
}

/** What the page shows, named after its sources: release downloads when they count, else stars and the rest. */
export function subtitle(d: Dataset): string {
  if (d.releaseDownloads) {
    const labels = countedGroups(d).map((g) => g.label).join(' and ');
    const others = [...(d.npm ? ['npm downloads'] : []), ...(d.cloudflare ? [cloudflareSource(d.cloudflare.label)] : [])];
    return `GitHub release downloads for ${esc(d.repo)}${labels ? `, split into ${esc(labels)}` : ''}${others.length ? `, and ${joinWords(others)}` : ''}.`;
  }
  const others = ['Stars', ...(d.totals.docker !== null ? ['Docker pulls'] : []), ...(d.npm ? ['npm downloads'] : []), ...(d.cloudflare ? [cloudflareSource(d.cloudflare.label)] : [])];
  return `${joinWords(others)} for ${esc(d.repo)}.`;
}

/** The Cloudflare dataset as a source in a sentence: its label, lowercased, from Cloudflare. */
function cloudflareSource(label: string): string {
  return `${esc(label.toLowerCase())} from Cloudflare`;
}

function header(d: Dataset, choice: RepoChoice | undefined): HTMLElement {
  const el = document.createElement('header');
  el.innerHTML = `<h1>Download stats</h1><p class="sub">${subtitle(d)}</p>`;
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
  const sources = [
    ...(d.releaseDownloads ? ['the GitHub Releases API (per-file download counts, all releases)'] : []),
    "GitHub's repository counts",
    ...(d.totals.docker !== null ? ['Docker Hub pulls'] : []),
    ...(d.npm ? ["npm's daily download counts"] : []),
    ...(d.cloudflare ? ['Cloudflare Analytics Engine daily counts (users are approximate)'] : []),
  ];
  const where = d.npm || d.cloudflare ? 'as stored on the data branch' : 'as stored in the daily snapshots';
  const el = document.createElement('footer');
  el.innerHTML = `<p>Data built ${esc(isoDay(d.generatedAt))}, from the snapshot taken ${esc(d.snapshotAt)}. Sources: ${joinWords(sources)}, ${where}.</p>` +
    (d.releaseDownloads
      ? `<p>Method: groups are split by file name, and ignored files are left out of the totals. Per-day numbers are estimates from cumulative counts spread evenly over each release's live window, so they smooth over launch-day spikes. Counts include repeat downloads and automated fetches, and GitHub never reports downloads of deleted assets.</p>`
      : '') +
    (counters.length ? `<p>${counters.join(' ')}</p>` : '');
  return el;
}
