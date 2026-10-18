// Daily snapshots: the change between consecutive snapshots, newest first.

import type { Dataset } from '@github-stats-action/core';
import { esc, sgn } from '../format';
import { countedGroups } from '../model';
import { makeSection, type Section } from './common';

export function snapshots(d: Dataset): Section {
  const groups = countedGroups(d);
  const hasDocker = d.measuredDaily.some((e) => e.docker !== null);
  const head = `<thead><tr><th>Date</th><th>Days</th>${groups.map((g) => `<th>${esc(g.label)} +</th>`).join('')}<th>Total +</th>` +
    (hasDocker ? '<th>Docker +</th>' : '') + '<th>Stars +</th>' +
    d.counters.map((c) => `<th>${esc(c.label)} +</th>`).join('') + '</tr></thead>';
  const rows = d.measuredDaily.slice().reverse().map((e) => {
    const total = groups.reduce((s, g) => s + (e.groups[g.name] ?? 0), 0);
    const cell = (v: number | null): string => `<td class="${v !== null && v > 0 ? 'pos' : ''}">${sgn(v)}</td>`;
    return `<tr><td>${esc(e.date)}</td><td>${e.days}</td>` +
      groups.map((g) => cell(e.groups[g.name] ?? 0)).join('') + cell(total) +
      (hasDocker ? cell(e.docker) : '') + cell(e.stars) +
      d.counters.map((c) => cell(e.counters[c.name] ?? 0)).join('') + '</tr>';
  });
  const body = rows.length
    ? `<div class="scroll"><table>${head}<tbody>${rows.join('')}</tbody></table></div>`
    : '<p class="note">No change to show yet.</p>';
  return {
    el: makeSection(
      `<div><h2>Daily snapshots<span class="est meas">measured</span></h2>` +
      `<p class="note">The change since the previous snapshot, dated by the later one. A day count above 1 means snapshots were missed in between. This table grows by a row every day.</p></div>` +
      body,
    ),
  };
}
