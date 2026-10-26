import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@github-stats-action/core';
import { starsSamples } from '@github-stats-action/core/stars';
import { dayAxis } from '../src/days';
import { sampledPoints } from '../src/sampled';

const fixture = JSON.parse(readFileSync(new URL('../../../fixtures/dataset.json', import.meta.url), 'utf8')) as Dataset;
const withStars = (stars: NonNullable<Dataset['charts']>['stars']): Dataset => ({ ...fixture, charts: { ...fixture.charts!, stars } });

describe('sampledPoints', () => {
  it('draws the README chart samples in a from window, the first at zero with start-at-zero', () => {
    const d = withStars({ from: '2026-01-01', startAtZero: true });
    const axis = dayAxis(d.stars[0]!.date);
    const got = sampledPoints(d, axis);
    const helper = starsSamples(d);
    expect(got.values).toEqual(helper.plotted);
    expect(got.samples).toEqual(helper.samples);
    expect(got.startsAtZero).toBe(true);
    expect(got.values[0]).toBe(0);
    expect(got.samples[0]!.date >= '2026-01-01').toBe(true);
    expect(got.samples.length).toBeLessThanOrEqual(30);
    expect(got.xs).toEqual(got.samples.map((p) => axis.indexOf(Date.parse(`${p.date}T00:00:00Z`))));
  });

  it('keeps the real counts when the window does not cut off history', () => {
    const d = withStars({ startAtZero: true });
    const got = sampledPoints(d, dayAxis(d.stars[0]!.date));
    expect(got.startsAtZero).toBe(false);
    expect(got.values).toEqual(got.samples.map((p) => p.stars));
  });
});
