// Downloads by version and file: one release at a time as bars, and every release as a pivot table.

import type { Dataset, FileRow, GroupInfo, ReleaseRow } from '@github-stats-action/core';
import { esc, f0, isoDay, plural } from '../format';
import { countedGroups, IGNORED, pivotColumns, releaseCells } from '../model';
import { colorVar } from '../palette';
import { showTip, hideTip, tipOn } from '../tooltip';
import { makeSection, type Section } from './common';
import { countersNote } from './releases';

export function versions(d: Dataset): Section {
  if (d.releases.length === 0) return { el: makeSection('<div><h2>Downloads by version and file</h2><p class="note">No releases yet.</p></div>') };
  const R = d.releases.slice().reverse();
  const groups = countedGroups(d);
  const cols = pivotColumns(d);
  const groupsWithCols = groups.filter((g) => cols.some((c) => c.group.name === g.name));

  const options = R.map((r, i) => `<option value="${i}">${esc(r.tag)} · ${isoDay(r.publishedAt)}</option>`).join('');
  const headTop = `<tr><th rowspan="2" scope="col">Release</th>` +
    groupsWithCols.map((g) => `<th colspan="${cols.filter((c) => c.group.name === g.name).length}" scope="colgroup"><i class="sw" style="background:${colorVar(g)}"></i>${esc(g.label)}</th>`).join('') +
    '<th rowspan="2" scope="col">Total</th></tr>';
  const headLabels = `<tr>${cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr>`;
  const body = R.map((r) => {
    const cells = releaseCells(r);
    const counted = groups.reduce((sum, g) => sum + (r.groups[g.name] ?? 0), 0);
    return `<tr><th scope="row">${esc(r.tag)}</th>${cols.map((c) => `<td>${cells.has(c.key) ? f0(cells.get(c.key) ?? 0) : ''}</td>`).join('')}<td><b>${f0(counted)}</b></td></tr>`;
  }).join('');
  const countedTotal = groups.reduce((sum, g) => sum + (d.totals.groups[g.name] ?? 0), 0);
  const foot = `<tr><th scope="row"><b>All</b></th>${cols.map((c) => `<td><b>${f0(c.downloads)}</b></td>`).join('')}<td><b>${f0(countedTotal)}</b></td></tr>`;

  const el = makeSection(
    `<div><h2>Downloads by version and file</h2>` +
    `<p class="note">Exact download count of every file in one release, from the GitHub Releases API. Bars share one scale; each group's files are listed apart, and ignored files sit in a collapsed group. Hover or tap a row for its full file name.</p></div>` +
    `<div class="vpick"><button type="button" data-old aria-label="Older release" title="Older release">&lsaquo;</button>` +
    `<select aria-label="Release">${options}</select>` +
    `<button type="button" data-new aria-label="Newer release" title="Newer release">&rsaquo;</button>` +
    `<span class="num" data-meta></span></div>` +
    `<div class="vgroups" data-bars></div>` +
    `<details><summary>All versions</summary><div class="scroll pivot"><table><thead>${headTop}${headLabels}</thead>` +
    `<tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>` +
    `<p class="note">Blank means the release had no such file. Row totals count the counted groups' files; ignored files are left out.</p>` +
    `${countersNote(d)}</details>`,
  );

  const sel = el.querySelector('select') as HTMLSelectElement;
  const old = el.querySelector('[data-old]') as HTMLButtonElement;
  const next = el.querySelector('[data-new]') as HTMLButtonElement;
  const meta = el.querySelector('[data-meta]') as HTMLElement;
  const bars = el.querySelector('[data-bars]') as HTMLElement;
  let cur = 0;

  const show = (i: number): void => {
    hideTip();
    const was = document.activeElement;
    cur = i;
    const r = R[i]!;
    const mx = Math.max(1, ...r.files.map((f) => f.downloads));
    sel.value = String(i);
    old.disabled = i >= R.length - 1;
    next.disabled = i <= 0;
    // a button disabled while focused would drop focus to the body
    if ((was === old || was === next) && (was as HTMLButtonElement).disabled) {
      ([old, next].find((b) => !b.disabled) ?? sel).focus();
    }
    meta.textContent = `Published ${isoDay(r.publishedAt)} · ${groups.map((g) => `${g.label} ${f0(r.groups[g.name] ?? 0)}`).join(' · ')}`;
    const blocks = groups.map((g) => groupBlock(r, g, mx));
    if (r.files.some((f) => f.group === IGNORED)) blocks.push(ignoredBlock(r, mx));
    bars.replaceChildren(...blocks);
  };

  sel.addEventListener('change', () => show(Number(sel.value)));
  old.addEventListener('click', () => show(cur + 1));
  next.addEventListener('click', () => show(cur - 1));
  return { el, redraw: () => show(cur) };
}

function groupBlock(r: ReleaseRow, g: GroupInfo, mx: number): HTMLElement {
  const list = r.files.filter((f) => f.group === g.name).sort((a, b) => b.downloads - a.downloads);
  const wrap = document.createElement('div');
  wrap.innerHTML = `<h3><i class="sw" style="background:${colorVar(g)}"></i>${esc(g.label)} · ${plural(list.length, 'file')}, ${f0(r.groups[g.name] ?? 0)} downloads</h3>`;
  if (list.length === 0) {
    wrap.insertAdjacentHTML('beforeend', '<p class="note">None in this release.</p>');
    return wrap;
  }
  const rows = document.createElement('div');
  rows.className = 'bars';
  for (const f of list) rows.appendChild(fileRow(f, g.label, colorVar(g), mx));
  wrap.appendChild(rows);
  return wrap;
}

function ignoredBlock(r: ReleaseRow, mx: number): HTMLElement {
  const list = r.files.filter((f) => f.group === IGNORED).sort((a, b) => b.downloads - a.downloads);
  const total = list.reduce((sum, f) => sum + f.downloads, 0);
  const details = document.createElement('details');
  details.innerHTML = `<summary>Ignored · ${plural(list.length, 'file')}, ${f0(total)} downloads</summary>`;
  const rows = document.createElement('div');
  rows.className = 'bars';
  for (const f of list) rows.appendChild(fileRow(f, 'ignored', 'var(--muted)', mx));
  details.appendChild(rows);
  return details;
}

function fileRow(f: FileRow, groupLabel: string, color: string, mx: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'brow v';
  row.innerHTML = `<span>${esc(f.label)}</span><span class="t"><i style="width:${(f.downloads / mx) * 100}%;background:${color}"></i></span><span>${f0(f.downloads)}</span>`;
  tipOn(row, (ev) => showTip(`<b style="word-break:break-all">${esc(f.name)}</b><br>${esc(groupLabel)}: ${f0(f.downloads)} downloads`, ev));
  return row;
}
