import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig } from '../src/config';
import { classifyAsset, IGNORED, OTHER, platformLabel } from '../src/assets';

const config = parseConfig(`
groups:
  - { name: app, assets: "manga-downloader-gui-*" }
  - { name: cli, assets: "manga-downloader-*" }
ignore: ["*.md5", "*-SHA256SUMS.txt"]
platforms:
  - { match: "*-windows-amd64-installer.exe", label: Windows amd64 installer }
`);

describe('classifyAsset', () => {
  it('ignores checksum files before any group can take them', () => {
    expect(classifyAsset('manga-downloader-gui-v1.19.1-SHA256SUMS.txt', config)).toBe(IGNORED);
    expect(classifyAsset('manga-downloader-v1.19.1-darwin-amd64.tar.gz.md5', config)).toBe(IGNORED);
  });

  it('takes the first matching group, in config order', () => {
    expect(classifyAsset('manga-downloader-gui-v1.19.1-linux-amd64.tar.gz', config)).toBe('app');
    expect(classifyAsset('manga-downloader-v1.19.1-darwin-amd64.tar.gz', config)).toBe('cli');
  });

  it('puts assets that match no group in other', () => {
    expect(classifyAsset('notes.pdf', config)).toBe(OTHER);
    expect(classifyAsset('anything.zip', DEFAULT_CONFIG)).toBe('downloads');
  });
});

describe('platformLabel', () => {
  it('strips the repo name, the tag and archive suffixes by default', () => {
    expect(platformLabel('manga-downloader-gui-v1.19.1-linux-amd64.tar.gz', 'v1.19.1', 'o/manga-downloader', [])).toBe(
      'gui-linux-amd64',
    );
    expect(platformLabel('manga-downloader-v1.19.1-darwin-amd64.tar.gz.md5', 'v1.19.1', 'o/manga-downloader', [])).toBe(
      'darwin-amd64',
    );
  });

  it('uses the first platform rule that matches', () => {
    expect(
      platformLabel(
        'manga-downloader-gui-v1.19.1-windows-amd64-installer.exe',
        'v1.19.1',
        'o/manga-downloader',
        config.platforms,
      ),
    ).toBe('Windows amd64 installer');
  });
});
