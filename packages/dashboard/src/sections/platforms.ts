// Platforms: all-time downloads per file label, one block per group.

import type { Dataset } from '@github-stats-action/core';
import { esc, f0, percent } from '../format';
import { countedGroups, platformTotals } from '../model';
import { colorVar } from '../palette';
import { makeSection, type Section } from './common';

export function platforms(d: Dataset): Section {
  const blocks = countedGroups(d).map((g) => {
    const list = platformTotals(d, g.name);
    const max = Math.max(1, ...list.map(([, v]) => v));
    const total = list.reduce((s, [, v]) => s + v, 0);
    const rows = list.map(([label, v]) =>
      `<div class="brow"><span>${esc(label)}</span><span class="t"><i style="width:${(v / max) * 100}%;background:${colorVar(g)}"></i></span>` +
      `<span>${f0(v)} <small style="color:var(--muted)">${percent(v, total)}</small></span></div>`,
    );
    return `<div><h2 style="font-size:14px;margin-bottom:8px"><i class="sw" style="background:${colorVar(g)}"></i>${esc(g.label)}</h2>` +
      `<div class="bars">${rows.join('') || '<p class="note">No downloads yet.</p>'}</div></div>`;
  });
  return {
    el: makeSection(
      `<div><h2>Platforms</h2><p class="note">All-time downloads by file, summed over every release. Ignored files are excluded.</p></div>` +
      `<div class="cols">${blocks.join('')}</div>`,
    ),
  };
}
