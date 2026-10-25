# Cloudflare Analytics Engine source: implementation plan

> **For agentic workers:** each task is self-contained; read the spec first. Steps use checkbox (`- [ ]`) syntax.

**Goal:** an optional `cloudflare:` source that stores daily Analytics Engine aggregates on the data branch and shows them as a chart, badges, a dashboard section and an updates-per-user note.

**Architecture:** mirrors the npm source end to end: `core` collector + store + `Dataset.cloudflare`, then `svg`, `badges` and `dashboard` read only the Dataset.

**Tech Stack:** TypeScript, pnpm monorepo, vitest, up-fetch (`createClient` in `packages/core/src/collectors/client.ts`).

**Spec:** `docs/superpowers/specs/2026-10-26-cloudflare-analytics-design.md`

## Global Constraints

- No `cloudflare` config → no requests, no files, no Dataset field, outputs byte-identical to today.
- Only complete UTC days are stored; backfill floor 90 days; refetch overlap 3 days; query chunks of 7 days.
- SQL API: `POST https://api.cloudflare.com/client/v4/accounts/{account-id}/analytics_engine/sql`, SQL as the body, ends in `FORMAT JSON`; numbers arrive as strings.
- Failures (request, missing token) warn and keep stored days. Config errors throw `ConfigError`.
- No IPs, hashes or per-install data stored or shown; every users figure is labelled approximate.
- Match the surrounding code: comment density, naming, the npm files as the model. Run `pnpm test` and `pnpm typecheck` (see root `package.json`) before committing.

## Shared types (`packages/core/src/types.ts`, added by Task 1)

```ts
/** One value's figures on one day. */
export interface CloudflareCount { users: number; events: number }

/** One UTC day of an Analytics Engine dataset; `by` holds each dimension's values. */
export interface CloudflareDay extends CloudflareCount {
  date: string;
  by: Record<string, Record<string, CloudflareCount>>;
}

/** A dataset's days as stored on the data branch (`cloudflare/<dataset>.json`). */
export interface CloudflareSeries { schema: 1; dataset: string; days: CloudflareDay[] }

export interface CloudflareDimensionInfo { name: string; label: string; kind?: 'semver' }

export interface CloudflareShare { value: string; users: number; events: number }

/** The Cloudflare figures of one repo; absent without config or stored days. */
export interface CloudflareData {
  label: string;
  note?: string;
  /** `{ dimension, value }` the headline users count; absent counts every row. */
  primary?: { dimension: string; value: string };
  latest: string;
  first: string;
  dimensions: CloudflareDimensionInfo[];
  /** Stored days with `headline` added: primary users when set, else users. */
  days: (CloudflareDay & { headline: number })[];
  totals: {
    usersLatest: number;
    /** Mean headline over the last 7 stored days (fewer when fewer exist), rounded. */
    usersAvg7: number;
    eventsLast30: number;
    /** Events outside `primary` over the last 7 days; 0 without primary. */
    otherEvents7: number;
  };
  /** Last 30 days per dimension; top 8 then `other`; semver dimensions newest first, others by events desc. */
  shares: Record<string, CloudflareShare[]>;
}
```

`Dataset` gains `cloudflare?: CloudflareData`. `CounterInfo` gains `perUser?: number` (Task 2).

Config (`packages/core/src/config.ts`, Task 1):

```ts
export interface CloudflareDimensionRule { name: string; label: string; column: string; kind?: 'semver'; released?: boolean }
export interface CloudflareRule {
  accountId: string; dataset: string; label: string;
  users: 'index1';
  /** blobN holding the UTC day; absent means the day of `timestamp`. */
  day?: string;
  primary?: { dimension: string; value: string };
  note?: string;
  dimensions: CloudflareDimensionRule[];
}
// StatsConfig: cloudflare?: CloudflareRule;  CounterRule: perUser?: boolean
```

---

### Task 1: config, collector, store and run wiring (core + action)

