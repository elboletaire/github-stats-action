import { describe, expect, it } from 'vitest';
import { matchGlob } from '../src/glob';

describe('matchGlob', () => {
  it.each([
    ['manga-downloader-gui-*', 'manga-downloader-gui-v1.19.1-linux-amd64.tar.gz', true],
    ['manga-downloader-*', 'manga-downloader-gui-v1.19.1-linux-amd64.tar.gz', true],
    ['manga-downloader-gui-*', 'manga-downloader-v1.19.1-linux-amd64.tar.gz', false],
    ['*.md5', 'manga-downloader-v1.19.1-darwin-amd64.tar.gz.md5', true],
    ['*.md5', 'manga-downloader-v1.19.1-darwin-amd64.tar.gz', false],
    ['*-SHA256SUMS.txt', 'manga-downloader-gui-v1.19.1-SHA256SUMS.txt', true],
    ['*-SHA256SUMS.txt', 'manga-downloader-gui-v1.19.1-SHA256SUMS.txt.sig', false],
    ['a.b', 'a.b', true],
    ['a.b', 'axb', false],
    ['*', '', true],
    ['a*b*c', 'abc', true],
    ['a*b*c', 'acb', false],
    ['Linux*', 'linux-amd64', false],
    ['(x)+?', '(x)+?', true],
  ])('matches %s against %s -> %s', (pattern, name, expected) => {
    expect(matchGlob(name, pattern)).toBe(expected);
  });
});
