import { describe, expect, it } from 'vitest';
import { buildDailyCsv } from '../src/csv';
import type { DaySummary } from '../src/summary';
import type { NpmPackageStats } from '../src/types';

const day = (date: string, app: number, cli: number, docker: number | null, stars: number): DaySummary => ({
  date,
  groups: { app, cli },
  total: app + cli,
  docker,
  stars,
  forks: 1,
  counters: {},
});

const repoDay = (date: string, stars: number, forks: number): DaySummary => ({
  date,
  groups: {},
  total: 0,
  docker: null,
  stars,
  forks,
  counters: {},
});

const pkg = (name: string, slug: string, days: [string, number][]): NpmPackageStats => ({
  package: name,
  label: name,
  color: 0,
  slug,
  first: days[0]![0],
  totals: { lastDay: 0, last7: 0, last30: 0, all: 0 },
  days: days.map(([date, downloads]) => ({ date, downloads })),
});

const releasesAndDocker = [
  day('2026-10-16', 236, 11732, 33711, 269),
  day('2026-10-17', 300, 11773, null, 269),
  day('2026-10-18', 358, 11814, 37673, 271),
];

describe('buildDailyCsv', () => {
  it('writes the totals per group and the change since the previous row', () => {
    const csv = buildDailyCsv(releasesAndDocker, ['app', 'cli'], { downloads: true, docker: true, npm: [] });
    expect(csv.split('\n')[0]).toBe(
      'date,app_downloads,cli_downloads,total_downloads,docker_pulls,stars,forks,app_delta,cli_delta,total_delta,docker_delta,stars_delta',
    );
    expect(csv.split('\n')[1]).toBe('2026-10-16,236,11732,11968,33711,269,1,,,,,');
    // Docker is missing on the 17th, so its delta is blank on both sides of it.
    expect(csv.split('\n')[2]).toBe('2026-10-17,300,11773,12073,,269,1,64,41,105,,0');
    expect(csv.split('\n')[3]).toBe('2026-10-18,358,11814,12172,37673,271,1,58,41,99,,2');
  });

  it('leaves out the docker columns when no image is configured', () => {
    const csv = buildDailyCsv(releasesAndDocker, ['app', 'cli'], { downloads: true, docker: false, npm: [] });
    expect(csv.split('\n')[0]).toBe('date,app_downloads,cli_downloads,total_downloads,stars,forks,app_delta,cli_delta,total_delta,stars_delta');
    expect(csv.split('\n')[3]).toBe('2026-10-18,358,11814,12172,271,1,58,41,99,2');
  });

  it('writes npm columns and npm-only rows with blank snapshot cells', () => {
    const npm = [
      pkg('password-strength-meter', 'password-strength-meter', [
        ['2026-10-16', 5],
        ['2026-10-17', 7],
        ['2026-10-18', 9],
        ['2026-10-19', 4],
      ]),
      pkg('@passcore/core', 'passcore--core', [
        ['2026-10-17', 3],
        ['2026-10-19', 6],
      ]),
    ];
    const csv = buildDailyCsv([repoDay('2026-10-17', 10, 2), repoDay('2026-10-18', 12, 2)], [], {
      downloads: false,
      docker: false,
      npm,
    });
    expect(csv.split('\n')).toEqual([
      'date,stars,forks,stars_delta,npm_password-strength-meter,npm_passcore--core,npm_total',
      '2026-10-16,,,,5,,5',
      '2026-10-17,10,2,,7,3,10',
      '2026-10-18,12,2,2,9,,9',
      '2026-10-19,,,,4,6,10',
      '',
    ]);
  });

  it('leaves a package cell blank on a snapshot day it has no count for', () => {
    const npm = [pkg('a', 'a', [['2026-10-17', 1], ['2026-10-18', 2]]), pkg('b', 'b', [['2026-10-17', 3]])];
    const csv = buildDailyCsv([repoDay('2026-10-17', 1, 0), repoDay('2026-10-18', 2, 0)], [], {
      downloads: false,
      docker: false,
      npm,
    });
    expect(csv.split('\n')[2]).toBe('2026-10-18,2,0,1,2,,2');
  });
});
