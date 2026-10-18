// KPI tiles: the all-time totals, each with the change since the previous measured snapshot.

import type { Dataset } from '@github-stats-action/core';
import { esc, f0, sgn } from '../format';
import { colorVar } from '../palette';
import { makeSection, type Section } from './common';
import { countedGroups } from '../model';

interface Tile {
  label: string;
  value: number;
  /** Change since the previous snapshot; null when there is none. */
  change: number | null;
  swatch?: string;
  note?: string;
}

export function kpis(d: Dataset): Section {
  const latest = d.measuredDaily.at(-1);
  const tiles: Tile[] = [];
  const groups = countedGroups(d);
  // release downloads, and the counters of their assets, only when they count
  if (d.releaseDownloads) {
    tiles.push({
      label: 'All-time downloads',
      value: d.totals.downloads,
      change: latest ? groups.reduce((sum, g) => sum + (latest.groups[g.name] ?? 0), 0) : null,
    });
    for (const g of groups) {
      tiles.push({
        label: g.label,
        value: d.totals.groups[g.name] ?? 0,
        change: latest ? (latest.groups[g.name] ?? 0) : null,
        swatch: colorVar(g),
      });
    }
  }
  if (d.totals.docker !== null) {
    tiles.push({ label: 'Docker pulls', value: d.totals.docker, change: latest ? latest.docker : null });
  }
  if (d.releaseDownloads) {
    for (const counter of d.counters) {
      tiles.push({
        label: counter.label,
        value: d.totals.counters[counter.name]?.downloads ?? 0,
        change: latest ? (latest.counters[counter.name] ?? 0) : null,
        note: counter.from ? `Counted from ${counter.from}` : undefined,
      });
    }
  }
  tiles.push({ label: 'GitHub stars', value: d.totals.stars, change: latest ? latest.stars : null });

  const cards = tiles.map((t) => {
    const change = !latest || t.change === null
      ? '<div class="d">no change data</div>'
      : `<div class="d"><b class="${t.change > 0 ? 'pos' : ''}">${sgn(t.change)}</b> on <span class="nw">${esc(latest.date)}</span>${latest.days > 1 ? ` (over ${latest.days} days)` : ''}</div>`;
    const swatch = t.swatch ? `<i class="sw" style="background:${t.swatch}"></i>` : '';
    const note = t.note ? `<div class="note">${esc(t.note)}</div>` : '';
    return `<div class="kpi"><div class="l">${swatch}${esc(t.label)}</div><div class="v">${f0(t.value)}</div>${change}${note}</div>`;
  });
  const el = makeSection(`<div class="kpis">${cards.join('')}</div>`);
  el.className = 'kpis-wrap';
  return { el };
}
