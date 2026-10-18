// Version parsing for release tags. Only plain x.y.z (optionally v-prefixed) counts as
// a version; anything else is a tag that sorts by its publish date.

export interface Version {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const VERSION_RE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(tag: string): Version | null {
  const m = VERSION_RE.exec(tag);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  };
}

/** Semver precedence: a prerelease sorts before its release, numeric identifiers compare as numbers. */
export function compareVersions(a: Version, b: Version): number {
  const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (core !== 0) return core;
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return b.prerelease.length - a.prerelease.length;
  }
  const n = Math.min(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < n; i++) {
    const x = a.prerelease[i] ?? '';
    const y = b.prerelease[i] ?? '';
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return a.prerelease.length - b.prerelease.length;
}

export interface TaggedRelease {
  tag: string;
  publishedAt: string;
}

/** Versions compare as semver; when either tag isn't one, the publish time decides. */
export function compareReleases(a: TaggedRelease, b: TaggedRelease): number {
  const va = parseVersion(a.tag);
  const vb = parseVersion(b.tag);
  if (va && vb) return compareVersions(va, vb);
  return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
}

/** Newest first; tags that aren't versions keep their publish order among themselves. */
export function sortReleases<T extends TaggedRelease>(releases: readonly T[]): T[] {
  return [...releases].sort((a, b) => compareReleases(b, a));
}
