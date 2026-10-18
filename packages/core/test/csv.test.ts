import { describe, expect, it } from 'vitest';
import { buildDailyCsv } from '../src/csv';
import type { DaySummary } from '../src/summary';

const day = (date: string, app: number, cli: number, docker: number | null, stars: number): DaySummary => ({
  date,
  groups: { app, cli },
  total: app + cli,
  docker,
  stars,
  forks: 1,
  counters: {},
});

describe('buildDailyCsv', () => {
  it('writes the totals per group and the change since the previous row', () => {
    const csv = buildDailyCsv(
      [day('2026-10-16', 236, 11732, 33711, 269), day('2026-10-17', 300, 11773, null, 269), day('2026-10-18', 358, 11814, 37673, 271)],
      ['app', 'cli'],
    );
    expect(csv.split('\n')[0]).toBe(
      'date,app_downloads,cli_downloads,total_downloads,docker_pulls,stars,forks,app_delta,cli_delta,total_delta,docker_delta,stars_delta',
    );
    expect(csv.split('\n')[1]).toBe('2026-10-16,236,11732,11968,33711,269,1,,,,,');
    // Docker is missing on the 17th, so its delta is blank on both sides of it.
    expect(csv.split('\n')[2]).toBe('2026-10-17,300,11773,12073,,269,1,64,41,105,,0');
    expect(csv.split('\n')[3]).toBe('2026-10-18,358,11814,12172,37673,271,1,58,41,99,,2');
  });
});
