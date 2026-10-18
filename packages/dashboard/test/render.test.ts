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

  it('keeps `<` out of the inlined JSON so a value cannot close the script element', () => {
    const hostile = { ...fixture, repo: 'x/</script><b>' };
    const html = dashboardFiles([hostile], { mode: 'standalone' })[0]!.content;
    expect(html).not.toContain('</script><b>');
  });
});
