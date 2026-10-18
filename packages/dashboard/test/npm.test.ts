import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@github-stats-action/core';
import { buildNpmData } from '@github-stats-action/core';
import { npm } from '../src/sections/npm';
import { joinWords, subtitle } from '../src/app';
import { npmDaily } from '../src/model';

const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/dataset.json', import.meta.url), 'utf8')) as Dataset;

describe('npm section', () => {
  it('is left out of the page when the dataset has no npm figures', () => {
    // returns before it touches the DOM, which this suite does not have
    expect(npm(fixture)).toBeNull();
  });
});

describe('npmDaily', () => {
  it('lays every package on one day axis from the first stored day to the latest, zero where a package has no day', () => {
    const data = buildNpmData([
      { label: 'A', series: { schema: 1, package: 'a', days: [{ date: '2026-10-16', downloads: 4 }, { date: '2026-10-18', downloads: 6 }] } },
      { label: 'B', series: { schema: 1, package: 'b', days: [{ date: '2026-10-17', downloads: 9 }, { date: '2026-10-18', downloads: 1 }] } },
    ])!;
    expect(npmDaily(data)).toEqual({ start: '2026-10-16', series: [[4, 0, 6], [0, 9, 1]] });
  });
});

describe('subtitle', () => {
  it('names the release downloads and their groups, as before', () => {
    expect(subtitle(fixture)).toBe('GitHub release downloads for elboletaire/manga-downloader, split into Desktop app and CLI.');
  });

  it('names the sources that are shown when release downloads are not', () => {
    const page = { ...fixture, releaseDownloads: false, groups: [], totals: { ...fixture.totals, docker: null } };
    expect(subtitle(page)).toBe('Stars for elboletaire/manga-downloader.');
    expect(subtitle({ ...page, npm: buildNpmData([{ label: 'A', series: { schema: 1, package: 'a', days: [{ date: '2026-10-17', downloads: 1 }] } }]) })).toBe(
      'Stars and npm downloads for elboletaire/manga-downloader.',
    );
  });

  it('joins a list the English way', () => {
    expect(joinWords(['A'])).toBe('A');
    expect(joinWords(['A', 'B'])).toBe('A and B');
    expect(joinWords(['A', 'B', 'C'])).toBe('A, B, and C');
  });
});
