# github-stats-action: design

A GitHub Action that keeps the history GitHub throws away (release downloads, stars, traffic, Docker Hub pulls) on a data branch, and turns it into an HTML dashboard, SVG charts and badges. It grew out of manga-downloader's `tools/stats-snapshot` workflow and its local `download-stats` dashboard.

## Goals

- Daily raw snapshots on an orphan data branch, as the source of truth. Everything else is derived from them on every run.
- An HTML dashboard: published on GitHub Pages (optional) and committed self-contained to the data branch.
- SVG charts for READMEs and badges.
- Privacy: anything not already public (traffic) is opt-in to collect, and opt-in again to publish on Pages.
- One repo per run now; the data layout is ready for several repos later.

Non-goals for v1: other registries (npm, Homebrew…), dashboard translations, several repos per run.

## Architecture

JavaScript action (`runs: using: node24`, `main: dist/index.js`), pnpm monorepo, TypeScript:

```
packages/
  core/       config, collectors, snapshot storage, the derived Dataset
  dashboard/  vite app: static build for Pages, plus a self-contained build with data inlined
  svg/        SVG charts
  badges/     shields.io endpoint JSON + standalone SVG badges
  action/     entry point: inputs, run core and outputs, commit to the data branch, Pages dir
```

- `core` owns the data formats. `dashboard`, `svg` and `badges` only read the `Dataset` (below) and never call APIs, so they can be built and tested in parallel from fixtures.
- Build: tsdown bundles `action` (with everything it imports) into `dist/index.js`; vite builds `dashboard` into `dist/dashboard/`. `dist/` is committed, as JS actions require; CI fails if it's stale.
- HTTP through up-fetch; `@actions/core` for inputs and logs. Tests with vitest. Node 24.

## Configuration

Workflow inputs (simple values):

| Input | Default | Meaning |
|---|---|---|
| `token` | `${{ github.token }}` | API token. Traffic needs a token with push access to the repo (a PAT); `GITHUB_TOKEN` gets 403 there. |
| `config` | `.github/stats.yml` | Path to the config file (optional file). |
| `data-branch` | `stats-data` | Orphan branch for data, created on first run. |
| `traffic` | `false` | Collect traffic (views, clones, referrers, paths). |
| `pages` | `false` | Write the static site to `pages-dir` for the Pages actions. |
| `pages-dir` | `_site` | Where the Pages build goes. |
| `pages-traffic` | `false` | Include traffic in the Pages site (it's always in the branch's copy when collected). |
| `dry-run` | `false` | Collect and build, but don't push. |

Outputs: `pages-dir`, `dataset` (path to the Dataset JSON), `summary` (one-line totals).

Pages is deployed by the user's workflow with `actions/upload-pages-artifact` + `actions/deploy-pages` pointed at `pages-dir` (documented example in the README); the action doesn't deploy itself.

Config file (`.github/stats.yml`, structures):

```yaml
groups:                     # first match wins; unmatched release assets go to "other"
  - { name: app, label: Desktop app, assets: "manga-downloader-gui-*" }
  - { name: cli, label: CLI, assets: "manga-downloader-*" }
ignore: ["*.md5", "*-SHA256SUMS.txt"]   # not counted as downloads (still stored)
counters:                   # named counts from specific assets, not downloads
  - { name: updates, label: In-app updates, assets: "manga-downloader-gui-*-SHA256SUMS.txt", from: v1.19.0 }
epochs:                     # dashboard periods and chart markers
  - { version: v1.11.0, label: First desktop app }
  - { version: v1.18.0, label: Installer and updater }
  - { version: v1.20.0, label: Multilingual }
platforms:                  # optional label rules for asset names; default strips repo name and version
  - { match: "*-windows-amd64-installer.exe", label: Windows amd64 installer }
docker: elboletaire/manga-downloader   # optional Docker Hub image
```

Globs use `*` (any run of characters) on the asset name. Versions compare as semver; non-semver tags sort by publish date.

## Data branch layout

```
README.md
<owner>/<repo>/
  snapshots/YYYY-MM-DD.json    raw snapshot of the day (UTC); a rerun the same day overwrites it
  stargazers.json              star timestamps only (no logins), backfilled once, then appended
  traffic/views.json           daily series, merged and de-duplicated by date   (opt-in)
  traffic/clones.json          same                                              (opt-in)
  traffic/referrers/YYYY-MM-DD.json   GitHub's 14-day aggregate, as of that day  (opt-in)
  traffic/paths/YYYY-MM-DD.json       same                                       (opt-in)
  daily.csv                    derived: one row per snapshot day, totals per group, deltas
  dataset.json                 derived: the Dataset
  charts/*.svg                 derived: SVG charts (light and dark)
  badges/*.json, badges/*.svg  derived: badges
dashboard/index.html           derived: self-contained dashboard (all repos in the branch)
```

