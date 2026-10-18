// Asset patterns: `*` matches any run of characters, everything else is literal.

const cache = new Map<string, RegExp>();

export function globToRegExp(pattern: string): RegExp {
  let re = cache.get(pattern);
  if (!re) {
    const source = pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    re = new RegExp(`^${source}$`);
    cache.set(pattern, re);
  }
  return re;
}

export function matchGlob(name: string, pattern: string): boolean {
  return globToRegExp(pattern).test(name);
}
