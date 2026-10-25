# Cloudflare Analytics Engine source: design

An optional source that keeps daily aggregates of a Cloudflare Workers Analytics Engine (AE) dataset on the data branch, and shows them next to the GitHub stats. AE keeps data for about 3 months, so the stored days are the long-term history.

First user: manga-downloader. Its Worker writes one data point per update check to `manga_downloader_checks` (from v23.0.0 on): `index1` daily salted IP hash, `blob1` client (`gui|cli`), `blob2` running version, `blob3` os, `blob4` arch, `blob5` UTC day, `double1` 1. Downloads and in-app updates stay GitHub asset counts; the Worker records no update events (an explicit one may come later, not designed for here).

## Config

```yaml
cloudflare:
  account-id: dd4d00309618abe546348e4b9cc7a893
  dataset: manga_downloader_checks
  label: Update checks          # what an event is called in charts and tables
  users: index1                 # daily user hash; users = count(DISTINCT users)
  day: blob5                    # optional; default: the UTC day of `timestamp`
  primary: { client: gui }      # optional; the headline users only count these rows
  note: The CLI only checks on --version; users are approximate daily counts.
  dimensions:
    client:  { column: blob1, label: App vs CLI }
    version: { column: blob2, label: Version, kind: semver, released: true }
    os:      { column: blob3, label: OS }
    arch:    { column: blob4, label: Arch }
counters:
  - { name: updates, label: In-app updates, assets: "…-SHA256SUMS.txt", from: v1.19.0, per-user: true }
```

- No `cloudflare` block: nothing changes, no requests.
- Validation: `account-id` 32 hex; `dataset` matches `^[A-Za-z0-9_]+$`; `users` is `index1`; `day` and each dimension `column` are `blob1`..`blob20`, all different; dimension names are kebab-case; `kind` is `semver` or absent; at most one `primary` key, which must be a dimension; `released` only on a `kind: semver` dimension, at most one. `per-user` on a counter requires `cloudflare`.
- Token: action input `cloudflare-token` (pass a secret; needs *Account Analytics: Read*); the CLI reads `CLOUDFLARE_API_TOKEN`. A config without a token logs a warning and keeps the stored days.

## Collecting

`core/src/collectors/cloudflare.ts`, shaped like the npm collector:

- Complete UTC days only: today is never stored.
- Range: nothing stored → the last 90 days; else from 3 days before the last stored day (late points), never before the 90-day floor.
- `POST https://api.cloudflare.com/client/v4/accounts/{id}/analytics_engine/sql`, SQL as the body, `FORMAT JSON` (the only format accepted). Numbers come back as strings and are parsed.
- Per 7-day chunk: one totals query and one per dimension, each grouped by day:
  `SELECT <day> AS day[, <col> AS value], count(DISTINCT index1) AS users, sum(_sample_interval) AS events FROM <dataset> WHERE timestamp >= toDateTime('<start>') AND timestamp < toDateTime('<end>') GROUP BY day[, value] FORMAT JSON`
  With `day: blobN`, the WHERE also widens by a day each side and rows are filtered on the day string, so a point written near midnight still lands on its blob day.
- `released: true`: a row counts only when its version is a published, non-draft, non-prerelease GitHub release (tag without a leading `v`) and its `timestamp` is at or after that release's `published_at`. Every query (totals included) gets `AND ((<col> = '23.0.0' AND timestamp >= toDateTime('2026-10-20 12:00:00')) OR …)`, built from the releases the run already fetches; tags that aren't plain semver are skipped, and no matching release means `AND false`. This drops test builds of unreleased versions, which AE can't delete.
- A failed request logs a warning and keeps the stored days unchanged (all fetched before anything is written).
- Identifiers are interpolated from validated config only; day strings come from our own range.

## Storage

`<owner>/<repo>/cloudflare/<dataset>.json`, one day per line, like `npm/<slug>.json`:

```json
{
"schema": 1,
"dataset": "manga_downloader_checks",
"days": [
  {"date":"2026-10-25","users":2,"events":2,"by":{"client":{"gui":{"users":2,"events":2}},"version":{"23.0.0":{"users":2,"events":2}},"os":{…},"arch":{…}}}
]
}
```

Only daily aggregates: no hashes, IPs or per-install data leave AE. Refetched days replace stored ones.

## Dataset

`Dataset.cloudflare?: CloudflareData`, absent without config or stored days:

- `label`, `note`, `latest`, `first`, `days` (as stored), `dimensions` (name, label, kind).
- `headline(day)`: users of the `primary` value when set (`by.client.gui.users`), else `users`.
- `totals`: `usersLatest` (headline, latest day), `usersAvg7` (mean headline over the last 7 stored days), `eventsLast30`, `otherEvents7` (events outside `primary` over 7 days, for "plus N CLI checks").
- `shares[dimension]`: each value's users and events summed over the last 30 days, ordered by events (semver dimensions: by version, newest first), small values beyond 8 folded into `other`.

`daily.csv` gains `cf_users` (headline) and `cf_events` when configured; dates union with the other columns.

Counters with `per-user`: `CounterInfo.perUser` = counter increase over the last 30 days (from snapshots) / mean headline users over the same days; set only with ≥ 14 stored Cloudflare days in that window and a snapshot at or before its start.

## Outputs

- **Chart `cloudflare-users`** (`packages/svg`): headline users per day as a line, events as a faint second series; `title`, `animate`, `from`, `range` and variants like the other charts. Empty state when the window has no days.
- **Badges**: `users-daily` (label "daily users", `usersAvg7`) and `users-daily-latest` (`usersLatest`); colours from `badges:`.
- **Dashboard** "Usage" section, after npm: a *Daily users* tile (`usersAvg7`, "7-day average", subtext "plus N <other> checks" when `primary` is set), the chart, one share table per dimension (last 30 days), and `note` under the section. Every users figure is labelled approximate.
- **KPIs**: a counter with `perUser` gets the note "≈ X per daily user, last 30 days" under its existing note.

## Error handling

Collector failures and missing tokens warn and keep the stored days, like npm and Docker. Config errors fail the run with `config: …`. An unknown stored schema fails, like the other stores.

## Testing

- Unit: range/backfill, SQL builder, response parsing (string numbers, empty data), merge/refetch, config validation, `buildCloudflareData`, `perUser`.
- Render: chart and badge snapshots, dashboard section from a fixture dataset.
- Manual: a real `collect` for manga-downloader into a temp copy of `stats-data`, no commit.

## Out of scope

Split charts per dimension and version-adoption charts (the stored `by` data allows them later); update events; several AE datasets per repo.