**Files:**
- Modify: `packages/core/src/config.ts`, `packages/core/src/types.ts`, `packages/core/src/store.ts`, `packages/core/src/index.ts`
- Create: `packages/core/src/collectors/cloudflare.ts`
- Modify: `packages/action/src/run.ts`, `packages/action/src/main.ts`, `packages/action/src/cli.ts`, `action.yml`
- Test: `packages/core/test/config.test.ts`, `packages/core/test/cloudflare.test.ts` (new), `packages/core/test/store.test.ts`, `packages/action/test/` (the run test that covers npm)

**Produces:** the types above; `CloudflareRule`; `readCloudflareSeries(dir, dataset)`, `writeCloudflareSeries(dir, series)`; `fetchCloudflareSeries(api, rule, releases, stored, today, log)`; `cloudflareClient(fetchFn, token)`; `RunOptions.cloudflareToken?: string`.

- [ ] **Config.** Parse `cloudflare` with keys `account-id, dataset, label, users, day, primary, note, dimensions`. Rules: `account-id` matches `/^[0-9a-f]{32}$/`; `dataset` matches `/^[A-Za-z0-9_]+$/`; `label` defaults to the dataset; `users` must be `index1` (default `index1`); `day` and each `column` match `/^blob([1-9]|1[0-9]|20)$/` and are all different; dimension names match `VARIANT_NAME_RE`; dimension keys `column, label, kind, released`; `kind` only `semver`; `released` boolean, only with `kind: semver`, at most one dimension; `primary` is a one-key mapping whose key is a dimension and whose value is a non-empty string. Counters accept `per-user` (boolean, stored as `perUser`), and `per-user: true` without `cloudflare` throws `counters[i].per-user needs a cloudflare source`. Tests: a full valid block parses to the `CloudflareRule` shape; each rule above rejects with a message naming the path.
- [ ] **Range and SQL** in `collectors/cloudflare.ts` (pure, exported, tested):
  ```ts
  const WINDOW_DAYS = 90; const OVERLAP_DAYS = 3; const CHUNK_DAYS = 7;
  /** Days to fetch: [start, end) with end = today, never before today - 90. */
  export function cloudflareRange(stored: readonly CloudflareDay[], today: string): { start: string; end: string }
  /** [start, end) split into CHUNK_DAYS pieces. */
  export function chunks(start: string, end: string): { start: string; end: string }[]
  /** The release filter, or '' without a `released` dimension. */
  export function releasedFilter(rule: CloudflareRule, releases: readonly SnapshotRelease[]): string
  /** One query: totals when `column` is undefined, else grouped by it too; `filter` is releasedFilter's output. */
  export function cloudflareSql(rule: CloudflareRule, range: { start: string; end: string }, filter: string, column?: string): string
  ```
  `dayExpr` is `rule.day ?? "formatDateTime(timestamp, '%Y-%m-%d')"`. With `rule.day`, the WHERE spans one day more on each side; rows outside `[start, end)` are dropped after parsing. SQL shape:
  `SELECT ${dayExpr} AS day[, ${column} AS value], count(DISTINCT ${rule.users}) AS users, sum(_sample_interval) AS events FROM ${rule.dataset} WHERE timestamp >= toDateTime('${from} 00:00:00') AND timestamp < toDateTime('${to} 00:00:00') ${filter} GROUP BY day[, value] ORDER BY day FORMAT JSON`.
  `releasedFilter`: skip drafts (already absent) and prereleases; version = tag without a leading `v`, kept only if it matches `/^\d+\.\d+\.\d+$/`; each term `(${col} = '${version}' AND timestamp >= toDateTime('${publishedAt as 'YYYY-MM-DD HH:MM:SS'}'))` joined with ` OR `, wrapped as ` AND (...)`; no terms → ` AND 0`. Tests: v-prefix stripped, prerelease and non-semver tags skipped, no releases → ` AND 0`, no released dimension → ''.
  Tests: empty store → start = today-90; stored last 2026-10-20, today 2026-10-26 → start 2026-10-17; old store → clamped to floor; chunks of 10 days → 7+3; SQL snapshots for totals and a dimension, with and without `day`.
