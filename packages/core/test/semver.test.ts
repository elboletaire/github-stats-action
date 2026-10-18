import { describe, expect, it } from 'vitest';
import { compareReleases, compareVersions, parseVersion, sortReleases } from '../src/semver';

describe('parseVersion', () => {
  it('accepts x.y.z with or without the v prefix', () => {
    expect(parseVersion('v1.19.1')).toEqual({ major: 1, minor: 19, patch: 1, prerelease: [] });
    expect(parseVersion('2.0.0-rc.1')).toEqual({ major: 2, minor: 0, patch: 0, prerelease: ['rc', '1'] });
  });

  it.each(['v0.0.x', '1.2', 'latest', 'v01.2.3', 'nightly-2026-10-18'])('rejects %s', (tag) => {
    expect(parseVersion(tag)).toBeNull();
  });
});

describe('compareVersions', () => {
  const cmp = (a: string, b: string) => Math.sign(compareVersions(parseVersion(a)!, parseVersion(b)!));

  it('compares numerically, not as text', () => {
    expect(cmp('v1.10.0', 'v1.9.0')).toBe(1);
    expect(cmp('v1.9.0', 'v1.10.0')).toBe(-1);
    expect(cmp('v1.19.1', 'v1.19.1')).toBe(0);
  });

  it('sorts a prerelease before its release, and numeric identifiers as numbers', () => {
    expect(cmp('v1.20.0-rc.1', 'v1.20.0')).toBe(-1);
    expect(cmp('v1.20.0-rc.2', 'v1.20.0-rc.10')).toBe(-1);
    expect(cmp('v1.20.0-alpha', 'v1.20.0-1')).toBe(1);
  });
});

describe('compareReleases and sortReleases', () => {
  it('compares versions as semver when both tags are versions', () => {
    const older = { tag: 'v1.9.0', publishedAt: '2026-10-02T00:00:00Z' };
    const newer = { tag: 'v1.10.0', publishedAt: '2026-10-01T00:00:00Z' };
    expect(compareReleases(newer, older)).toBeGreaterThan(0);
  });

  it('falls back to the publish time when a tag is not a version', () => {
    const nightly = { tag: 'nightly', publishedAt: '2026-10-02T00:00:00Z' };
    const release = { tag: 'v1.10.0', publishedAt: '2026-10-01T00:00:00Z' };
    expect(compareReleases(nightly, release)).toBeGreaterThan(0);
  });

  it('sorts newest version first', () => {
    const sorted = sortReleases([
      { tag: 'v1.9.0', publishedAt: '2026-01-01T00:00:00Z' },
      { tag: 'v1.10.0', publishedAt: '2026-01-02T00:00:00Z' },
      { tag: 'v1.10.1', publishedAt: '2026-01-03T00:00:00Z' },
    ]);
    expect(sorted.map((r) => r.tag)).toEqual(['v1.10.1', 'v1.10.0', 'v1.9.0']);
  });
});