Snapshot (`schema: 1`), minimal fields:

```json
{ "schema": 1, "date": "2026-10-18", "takenAt": "2026-10-18T09:01:43Z",
  "repo": { "stars": 271, "forks": 34, "watchers": 12, "openIssues": 5 },
  "docker": { "image": "elboletaire/manga-downloader", "pulls": 37673 },
  "releases": [ { "tag": "v1.20.0", "publishedAt": "…", "prerelease": false,
                  "assets": [ { "name": "…", "downloads": 10 } ] } ] }
```

Drafts are skipped. `docker` is absent when not configured or when Docker Hub fails (logged as a warning, never fails the run).

Import: `action` has an import mode (and a local CLI command) that converts manga-downloader's existing `stats-data` branch (`snapshots/YYYY-MM-DD.json` from `tools/stats-snapshot`) into this layout, so the days already recorded are kept.

## The Dataset

Built by `core` from the snapshots, stargazers, traffic and config. It's what every output reads, written as `dataset.json` and inlined in the self-contained dashboard. Defined as TypeScript types in `core` (exported), roughly:

- `repo`, `generatedAt`, `groups` (name, label, colour index), `epochs`, `counters` (definitions).
- `totals`: per group, all-time downloads; stars, forks; Docker pulls; counters.
- `releases[]`: tag, publishedAt, end of its live window, per-group downloads, counters, `files[]` (name, label, group or `ignored`, downloads), epoch index.
- `periods[]`: one per epoch span (plus the span before the first epoch): releases, per-group totals, avg/day and median/day (uniform spread over each release's live window, median over whole UTC days), counters.
- `estimatedDaily`: per group, one value per UTC day from the first release to now (uniform spread).
- `measuredDaily[]`: from consecutive snapshots: date, days spanned (gaps), per-group deltas, stars, Docker and counter deltas.
- `stars[]`: cumulative stars per day from stargazers.
- `traffic` (only when collected): views/clones per day (count, uniques), latest referrers and paths.

## Outputs

- **Dashboard** (port of the local `download-stats` page, generalised from app/CLI to N groups): KPI tiles with the latest measured change; periods table and chart; downloads per release (stacked by group, epoch markers); estimated downloads per day with the zoom strip, presets and pinch; measured downloads per day (bars by group, Docker on its own axis, gaps); downloads by version and file (picker, per-file bars, all-versions pivot); platforms; stars over time; traffic section when present; daily snapshot table. Light/dark, phone width, no external requests except fonts. Two builds from one app: `index.html` + `data/<owner>/<repo>/dataset.json` (fetched) for Pages, and one self-contained HTML with the datasets inlined for the branch.
- **SVG charts** (`charts/`): stars over time, downloads per day (measured when ≥14 days, else estimated), downloads per release by group; each in `-light.svg` and `-dark.svg` for `<picture>` in READMEs. No scripts, system fonts, fixed size.
- **Badges** (`badges/`): shields.io endpoint JSON (total downloads, per group, latest release downloads, stars, Docker pulls, counters) and standalone flat SVG badges with the same values.

## Errors

- GitHub API errors on releases or repo fail the run (nothing is written). Traffic 403 fails only when `traffic: true`, with a message saying a PAT with push access is needed. Docker Hub errors are warnings.
- Rate limits: use the token; stargazers backfill pages at 100 per request and stops at the API's limit, logging how many were fetched.
- Pushing: fetch the data branch, write, commit as `github-actions[bot]`, push; on a non-fast-forward, refetch and retry once.

## Testing

- `core`: unit tests with recorded API fixtures (a trimmed copy of manga-downloader's real releases), config parsing and glob matching, Dataset maths (periods, medians, estimated spread, measured gaps, counters, epochs), import of the old format.
- `dashboard`, `svg`, `badges`: built from a fixture Dataset; vitest for pure functions; Playwright screenshots of the dashboard at desktop and 390px, light and dark, checked for page errors.
- `action`: local CLI (`pnpm stats --repo owner/name --out dir --dry-run`) that runs everything without pushing; a test run against `elboletaire/manga-downloader` read-only.
- CI: typecheck, tests, build, and a check that `dist/` is up to date.