- [ ] **Fetch and merge.** `fetchCloudflareSeries(api, rule, releases, stored, today, log)` computes `releasedFilter` once and runs, per chunk, the totals query and one per dimension (`api(path, { method: 'POST', body: sql })`, response `{ data: Record<string,string>[] }`), parses numbers with `Number`, drops rows with day ≥ today or outside the chunk, builds `CloudflareDay`s (a day with no totals row is absent; `by` always has each dimension key), and merges into the stored days by date (fetched replace stored), sorted. Any thrown error → `log.warning(\`cloudflare: ${rule.dataset} not collected (${message})\`)` and return `stored`. Log `cloudflare: <dataset> <n> days fetched, <m> stored` on success. `cloudflareClient(fetchFn, token)` = `createClient({ fetch, baseUrl: 'https://api.cloudflare.com/client/v4', headers: { Authorization: \`Bearer ${token}\` } })`. Tests with a fake fetch keyed on the SQL body: string numbers parsed, today dropped, refetch replaces overlap, HTTP 400 → warning + stored unchanged.
- [ ] **Store.** `readCloudflareSeries` / `writeCloudflareSeries` on `cloudflare/<dataset>.json`, one day per line exactly like `writeNpmSeries`; unknown schema throws `cloudflare/<dataset>.json: unsupported schema`. Round-trip test.
- [ ] **Run wiring.** `run.ts`: when `config.cloudflare` is set, without `options.cloudflareToken` warn `cloudflare: no token (cloudflare-token input or CLOUDFLARE_API_TOKEN), keeping the stored days`; else fetch before writing anything (after `fetchReleases`, passing its result) and write the series after the snapshot. `main.ts`: `cloudflareToken: core.getInput('cloudflare-token') || undefined`; `action.yml`: input `cloudflare-token` ("Cloudflare API token with Account Analytics: Read, for the cloudflare source."). `cli.ts`: `cloudflareToken: process.env.CLOUDFLARE_API_TOKEN`, and mention it in USAGE. Test: the run test with a fake fetch writes `cloudflare/<dataset>.json`; without the config no Cloudflare request happens.
- [ ] Run `pnpm test` and `pnpm typecheck`; commit `feat(cloudflare): collect analytics engine days onto the data branch`.

### Task 2: Dataset, daily.csv and per-user counters (core)

**Files:** Create `packages/core/src/cloudflare.ts`; modify `dataset.ts`, `derive.ts`, `csv.ts`, `types.ts`, `index.ts`. Tests: `packages/core/test/cloudflare-data.test.ts` (new), `csv.test.ts`, `dataset.test.ts`.

**Consumes:** Task 1 types, `readCloudflareSeries`. **Produces:** `buildCloudflareData(rule, series): CloudflareData | undefined`, `counterPerUser(measured: MeasuredDay[], counter: string, cf: CloudflareData): number | undefined`, `Dataset.cloudflare`, `CounterInfo.perUser`.

- [ ] `buildCloudflareData`: undefined when no days. `headline` = `by[primary.dimension][primary.value]?.users ?? 0` with primary, else `users`. Totals and shares as in the shared types (windows are the last N stored dates counted back from `latest` by calendar day, like `npmTotals`; `other` sums the values past the top 8; semver order via `compareVersions(parseVersion(...))`, unparsable last). `dimensions` from the rule in order. Tests: primary vs no primary, 3 days → avg over 3, folding into `other`, semver order.
- [ ] `counterPerUser`: over the 30 days ending `cf.latest`, sum `measured[].counters[name]` whose `date` is in the window; mean headline over stored Cloudflare days in the window; undefined when fewer than 14 Cloudflare days or no measured day in the window or mean is 0; else rounded to 2 decimals. Set on each `CounterInfo` whose rule has `perUser`. Tests for each undefined case and one value.
- [ ] `derive.ts` reads the series when `config.cloudflare` is set and passes it to `buildDataset` (new `cloudflare?: CloudflareSeries` input). `csv.ts`: options gain `cloudflare?: CloudflareData`; when present add `cf_users` (headline) and `cf_events` columns, dates unioned like npm; no columns otherwise. Tests: csv with and without; dataset without config has no `cloudflare` key (`'cloudflare' in dataset === false`).
- [ ] `pnpm test`, `pnpm typecheck`; commit `feat(cloudflare): derive daily users, shares and updates per user`.

