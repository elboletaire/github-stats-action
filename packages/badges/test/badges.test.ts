import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dataset } from '@github-stats-action/core';
import { describe, expect, it } from 'vitest';
import { buildBadges, endpointJson, renderBadges } from '../src/badges';
import { flatSvg } from '../src/svg';

const fixture: Dataset = JSON.parse(readFileSync(join(import.meta.dirname, '../../../fixtures/dataset.json'), 'utf8'));

function dataset(overrides: Partial<Dataset>): Dataset {
  return { ...fixture, ...overrides };
}

describe('buildBadges', () => {
  it('produces the total, one per group, the latest release, stars, Docker and each counter', () => {
    const badges = buildBadges(fixture);
    expect(badges.map((b) => b.name)).toEqual([
      'downloads',
      'downloads-app',
      'downloads-cli',
      'release-latest',
      'stars',
      'docker-pulls',
      'counter-updates',
    ]);
    expect(badges[0]).toMatchObject({ label: 'downloads', message: '12.2k' });
    expect(badges[2]).toMatchObject({ label: 'downloads (CLI)', message: '11.8k' });
  });

  it('labels the latest release with its tag and skips prereleases', () => {
    const latest = fixture.releases.at(-1)!;
    const badge = buildBadges(fixture).find((b) => b.name === 'release-latest')!;
    expect(badge.label).toBe(`${latest.tag} downloads`);
    const withPrerelease = dataset({
      releases: [...fixture.releases, { ...latest, tag: 'v9.0.0-rc.1', prerelease: true }],
    });
    expect(buildBadges(withPrerelease).find((b) => b.name === 'release-latest')!.label).toBe(`${latest.tag} downloads`);
  });

  it('drops the Docker badge when no pulls were ever collected', () => {
    const badges = buildBadges(dataset({ totals: { ...fixture.totals, docker: null } }));
    expect(badges.some((b) => b.name === 'docker-pulls')).toBe(false);
  });

  it('gives a counter with no counted downloads a zero', () => {
    const badges = buildBadges(dataset({ totals: { ...fixture.totals, counters: {} } }));
    expect(badges.find((b) => b.name === 'counter-updates')!.message).toBe('0');
  });
});

describe('endpointJson', () => {
  it('is the shields.io endpoint shape', () => {
    const json = JSON.parse(endpointJson({ name: 'stars', label: 'stars', message: '1.2k', color: 'yellow' }));
    expect(json).toEqual({ schemaVersion: 1, label: 'stars', message: '1.2k', color: 'yellow' });
  });
});

describe('renderBadges', () => {
  it('writes a JSON and an SVG per badge under badges/', () => {
    const files = renderBadges(fixture);
    const badges = buildBadges(fixture);
    expect(files).toHaveLength(badges.length * 2);
    expect(files.map((f) => f.path)).toContain('badges/downloads.json');
    expect(files.map((f) => f.path)).toContain('badges/downloads.svg');
    for (const file of files) expect(file.path).toMatch(/^badges\/[a-z0-9-]+\.(json|svg)$/);
  });
});

describe('flatSvg', () => {
  it('has the label and message as escaped text and an aria-label', () => {
    const svg = flatSvg({ label: 'a < b', message: '1&2', color: 'blue' });
    expect(svg).toContain('aria-label="a &lt; b: 1&amp;2"');
    expect(svg).toContain('>a &lt; b</text>');
    expect(svg).toContain('>1&amp;2</text>');
    expect(svg).not.toContain('a < b');
  });

  it('resolves shields.io colour names and hex codes', () => {
    expect(flatSvg({ label: 'x', message: 'y', color: 'blue' })).toContain('fill="#007ec6"');
    expect(flatSvg({ label: 'x', message: 'y', color: '8957e5' })).toContain('fill="#8957e5"');
  });

  it('refuses a colour that is neither a name nor hex, so it cannot inject markup', () => {
    expect(() => flatSvg({ label: 'x', message: 'y', color: '"><script>' })).toThrow(/not a badge colour/);
  });

  it('sizes the two parts to their text plus padding', () => {
    const svg = flatSvg({ label: 'downloads', message: '12.2k', color: 'blue' });
    // 58.4px + 31.4px of text, 10px padding each part; shields.io rounds the same badge to 110.
    expect(svg).toMatch(/<svg [^>]*width="109"/);
    expect(svg).toContain('<rect x="68" width="41"');
  });
});
