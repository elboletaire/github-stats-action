import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNpmData, seriesColor, type ChartVariant, type Dataset, type MeasuredDay, type ReleaseRow } from '@github-stats-action/core';
import { renderCharts } from '../src/index';
import { buckets } from '../src/motion';
import { niceTicks } from '../src/svg';

const fixture = async (): Promise<Dataset> =>
  JSON.parse(await readFile(resolve(import.meta.dirname, '../../../fixtures/dataset.json'), 'utf8')) as Dataset;

const TAG = /<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g;

/** Tags nest and close, and nothing in the text is left unescaped. A small stand-in for an XML parser. */
function expectWellFormed(svg: string): void {
  const open: string[] = [];
  for (const match of svg.matchAll(TAG)) {
    const [, closing, name = '', , selfClosing] = match;
    if (closing) expect(open.pop()).toBe(name);
    else if (!selfClosing) open.push(name);
  }
  expect(open).toEqual([]);
  expect(svg.replace(TAG, '').match(/&(?!(amp|lt|gt|quot|apos|#\d+);)/)).toBeNull();
}

/** Each bar or stacked segment is a path with a title child (the hover tooltip). */
const segments = (svg: string): number => svg.match(/<path d="[^"]*" fill="[^"]*"><title>/g)?.length ?? 0;

const day = (i: number, groups: Record<string, number>): MeasuredDay => ({
  date: new Date(Date.UTC(2026, 8, 1) + i * 86_400_000).toISOString().slice(0, 10),
  days: 1,
  groups,
  stars: 1,
  docker: null,
  counters: {},
});

const release = (tag: string, groups: Record<string, number>, epoch = -1): ReleaseRow => ({
  tag,
  publishedAt: '2026-01-01T00:00:00Z',
  end: '2026-02-01T00:00:00Z',
  days: 31,
  epoch,
  prerelease: false,
  groups,
  counters: {},
  files: [],
});

function chart(files: { path: string; content: string }[], name: string): string {
  const file = files.find((f) => f.path === name);
  if (!file) throw new Error(`no ${name}`);
  return file.content;
}

describe('renderCharts', () => {
  it('writes a light and a dark file for each chart under charts/', async () => {
    const files = renderCharts(await fixture());
    expect(files.map((f) => f.path).sort()).toEqual([
      'charts/downloads-per-day-dark.svg',
      'charts/downloads-per-day-light.svg',
      'charts/downloads-per-release-dark.svg',
      'charts/downloads-per-release-light.svg',
      'charts/stars-dark.svg',
      'charts/stars-light.svg',
    ]);
  });

  it('writes well-formed standalone SVG with a title and description and no scripts or external refs', async () => {
    for (const { content } of renderCharts(await fixture())) {
      expectWellFormed(content);
      expect(content).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="800" height="300" viewBox="0 0 800 300"/);
      expect(content).toContain('<title id="title">');
      expect(content).toContain('<desc id="desc">');
      expect(content).not.toMatch(/<script|href=|src=|xlink|NaN|Infinity|undefined/);
    }
  });

  it('draws one bar segment per non-zero group of each release', async () => {
    const dataset = await fixture();
    const expected = dataset.releases.reduce((n, r) => n + dataset.groups.filter((g) => (r.groups[g.name] ?? 0) > 0).length, 0);
    const svg = chart(renderCharts(dataset), 'charts/downloads-per-release-light.svg');
    expect(segments(svg)).toBe(expected);
  });

  it('labels the configured epochs and no others', async () => {
    const dataset = await fixture();
    const svg = chart(renderCharts(dataset), 'charts/downloads-per-release-light.svg');
    for (const epoch of dataset.epochs) expect(svg).toContain(`${epoch.version} ${epoch.label}`);
    expect(svg.match(/<line [^>]*stroke-width="1"><title>/g)).toHaveLength(dataset.epochs.length);
  });

  it('draws estimated areas and says so on a fixture with one measured day', async () => {
    const dataset = await fixture();
    const svg = chart(renderCharts(dataset), 'charts/downloads-per-day-light.svg');
    expect(svg).toContain('Estimated');
    expect(svg).toContain('measured needs 14 days, have 1');
    expect(svg.match(/fill-opacity="0.18"/g)).toHaveLength(2);
  });

  it('draws one bar per measured day and group once there are 14 measured days', async () => {
    const dataset = await fixture();
    const measured = Array.from({ length: 20 }, (_, i) => day(i, { app: i % 3, cli: 10 + i }));
    const svg = chart(renderCharts({ ...dataset, measuredDaily: measured }), 'charts/downloads-per-day-dark.svg');
    expectWellFormed(svg);
    expect(svg).toContain('Measured, change between daily snapshots (20 days)');
    expect(segments(svg)).toBe(measured.reduce((n, d) => n + Object.values(d.groups).filter((v) => v > 0).length, 0));
  });

  it('shows the estimate for a single measured day', async () => {
    const dataset = await fixture();
    const svg = chart(renderCharts({ ...dataset, measuredDaily: [day(0, { app: 5, cli: 7 })] }), 'charts/downloads-per-day-light.svg');
    expect(svg).toContain('Estimated');
    expect(segments(svg)).toBe(0);
  });

  it('keeps the stars file small over a long series', async () => {
    const dataset = await fixture();
    const stars = Array.from({ length: 1500 }, (_, i) => ({ date: day(i, {}).date, stars: Math.floor(i / 5) }));
    const svg = chart(renderCharts({ ...dataset, stars }), 'charts/stars-light.svg');
    expectWellFormed(svg);
    expect(svg.length).toBeLessThan(40_000);
    expect(svg).toContain('>300<');
  });

  it('handles zero stars without an empty path', async () => {
    const dataset = { ...(await fixture()), stars: [], totals: { ...(await fixture()).totals, stars: 0 } };
    const svg = chart(renderCharts(dataset), 'charts/stars-light.svg');
    expectWellFormed(svg);
    expect(svg).toContain('No stars yet');
    expect(svg).not.toContain('<circle');
  });

  it('handles one release, no epochs and a group with zero downloads', async () => {
    const dataset = await fixture();
    const single: Dataset = {
      ...dataset,
      epochs: [],
      releases: [release('v1.0.0', { app: 0, cli: 42 })],
      groups: [...dataset.groups, { name: 'other', label: 'Other', color: 2 }],
    };
    const svg = chart(renderCharts(single), 'charts/downloads-per-release-dark.svg');
    expectWellFormed(svg);
    expect(segments(svg)).toBe(1);
    expect(svg).toContain('>42<');
    expect(svg).not.toContain('stroke-width="1"><title>');
  });

  it('says one release, not releases, in the note', async () => {
    const dataset = await fixture();
    const svg = chart(renderCharts({ ...dataset, epochs: [], releases: [release('v1.0.0', { app: 1, cli: 1 })] }), 'charts/downloads-per-release-light.svg');
    expect(svg).toContain('Downloads per release: 1 release, stacked by group.');
  });

  it('draws no columns when there are no releases', async () => {
    const dataset = { ...(await fixture()), releases: [], epochs: [] };
    const svg = chart(renderCharts(dataset), 'charts/downloads-per-release-light.svg');
    expectWellFormed(svg);
    expect(svg).toContain('No releases yet');
    expect(segments(svg)).toBe(0);
  });

  it('escapes group labels', async () => {
    const dataset = await fixture();
    const groups = [{ name: 'app', label: 'A & <B> "C"', color: 0 }, { name: 'cli', label: 'CLI', color: 1 }];
    const epochs = dataset.epochs.map((e, i) => (i === 1 ? { version: 'v1.11.0', label: 'Desktop & <beta> "x"' } : e));
    const svg = chart(renderCharts({ ...dataset, groups, epochs }), 'charts/downloads-per-release-light.svg');
    expectWellFormed(svg);
    expect(svg).toContain('A &amp; &lt;B&gt; &quot;C&quot;');
    expect(svg).toContain('v1.11.0 Desktop &amp; &lt;beta&gt; &quot;x&quot;');
    expect(svg).not.toContain('<B>');
    expect(svg).not.toContain('<beta>');
  });

  it('puts hover targets along the stars line at most every 4px', async () => {
    const svg = chart(renderCharts(await fixture()), 'charts/stars-light.svg');
    const strips = svg.match(/fill-opacity="0"><title>/g)?.length ?? 0;
    expect(strips).toBeGreaterThan(0);
    expect(strips).toBeLessThanOrEqual(Math.ceil(720 / 4) + 1);
  });

  it('drops points on a flat run of the estimate, keeping the outline', async () => {
    const dataset = await fixture();
    const flat: Dataset = {
      ...dataset,
      estimatedDaily: { start: '2020-01-01', groups: { app: Array(1000).fill(0), cli: Array(1000).fill(5) } },
    };
    const svg = chart(renderCharts(flat), 'charts/downloads-per-day-light.svg');
    const areas = [...svg.matchAll(/<path d="([^"]*)" fill="url\(#day-fade-\d+\)"\/>/g)];
    expect(areas).toHaveLength(1);
    expect(areas[0]?.[1]?.match(/[ML]/g)).toHaveLength(4);
  });
});

describe('niceTicks', () => {
  it('never goes finer than one download', () => {
    expect(niceTicks(1)).toEqual([0, 1]);
    expect(niceTicks(2)).toEqual([0, 1, 2]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('starts at zero and reaches the maximum in clean steps', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(5000)).toEqual([0, 2000, 4000, 6000]);
  });
});

describe('chart options', () => {
  const CHARTS = { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {} };
  const withCharts = async (charts: Partial<NonNullable<Dataset['charts']>>): Promise<Dataset> => ({ ...(await fixture()), charts: { ...CHARTS, ...charts } });
  /** The file without its accessible title and description, so only what is drawn is left. */
  const drawn = (svg: string): string => svg.replace(/<(title|desc) id="[^"]*">[^<]*<\/\1>/g, '');
  /** The topmost gridline, the top of the plot. */
  const plotTop = (svg: string): number =>
    Math.min(...[...svg.matchAll(/<line x1="[^"]*" x2="[^"]*" y1="([\d.]+)" y2="\1" stroke="[^"]*"\/>/g)].map((m) => Number(m[1])));

  it('shows each title and note by default', async () => {
    const files = renderCharts(await fixture());
    expect(chart(files, 'charts/stars-light.svg')).toContain('>Stars over time<');
    expect(chart(files, 'charts/stars-light.svg')).toContain('>Cumulative stargazers<');
    expect(chart(files, 'charts/downloads-per-release-light.svg')).toContain('>Downloads per release<');
  });

  it('hides every visible title and note when titles is false, keeping the accessible title', async () => {
    for (const { content, path } of renderCharts(await withCharts({ titles: false }))) {
      expect(content).toContain('<title id="title">');
      expect(content).toContain('<desc id="desc">');
      expect(content).toContain('aria-labelledby="title desc"');
      expect(drawn(content), path).not.toMatch(/>(Stars over time|Downloads per day|Downloads per release|Cumulative stargazers|One column)/);
      expect(drawn(content), path).not.toMatch(/font-size="16"/);
    }
  });

  it('keeps the estimated note and the stars spacing when titles are hidden', async () => {
    const files = renderCharts(await withCharts({ titles: false }));
    expect(drawn(chart(files, 'charts/downloads-per-day-light.svg'))).toContain('>Estimated per day<');
  });

  it('keeps the measured note when titles are hidden', async () => {
    const dataset = await withCharts({ titles: false });
    const days = Array.from({ length: 20 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 1) + i * 86_400_000).toISOString().slice(0, 10), days: 1, groups: { app: 1, cli: 2 }, stars: 1, docker: null, counters: {} }));
    const svg = chart(renderCharts({ ...dataset, measuredDaily: days }), 'charts/downloads-per-day-light.svg');
    expect(drawn(svg)).toContain('>Measured per day<');
  });

  it('moves the hint to its own line when three long group labels take the legend', async () => {
    const dataset = await withCharts({ titles: false });
    const groups = [
      { name: 'app', label: 'Desktop application installer builds', color: 0 },
      { name: 'cli', label: 'Command line interface tool builds', color: 1 },
      { name: 'other', label: 'Everything else that matched no group', color: 2 },
    ];
    const long = drawn(chart(renderCharts({ ...dataset, groups }), 'charts/downloads-per-day-light.svg'));
    expect(long).toMatch(/y="34\.0"[^>]*>Estimated per day</);
    const short = drawn(chart(renderCharts(dataset), 'charts/downloads-per-day-light.svg'));
    expect(short).toMatch(/y="20\.0"[^>]*>Estimated per day</);
  });

  it('leaves the stars chart without a note when titles are hidden', async () => {
    const svg = chart(renderCharts(await withCharts({ titles: false })), 'charts/stars-light.svg');
    expect(drawn(svg)).not.toContain('Cumulative stargazers');
  });

  it('lets a chart title override the global switch', async () => {
    const files = renderCharts(await withCharts({ titles: false, stars: { title: true }, 'downloads-per-day': { title: true } }));
    expect(drawn(chart(files, 'charts/stars-light.svg'))).toContain('>Stars over time<');
    expect(drawn(chart(files, 'charts/downloads-per-day-light.svg'))).toContain('>Estimated');
    expect(drawn(chart(files, 'charts/downloads-per-release-light.svg'))).not.toContain('>Downloads per release<');
  });

  it('moves the plot up when the title is hidden, leaving no empty band at the top', async () => {
    const shown = chart(renderCharts(await fixture()), 'charts/stars-light.svg');
    const hidden = chart(renderCharts(await withCharts({ titles: false })), 'charts/stars-light.svg');
    expect(plotTop(shown)).toBeGreaterThanOrEqual(79);
    expect(plotTop(hidden)).toBeLessThanOrEqual(44);
  });

  it('moves the labelled plot of the releases chart up too', async () => {
    const shown = chart(renderCharts(await fixture()), 'charts/downloads-per-release-light.svg');
    const hidden = chart(renderCharts(await withCharts({ titles: false })), 'charts/downloads-per-release-light.svg');
    expect(plotTop(shown)).toBeGreaterThanOrEqual(111);
    expect(plotTop(hidden)).toBeLessThanOrEqual(76);
    expect(hidden).toContain('>v1.11.0 First desktop app<');
  });

  it('keeps the legend on the top line without a title', async () => {
    const hidden = chart(renderCharts(await withCharts({ titles: false })), 'charts/downloads-per-release-light.svg');
    expect(hidden).toMatch(/<text x="[\d.]+" y="20\.0" fill="[^"]*" font-size="12">/);
  });

  it('draws the stars as about 30 samples: a dot each, titled, and the end dot', async () => {
    const dataset = await fixture();
    const svg = chart(renderCharts(dataset), 'charts/stars-light.svg');
    // the fixture's 346 days are more than the samples, so there are 30
    const samples = 30;
    expect(svg.match(/<circle [^>]*r="3"[^>]*><title>/g)).toHaveLength(samples - 1);
    expect(svg.match(/<circle [^>]*r="4"[^>]*><title>/g)).toHaveLength(1);
  });

  it('draws the stars in the configured colour of each mode, on the line, dots and area', async () => {
    const dataset = { ...(await fixture()), charts: { titles: true, stars: { color: { light: '#9a6700', dark: '#e3b341' } }, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {} } };
    const files = renderCharts(dataset);
    const light = chart(files, 'charts/stars-light.svg');
    const dark = chart(files, 'charts/stars-dark.svg');
    expect(light).toContain('stroke="#9a6700"');
    expect(light).toContain('stop-color="#9a6700"');
    expect(light).toContain('fill="#9a6700"');
    expect(light).not.toContain(seriesColor('light', 0));
    expect(dark).toContain('stroke="#e3b341"');
    expect(dark).toContain('stop-color="#e3b341"');
    expect(dark).not.toContain(seriesColor('dark', 0));
  });

  it('keeps the palette colour when no stars colour is set', async () => {
    const files = renderCharts(await fixture());
    expect(chart(files, 'charts/stars-light.svg')).toContain(`stroke="${seriesColor('light', 0)}"`);
    expect(chart(files, 'charts/stars-dark.svg')).toContain(`stroke="${seriesColor('dark', 0)}"`);
  });

  it('keeps anything but a hex colour out of the markup', async () => {
    const dataset = { ...(await fixture()), charts: { titles: true, stars: { color: { light: '"><script>', dark: '#e3b341' } }, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {} } } as Dataset;
    const svg = chart(renderCharts(dataset), 'charts/stars-light.svg');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain(`stroke="${seriesColor('light', 0)}"`);
  });

  it('keeps the whole curve on the plot when the count dips', async () => {
    const dataset = { ...(await fixture()), stars: [
      { date: '2024-01-01', stars: 1 },
      { date: '2024-01-02', stars: 50 },
      { date: '2024-01-03', stars: 60 },
      { date: '2024-01-04', stars: 10 },
    ] };
    const svg = chart(renderCharts(dataset), 'charts/stars-light.svg');
    const cys = [...svg.matchAll(/ cy="([\d.-]+)"/g)].map((m) => Number(m[1]));
    expect(cys.length).toBeGreaterThan(0);
    for (const cy of cys) {
      expect(cy).toBeGreaterThanOrEqual(80);
      expect(cy).toBeLessThanOrEqual(252);
    }
  });

  it('places each sample at its date on a linear time axis that starts at the first star', async () => {
    const dataset = { ...(await fixture()), stars: [
      { date: '2024-01-01', stars: 1 },
      { date: '2024-01-02', stars: 2 },
      { date: '2024-04-10', stars: 3 },
    ] };
    const svg = chart(renderCharts(dataset), 'charts/stars-light.svg');
    // 100 days from the first star to the last, 30 samples evenly spaced over the 716px plot: the second is day 3
    const dotX = [...svg.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="3"/g)].map((m) => Number(m[1]));
    expect(dotX).toHaveLength(29);
    expect(dotX[0]).toBe(60);
    expect(dotX[1]).toBeCloseTo(60 + (716 * 3) / 100, 1);
    expect(svg).toMatch(/<circle cx="776\.0" cy="[\d.]+" r="4"/);
  });

  it('keeps the x positions of the samples in order, the first and the last at the plot edges', async () => {
    const svg = chart(renderCharts(await fixture()), 'charts/stars-light.svg');
    const xs = [...svg.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="[34]"/g)].map((m) => Number(m[1]));
    expect(xs[0]).toBe(60);
    expect(xs.at(-1)).toBe(776);
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
  });

  it('draws a single star and a single day, all at the centre of the plot, without a NaN', async () => {
    for (const stars of [
      [{ date: '2024-01-01', stars: 1 }],
      [{ date: '2024-01-01', stars: 2 }],
    ]) {
      const dataset = { ...(await fixture()), stars };
      const svg = chart(renderCharts(dataset), 'charts/stars-light.svg');
      expect(svg).toMatch(/<circle cx="418\.0" cy="[\d.]+" r="4"/);
      expect(svg).not.toContain('NaN');
    }
  });

});

describe('motion', () => {
  const npm = () =>
    buildNpmData(
      Array.from({ length: 3 }, (_, i) => ({
        label: `pkg-${i}`,
        series: {
          schema: 1 as const,
          package: `pkg-${i}`,
          days: Array.from({ length: 60 }, (_, k) => ({ date: new Date(Date.UTC(2026, 6, 1) + k * 86_400_000).toISOString().slice(0, 10), downloads: ((k * (i + 2)) % 11) + 1 })),
        },
      })),
    )!;
  const measured = (dataset: Dataset): Dataset => ({ ...dataset, measuredDaily: Array.from({ length: 20 }, (_, i) => day(i, { app: i % 3, cli: 10 + i })) });
  /** The fixture with an npm series, and the same with measured days: together every chart and both downloads modes. */
  const sets = async (charts: Partial<NonNullable<Dataset['charts']>> = {}): Promise<ReturnType<typeof renderCharts>[]> => {
    const dataset = { ...(await fixture()), npm: npm(), charts: { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {}, ...charts } };
    return [renderCharts(dataset), renderCharts(measured(dataset))];
  };
  /** The file minus its motion: the style, the animation groups, the path length and the line breaks between marks. */
  const still = (svg: string): string =>
    svg.replace(/<style>.*?<\/style>/, '').replace(/<g class="gs-\w+"(?: style="[^"]*")?>/g, '').replace(/<\/g>/g, '').replace(/ pathLength="1"/g, '').replace(/\n/g, '');

  it('plays every chart once on load, with keyframes and a reduced-motion rule', async () => {
    for (const files of await sets()) {
      for (const { content, path } of files) {
        expect(content, path).toMatch(/<style>[^<]*@keyframes gs-\w+/);
        expect(content, path).toContain('@media (prefers-reduced-motion: reduce)');
        // the reduced-motion rule names only the chart's classes, and no animation group is left empty
        expect(content, path).not.toMatch(/\*\{animation/);
        expect(content, path).not.toMatch(/<g class="gs-\w+"[^>]*><\/g>/);
        expectWellFormed(content);
      }
    }
  });

  it('gives each chart its own effect, and the downloads chart one for each mode', async () => {
    const [estimated, measuredFiles] = await sets();
    expect(chart(estimated!, 'charts/stars-light.svg')).toContain('class="gs-draw"');
    expect(chart(estimated!, 'charts/downloads-per-day-light.svg')).toContain('class="gs-wipe"');
    expect(chart(measuredFiles!, 'charts/downloads-per-day-light.svg')).toContain('class="gs-rise"');
    expect(chart(estimated!, 'charts/downloads-per-release-light.svg')).toContain('class="gs-rise"');
    expect(chart(estimated!, 'charts/npm-downloads-light.svg')).toContain('class="gs-rise"');
  });

  it('pops each stars dot in as the line reaches it, and the end dot once the line is drawn', async () => {
    const [files] = await sets();
    const svg = chart(files!, 'charts/stars-light.svg');
    // each dot's group, with its delay if it has one, and its x
    const dots = [...svg.matchAll(/<g class="gs-pop"(?: style="animation-delay:(\d+)ms")?><circle cx="([\d.]+)"/g)].map((m) => ({ ms: m[1] === undefined ? 0 : Number(m[1]), x: Number(m[2]) }));
    expect(dots.length).toBeGreaterThan(1);
    // the first dot is reached at once, and later dots are reached later, further along the line
    expect(dots[0]!.ms).toBe(0);
    expect(svg).not.toContain('<g class="gs-pop" style="animation-delay:0ms">');
    for (let i = 1; i < dots.length; i++) {
      expect(dots[i]!.x).toBeGreaterThan(dots[i - 1]!.x);
      expect(dots[i]!.ms).toBeGreaterThanOrEqual(dots[i - 1]!.ms);
    }
    expect(dots.at(-1)!.ms).toBeLessThan(1600);
    expect(svg).toContain('<g class="gs-fade" style="animation-delay:1600ms"><circle');
  });

  it('adds no style, class, animation or path length when charts.animate is false', async () => {
    for (const files of await sets({ animate: false })) {
      for (const { content, path } of files) expect(content, path).not.toMatch(/<style|class="|animation|pathLength/);
    }
  });

  it('lets a chart switch its own motion off over the global setting', async () => {
    const [files] = await sets({ stars: { animate: false } });
    expect(chart(files!, 'charts/stars-light.svg')).not.toContain('<style');
    expect(chart(files!, 'charts/downloads-per-release-light.svg')).toContain('<style');
    const [mixed] = await sets({ animate: false, stars: { animate: true } });
    expect(chart(mixed!, 'charts/stars-light.svg')).toContain('class="gs-draw"');
    expect(chart(mixed!, 'charts/npm-downloads-light.svg')).not.toContain('<style');
  });

  /** The filled paths of a chart, one entry per segment and sorted: a chart may join or split its paths and draw the same shapes. */
  const shapes = (svg: string): string[] =>
    [...svg.matchAll(/<path d="([^"]*)" fill="([^"]*)"\/>/g)].flatMap((m) => m[1]!.split(/(?=M)/).map((segment) => `${m[2]} ${segment}`)).sort();

  /** The file minus its paths of bars and areas, so what is left around them (axes, labels, legend) is compared on its own. */
  const bare = (svg: string): string => still(svg).replace(/<path d="[^"]*" fill="[^"]*"\/>/g, '');

  it('only wraps the marks and adds the style, so the end state is the still chart', async () => {
    const [moving] = await sets();
    const [stillFiles] = await sets({ animate: false });
    for (const { content, path } of moving!) {
      if (path.includes('npm-downloads')) {
        // the npm weeks are one path per package when still, and one per bucket and package when moving: the same shapes, and the same chart around them
        expect(shapes(content), path).toEqual(shapes(chart(stillFiles!, path)));
        expect(bare(content), path).toBe(bare(chart(stillFiles!, path)));
      } else expect(still(content), path).toBe(still(chart(stillFiles!, path)));
    }
  });

  it('cuts a long run into 60 even buckets of adjacent items', () => {
    expect(buckets(60)).toHaveLength(60);
    expect(buckets(61)).toHaveLength(60);
    expect(buckets(61).flat()).toEqual(Array.from({ length: 61 }, (_, i) => i));
    expect(Math.max(...buckets(61).map((b) => b.length))).toBe(2);
    expect(buckets(1000)).toHaveLength(60);
    expect(buckets(0)).toEqual([]);
  });

  it('rises each measured bar on its own up to 60 days, and in at most 60 buckets past that', async () => {
    const dataset = await fixture();
    const rises = (count: number): number => {
      const measuredDaily = Array.from({ length: count }, (_, i) => day(i, { app: 1, cli: 2 }));
      return chart(renderCharts({ ...dataset, measuredDaily }), 'charts/downloads-per-day-light.svg').match(/class="gs-rise"/g)?.length ?? 0;
    };
    expect(rises(60)).toBe(60);
    expect(rises(61)).toBe(60);
    expect(rises(121)).toBe(60);
    expect(rises(1000)).toBe(60);
  });

  it('rises each release column on its own up to 60 releases, and in at most 60 buckets past that', async () => {
    const dataset = await fixture();
    const rises = (count: number): number => {
      const releases = Array.from({ length: count }, (_, i) => release(`v${i}.0.0`, { app: 1, cli: 2 }));
      return chart(renderCharts({ ...dataset, releases, epochs: [] }), 'charts/downloads-per-release-light.svg').match(/class="gs-rise"/g)?.length ?? 0;
    };
    expect(rises(60)).toBe(60);
    expect(rises(61)).toBe(60);
    expect(rises(1000)).toBe(60);
  });
});

describe('stars height', () => {
  const withStars = async (stars: { height?: number }, extra: Partial<NonNullable<Dataset['charts']>> = {}): Promise<Dataset> => ({
    ...(await fixture()),
    charts: { titles: true, stars, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {}, ...extra },
  });

  it('draws the stars chart at its height, with the plot bottom and the x labels moved down', async () => {
    const svg = chart(renderCharts(await withStars({ height: 400 })), 'charts/stars-light.svg');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="800" height="400" viewBox="0 0 800 400"/);
    expect(svg).toContain('<rect x="0.5" y="0.5" width="799" height="399"');
    // the plot ends 48 above the foot, so the curve's fade closes at 352, and the x labels sit 20 below that
    expect(svg).toMatch(/L[\d.]+ 352\.0Z/);
    expect(svg).toContain('y="372.0"');
    expectWellFormed(svg);
  });

  it('keeps the other charts at 300', async () => {
    const files = renderCharts(await withStars({ height: 400 }));
    expect(chart(files, 'charts/downloads-per-day-light.svg')).toMatch(/^<svg [^>]*height="300" viewBox="0 0 800 300"/);
  });

  it('gives the empty stars chart the same height', async () => {
    const data = await withStars({ height: 250 });
    const svg = chart(renderCharts({ ...data, stars: [], totals: { ...data.totals, stars: 0 } }), 'charts/stars-light.svg');
    expect(svg).toContain('No stars yet');
    expect(svg).toMatch(/^<svg [^>]*height="250" viewBox="0 0 800 250"/);
  });
});

describe('chart variants', () => {
  const CHARTS = { titles: true, stars: {}, 'downloads-per-day': {}, 'downloads-per-release': {}, 'npm-downloads': {} };
  const VARIANTS: ChartVariant[] = [
    { chart: 'stars', name: 'full', options: { title: false, height: 400 } },
    { chart: 'downloads-per-day', name: 'year', options: { range: '1y' } },
    { chart: 'downloads-per-release', name: 'recent', options: { last: 5 } },
    { chart: 'npm-downloads', name: 'year', options: { range: '1y' } },
  ];
  const withVariants = async (variants: ChartVariant[] = VARIANTS): Promise<Dataset> => ({ ...(await fixture()), charts: { ...CHARTS, variants } });
  const npm = () =>
    buildNpmData([
      {
        label: 'pkg-0',
        series: {
          schema: 1 as const,
          package: 'pkg-0',
          days: Array.from({ length: 60 }, (_, k) => ({ date: new Date(Date.UTC(2026, 6, 1) + k * 86_400_000).toISOString().slice(0, 10), downloads: (k % 7) + 1 })),
        },
      },
    ])!;

  it('writes a light and a dark file for each variant, right after its base chart', async () => {
    const paths = renderCharts(await withVariants()).map((f) => f.path);
    expect(paths.slice(0, 8)).toEqual([
      'charts/stars-light.svg',
      'charts/stars-dark.svg',
      'charts/stars-full-light.svg',
      'charts/stars-full-dark.svg',
      'charts/downloads-per-day-light.svg',
      'charts/downloads-per-day-dark.svg',
      'charts/downloads-per-day-year-light.svg',
      'charts/downloads-per-day-year-dark.svg',
    ]);
    expect(paths).toContain('charts/downloads-per-release-recent-dark.svg');
    expect(paths).not.toContain('charts/npm-downloads-year-light.svg');
  });

  it('draws a variant with its own options and leaves its base as it was', async () => {
    const plain = renderCharts(await fixture());
    const files = renderCharts(await withVariants());
    const full = chart(files, 'charts/stars-full-light.svg');
    expect(full).toMatch(/^<svg [^>]*height="400" viewBox="0 0 800 400"/);
    // the accessible title stays in the file; only the visible one goes
    expect(full.replace(/<(title|desc) id="[^"]*">[^<]*<\/\1>/g, '')).not.toContain('>Stars over time<');
    expect(chart(files, 'charts/stars-light.svg')).toBe(chart(plain, 'charts/stars-light.svg'));
    expect(chart(files, 'charts/stars-light.svg')).toContain('>Stars over time<');
  });

  it('draws a variant of a download chart from its own window', async () => {
    const files = renderCharts(await withVariants());
    expect(chart(files, 'charts/downloads-per-day-year-light.svg')).not.toBe(chart(files, 'charts/downloads-per-day-light.svg'));
    expect(chart(files, 'charts/downloads-per-release-recent-light.svg')).not.toBe(chart(files, 'charts/downloads-per-release-light.svg'));
  });

  it('follows the base chart availability: download variants need release downloads, npm variants need npm', async () => {
    const noDownloads = renderCharts({ ...(await withVariants()), releaseDownloads: false });
    expect(noDownloads.map((f) => f.path).some((path) => path.includes('downloads-per-'))).toBe(false);
    expect(noDownloads.map((f) => f.path)).toContain('charts/stars-full-light.svg');

    const withNpm = renderCharts({ ...(await withVariants()), npm: npm() });
    expect(withNpm.map((f) => f.path)).toContain('charts/npm-downloads-year-dark.svg');
    expect(renderCharts(await withVariants()).map((f) => f.path)).not.toContain('charts/npm-downloads-year-dark.svg');
  });
});