### Task 3: chart and badges (svg + badges) — parallel with Task 4

**Files:** Create `packages/svg/src/cloudflare.ts`; modify `packages/svg/src/index.ts`, `packages/core/src/config.ts` (add `'cloudflare-users'` to `CHART_NAMES`, `ChartsConfig` and `DEFAULT_CONFIG.charts`), `packages/badges/src/badges.ts`. Tests: `packages/svg/test/`, `packages/badges/test/`.

**Consumes:** `Dataset.cloudflare` (shared types). Use a fixture dataset built in the test.

- [ ] `cloudflareUsersChart(dataset, theme)`: model on `packages/svg/src/npm.ts` (window via `charts['cloudflare-users']` `from`/`range`, title, animate, empty state). Main line = `headline` per day, labelled "Daily users (approx.)"; second faint line = events, labelled with `label`. Register in `renderCharts` only when `dataset.cloudflare` is set. Snapshot tests for light/dark, a window, the empty state; config tests that `charts.cloudflare-users` accepts the window keys and rejects `last`/`height`.
- [ ] Badges, after the npm ones, only with `dataset.cloudflare`: `users-daily` (label `daily users`, message `formatCompact(usersAvg7)`) and `users-daily-latest` (label `daily users`, message `${formatCompact(usersLatest)} yesterday`... use the latest day's date only if npm badges do similar; else plain number). Add a `COLORS.users` entry next to `COLORS.npm`; `colourOf(name, COLORS.users)` honours `badges:`. Tests mirroring the npm badge tests.
- [ ] `pnpm test`, `pnpm typecheck`; commit `feat(cloudflare): daily users chart and badges`.

### Task 4: dashboard section, KPI note and docs — parallel with Task 3

**Files:** Create `packages/dashboard/src/sections/usage.ts`; modify `packages/dashboard/src/app.ts`, `packages/dashboard/src/sections/kpis.ts`, `README.md`. Tests: `packages/dashboard/test/`.

**Consumes:** `Dataset.cloudflare`, `CounterInfo.perUser`.

- [ ] `usage(d)` section, placed right after `npm(d)` in `app.ts`, empty string without `d.cloudflare`: heading "Usage"; a tile *Daily users* = `usersAvg7`, caption "7-day average, approx.", subtext `plus N <label lowercased>` from `otherEvents7` when `primary` is set; a daily chart of `headline` (reuse the npm section's chart approach / `daily-chart.ts`); one table per dimension (value, users, events, share of events %); `note` as a paragraph under the section. All text escaped with the existing `esc`. Update the intro/source sentences in `app.ts` (lines ~67–100) to mention the Cloudflare dataset when present.
- [ ] `kpis.ts`: when a counter has `perUser`, append "≈ X per daily user, last 30 days" to its note (keep the existing "Counted from" text).
- [ ] README: a "Cloudflare Analytics Engine" section after npm: config block from the spec, the `cloudflare-token` input / `CLOUDFLARE_API_TOKEN`, what's stored, the 90-day backfill, the chart and badge names, `per-user`, and the caveats (approximate users, only complete days).
- [ ] Tests: section absent without data; tile, tables, note and escaping with a fixture; KPI note with and without `perUser`. `pnpm test`, `pnpm typecheck`, `pnpm build` (dashboard embeds); commit `feat(cloudflare): usage section and updates per user on the dashboard`.

### Final: integration

- [ ] Merge Tasks 3 and 4 into `feat/cloudflare-analytics`; `pnpm test && pnpm typecheck && pnpm build`; rebuild committed `dist/` if CI checks it.
- [ ] Manual: real `collect` for manga-downloader into a copy of `stats-data` with `CLOUDFLARE_API_TOKEN` and the spec's config; open the dashboard. No commit to stats-data.
