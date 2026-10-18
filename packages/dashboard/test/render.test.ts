import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@github-stats-action/core';
import { dashboardFiles } from '../src/render';

const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/dataset.json', import.meta.url), 'utf8')) as Dataset;

describe('dashboardFiles', () => {
  it('writes the standalone page with every dataset inlined and no fetch', () => {
    const [file] = dashboardFiles([fixture], { mode: 'standalone' });
    expect(file?.path).toBe('dashboard/index.html');
    const html = file!.content;
    expect(html).not.toContain('__GSA_CONFIG__');
    expect(html).not.toContain('<script type="module" crossorigin src=');
    const config = /<script id="gsa-config" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(JSON.parse(config)).toEqual({ datasets: [JSON.parse(JSON.stringify(fixture))] });
  });

  it('writes the pages build with the repo list and each dataset under data/', () => {
    const files = dashboardFiles([fixture], { mode: 'pages' });
    const index = files.find((f) => f.path === 'index.html')!;
    expect(index.content).toContain('"repos":["elboletaire/manga-downloader"]');
    expect(files.some((f) => f.path.startsWith('assets/') && f.path.endsWith('.js'))).toBe(true);
    const data = files.find((f) => f.path === 'data/elboletaire/manga-downloader/dataset.json')!;
    expect(JSON.parse(data.content)).toEqual(JSON.parse(JSON.stringify(fixture)));
  });

  it('inlines the fonts in the standalone page and ships them as base64 files in the pages build', () => {
    const html = dashboardFiles([fixture], { mode: 'standalone' })[0]!.content;
    expect(html).toContain('url(data:font/woff2;base64,');
    expect(html).not.toMatch(/url\(["']?\.\//);
    const pages = dashboardFiles([fixture], { mode: 'pages' });
    const fonts = pages.filter((f) => f.path.endsWith('.woff2'));
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((f) => f.path.startsWith('assets/') && f.encoding === 'base64')).toBe(true);
    for (const font of fonts) {
      expect(Buffer.from(font.content, 'base64').subarray(0, 4).toString('latin1')).toBe('wOF2');
    }
    // every font url in the pages stylesheet is relative and names a file the build emits
    const emitted = new Set(pages.map((f) => f.path));
    const css = pages.find((f) => f.path.startsWith('assets/') && f.path.endsWith('.css'))!.content;
    const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^\.\/[^/]+\.woff2$/);
      expect(emitted.has(`assets/${url.slice(2)}`)).toBe(true);
    }
  });

  it('keeps `<` out of the inlined JSON so a value cannot close the script element', () => {
    const hostile = { ...fixture, repo: 'x/</script><b>' };
    const html = dashboardFiles([hostile], { mode: 'standalone' })[0]!.content;
    expect(html).not.toContain('</script><b>');
  });
});
