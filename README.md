# Repo Stats Action

A GitHub Action that keeps the history GitHub throws away. GitHub shows only the current download count of each release asset and 14 days of traffic, so nothing else survives unless it's copied. Every run stores a snapshot of release downloads, stars, Docker Hub pulls and (opt-in) traffic on an orphan `stats-data` branch, then rebuilds from all of them a dashboard, SVG charts and badges.

## Quick start

1. Add `.github/workflows/stats.yml` (see [examples/workflow.yml](examples/workflow.yml)):

   ```yaml
   name: Repo Stats Action

   on:
     schedule:
       - cron: "17 5 * * *"
     workflow_dispatch:

   permissions:
     contents: write

   concurrency:
     group: github-stats
     cancel-in-progress: false

   jobs:
     stats:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v5
         - uses: elboletaire/github-stats-action@v1
   ```

2. Run it once from the Actions tab (`workflow_dispatch`). The data branch is created on the first run.
3. Optionally add `.github/stats.yml` to name your groups, counters and epochs (see [Config](#config)).

`contents: write` lets the action push the data branch. Keep `actions/checkout`: the action reads the config from the workspace and fetches the data branch from `origin`.

Use `@v1` (the latest 1.x release, moved by the release workflow) or pin a full version such as `@v1.2.3`. `@main` doesn't work: the branch has no `dist/`.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `token` | `${{ github.token }}` | API token. Traffic needs a PAT, see [Traffic](#traffic). |
| `config` | unset | Config file; `.github/stats.yml` when unset, which may be missing (then the defaults apply). A path set here must exist. |
| `data-branch` | `stats-data` | Branch the data lives on, created on first run. |
| `traffic` | `false` | Collect traffic: views, clones, referrers, paths. |
| `pages` | `false` | Write the static site to `pages-dir`, for the Pages actions. |
| `pages-dir` | `_site` | Where the Pages site goes. |
| `pages-traffic` | `false` | Include traffic in the Pages site. |
| `dry-run` | `false` | Collect and build, but don't commit or push. |

Outputs: `pages-dir` (absolute, empty when `pages` is off), `dataset` (absolute path of the repo's `dataset.json`) and `summary` (one line of totals).

## Traffic

GitHub's traffic API needs push access to the repo, and `GITHUB_TOKEN` gets a 403 there. Create a PAT from a user with push access, store it as a secret (here `STATS_TOKEN`), and pass it as `token`:

```yaml
      - uses: elboletaire/github-stats-action@v1
        with:
          token: ${{ secrets.STATS_TOKEN }}
          traffic: true
```

Traffic is collected only with `traffic: true`. The daily views and clones are merged into `traffic/`, and each day's referrers and paths are kept as GitHub's 14-day aggregate.

## Privacy

- Release downloads, stars, forks, watchers, open issues and Docker Hub pulls are stored on the data branch. That branch is public when the repo is. npm's daily counts for the configured packages are stored there too; they're public npm data.
- Stars are stored as timestamps only (`stargazers.json`). No logins are stored.
- Traffic is opt-in twice. With `traffic: true`, views, clones, referrers and paths are stored on the data branch, which is public when the repo is. `pages-traffic: true` only controls whether the Pages copy includes traffic. Both default to `false`.
- Planned for several repos: their data would live in one private central repo rather than in each public repo. Not implemented yet; one repo per run for now.

## npm downloads

npm keeps daily download counts for 18 months only. This action stores them on the data branch every day, so the history outlives npm's window. npm's counts are public, so no token is needed.

List the packages in `.github/stats.yml`, scoped ones too (up to 8):

```yaml
npm:
  - acme
  - "@acme/core"
  - { package: "@acme/react", label: React }
```

- **First run:** backfills the last 18 months of every package.
- **Later runs:** fetch from a week before the last stored day, so late corrections from npm overwrite the stored values. The latest day can be provisional if the run happens early in the UTC day; the next run corrects it.
- **Stored as** `<owner>/<repo>/npm/<slug>.json`, one line per day (`@scope/name` becomes `scope--name`). Like the snapshots, these files are never rebuilt or pruned.
- **Failures** (a package npm doesn't know, an npm outage) are warnings: the run goes on and the stored days stay.

What you get:

- **Dashboard:** an npm section with the last 30 days, a stacked daily chart per package with zoom, and a per-package table.
- **Chart:** `charts/npm-downloads-light.svg` / `-dark.svg`, weekly downloads stacked by package. Limit it with `charts: { npm-downloads: { range: 1y } }` (see [Config](#config)).
- **Badges:** `npm-downloads` (last 30 days), `npm-downloads-week`, `npm-downloads-total`, and `npm-<slug>` / `npm-<slug>-week` per package (see [Badges](#badges)).
- **CSV:** one `npm_<slug>` column per package and `npm_total` in `daily.csv`, one row per npm day.

A repo that only publishes to npm, with no files attached to its GitHub releases, needs nothing else: release-download sections, charts and badges are left out when no release asset counts as a download (set `releases: false` to leave them out anyway). For example, a monorepo publishing four packages:

```yaml
# .github/stats.yml
npm:
  - "@acme/core"
  - "@acme/react"
  - "@acme/vue"
  - "@acme/svelte"
```

```markdown
[![npm downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Fstats-data%2FOWNER%2FREPO%2Fbadges%2Fnpm-downloads.json)](https://www.npmjs.com/org/acme)
```

## Pages (optional)

A repo has one Pages site. If the repo already serves a website from Pages, keep `pages` off and read the dashboard from the data branch instead (see [Reading the dashboard](#reading-the-dashboard)).

Set the repo's Pages source to "GitHub Actions" first. The action only writes the site to `pages-dir`; the Pages actions deploy it:

```yaml
name: Repo Stats Action

on:
  schedule:
    - cron: "17 5 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: github-stats
  cancel-in-progress: false

jobs:
  stats:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: elboletaire/github-stats-action@v1
        with:
          pages: true
          pages-dir: _site
      - uses: actions/upload-pages-artifact@v4
        with:
          path: _site

  deploy:
    needs: stats
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Data branch

```
dashboard/index.html              self-contained dashboard, all repos on the branch
<owner>/<repo>/
  snapshots/YYYY-MM-DD.json       raw snapshot of the day (UTC); a rerun the same day overwrites it
  stargazers.json                 star timestamps, no logins
  npm/<slug>.json                 daily npm counts per package, sorted (npm: in the config); slug: `@scope/name` becomes `scope--name`
  traffic/views.json              daily series, merged by date           (traffic: true)
  traffic/clones.json             same                                   (traffic: true)
  traffic/referrers/YYYY-MM-DD.json   GitHub's 14-day aggregate that day  (traffic: true)
  traffic/paths/YYYY-MM-DD.json       same                                (traffic: true)
  daily.csv                       derived: one row per snapshot or npm day; release, Docker and npm columns only when the repo has them
  dataset.json                    derived: everything the outputs read
  charts/*-light.svg, *-dark.svg  derived: SVG charts
  badges/*.json, badges/*.svg     derived: shields.io endpoint JSON and flat SVG badges
```

Everything except `snapshots/`, `stargazers.json`, `npm/` and `traffic/` is rebuilt on every run, so the snapshots and the stored counts are the only source of truth. Generated charts and badges that a run no longer produces are deleted; folders and files the action doesn't generate (a hand-made `charts/logo.svg`) are left alone. Don't name your own files in `charts/` or `badges/` with the generated prefixes (`downloads-*`, `npm-*`, `counter-*`): a file that looks generated is pruned.

## Reading the dashboard

Without Pages, the dashboard is on the data branch:

```sh
git fetch origin stats-data
git show origin/stats-data:dashboard/index.html > dashboard.html
```

To rebuild the outputs from the branch with no API calls, run the CLI from a clone of the repo that holds the branch (`github-stats` is the bin of this package; from a clone, `node dist/cli.js`):

```sh
git fetch origin stats-data
github-stats render --from-branch origin/stats-data --out dir
```

`render` writes `dir/dashboard/index.html` and `dir/<owner>/<repo>/` (charts, badges, `dataset.json`). It takes `--repo owner/name` when the branch holds more than one repo, and `--data <dir>` instead of `--from-branch` for a checkout of the branch.

## Badges and charts

Files on the data branch are served by `raw.githubusercontent.com`. Replace `OWNER/REPO` with the repo that runs the action. It appears twice in each URL: as the repo, and as the `<owner>/<repo>` folder on the branch.

### Badges

Each badge is written as `badges/<name>.json` (shields.io endpoint) and `badges/<name>.svg` (flat). Period badges only count days the action measured, so none is an estimate. A window is shown when a snapshot exists on the day before it and no gap spans its first day; gaps inside it are summed. Windows are UTC days ending on the latest stored day. A window whose sum is negative (a removed release lowered the count) is hidden. The star windows are signed instead, so a net loss shows as a minus.

| Name | Shows | Written when |
|---|---|---|
| `downloads` | release downloads, all releases | release downloads are counted |
| `downloads-week`, `downloads-month` | downloads over the last 7 / 30 days, e.g. `1.2k/week` | the measured history covers the window |
| `downloads-<group>` | one group's downloads, e.g. `downloads (CLI)` | two or more groups |
| `downloads-<group>-week`, `-month` | one group over the same windows | as above |
| `release-latest` | downloads of the latest stable release | a stable release exists |
| `stars` | stars | always |
| `stars-week`, `stars-month` | stars gained, e.g. `+12 this month`; negative when stars were removed | stargazers were collected |
| `docker-pulls` | Docker Hub pulls | a count was ever collected |
| `docker-pulls-month` | pulls over the last 30 days, e.g. `3k/month` | the measured Docker counts cover the window |
| `npm-downloads` | npm downloads over the last 30 days, all packages | a package has stored days |
| `npm-downloads-week` | the same over the last 7 days | as above |
| `npm-downloads-total` | npm downloads over every stored day, e.g. `113k total` | as above |
| `npm-<package>`, `npm-<package>-week` | one package over the last 30 / 7 days | the package has stored days |
| `counter-<name>` | downloads of a counter's assets | a counter is configured |

Each `.json` file is a shields.io endpoint, so it works in any shields.io badge:

```md
[![Downloads per month](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Fstats-data%2FOWNER%2FREPO%2Fbadges%2Fdownloads-month.json)](https://github.com/OWNER/REPO)
```

The SVG, as an image:

```html
<img alt="Stars this month" src="https://raw.githubusercontent.com/OWNER/REPO/stats-data/OWNER/REPO/badges/stars-month.svg">
```

### Charts

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/stats-data/OWNER/REPO/charts/stars-dark.svg">
  <img alt="Stars over time" src="https://raw.githubusercontent.com/OWNER/REPO/stats-data/OWNER/REPO/charts/stars-light.svg">
</picture>
```

## Config

The file is YAML, optional, read from `.github/stats.yml` by default. Unknown keys are an error. Example: [examples/stats.yml](examples/stats.yml), for a project called `acme`.

```yaml
releases: true              # false hides release downloads everywhere, even when assets count
groups:                     # first match wins, so the more specific pattern goes first
  - { name: desktop, label: Desktop app, assets: "acme-desktop-*" }
  - { name: cli, label: CLI, assets: "acme-*" }
ignore: ["*.sha256", "acme-desktop-*-update.json"]   # checksums and the updater's manifest aren't downloads
counters:                   # named counts of matching assets, not downloads
  - { name: updates, label: In-app updates, assets: "acme-desktop-*-update.json", from: v2.3.0 }
epochs:                     # dashboard periods and chart markers
  - { version: v1.0.0, label: Rewrite }
  - { version: v2.0.0, label: Desktop app }
platforms:                  # label rules for asset names
  - { match: "acme-desktop-*-windows-x64-setup.exe", label: Windows installer }
charts:                     # README SVG charts
  titles: true              # false hides every chart's title
  stars: { from: 2024-01-01 }                # the window: a date, a year or a month
  downloads-per-day: { range: 90d }          # or a length counted back from the latest day
  downloads-per-release: { last: 20 }        # the last N releases instead
  npm-downloads: { range: 1y }
docker: acme/acme           # optional Docker Hub image
npm:                        # optional npm packages, counted daily
  - password-strength-meter
  - { package: "@acme/core", label: Core }
```

- `groups`: `name` (letters, digits, `-`, `_`; `other` and `ignored` are reserved, and so are `week`, `month`, or a name ending in `-week`, `_week`, `-month` or `_month`, which the period badges use), `label` (defaults to the name), `assets` (a glob). The first matching group wins, so list the more specific glob first. Without `groups`, every asset counts as `downloads`.
- `ignore`: globs on asset names.
- `counters`: `name`, `label`, `assets`, and `from`, an optional quoted semver; releases before it aren't counted. A counter's assets still count as downloads unless `ignore` also names them.
- `epochs`: `version` as a quoted semver (`"v1.11.0"`, so YAML doesn't read `1.11` as a number), `label` defaults to the version. Optional.
- `platforms`: `match` and `label`. Without a matching rule, the asset name minus the tag, repo name and archive suffixes is used.
- `releases`: `true` by default. Release downloads show only when some release has an asset that counts (not ignored), so a repo without release assets gets no download views. `false` hides them even when assets count. The snapshots keep the counts either way, so turning it back on restores the history.
- `npm`: npm package names, or `{ package, label }` (the label defaults to the name). Scoped names work. `downloads`, `downloads-week`, `downloads-total` and names ending in `-week` are reserved for the badges. Up to 8: each package takes one of the eight palette colours, and a ninth would repeat one in the stacked charts, where two touching segments of one colour can't be told apart. Absent means no npm requests at all.
- `charts`: `titles` (default `true`) shows or hides the title of the README SVGs (a note that says what the data is stays: estimated or measured); a chart's own `title` (`stars`, `downloads-per-day`, `downloads-per-release`, `npm-downloads`) overrides it. The dashboard keeps its headings.
  - Each chart can cover a window, set per chart (there is no global default). `from` is the first day: `2024-06-01`, `2024-06` or `2024`, quoted or not (`from: 2024` and `from: "2024"` both work). `range` is a length counted back from the latest day, inclusive: `30d`, `6m`, `1y`. `from` and `range` are exclusive. A window longer than the history shows all of it; absent means all history.
  - `stars` samples the window (the count on its first day is where the curve starts, and the y axis keeps the real total). `downloads-per-day` and `npm-downloads` start their x axis at the window start, and the bars or areas of `downloads-per-day` are chosen on the whole history, so a short window still shows bars. `downloads-per-release` takes the releases published in the window, or with `last: N` the last N releases; epoch markers outside it are hidden.
  - The window ends on the data's latest day, never the clock, so re-rendering gives the same file. npm's window ends on npm's last stored day.
  - `last` is for `downloads-per-release` only.
  - The dashboard isn't windowed: it has its own zoom.
- `docker`: `namespace/name`.

Globs: `*` matches any run of characters, everything else is literal.

## Command line

```
github-stats [collect] --repo owner/name --out <dir> [--config <file>] [--traffic] [--dry-run]
github-stats render (--data <dir> | --from-branch <ref>) --out <dir> [--repo owner/name] [--config <file>]
```

`collect` needs `GITHUB_TOKEN` in the environment. `--dry-run` is accepted for parity with the action, and the CLI never pushes: copy the output into the data branch yourself.

## Releasing

Push a `vX.Y.Z` tag on the commit to release, or run the Release workflow with a version. The workflow builds `dist/` onto a `chore(release)` commit above the tagged one, moves the tag there, moves `vX` and `vX.Y` when this is the newest stable release of that series, and creates the GitHub Release with generated notes.

`workflow_dispatch` tags the head of the branch you select, unless the version tag already exists.

To test a branch, tag it (e.g. `v0.1.0`) and use `@v0.1.0`. A branch has no `dist/`, so `@<branch>` can't run. Warning: a test tag like `v0.1.0` creates a real GitHub Release and moves `v0` and `v0.1` to it. Delete the release and those tags afterwards if you don't want them.

## Development

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build
```

`dist/` isn't committed: the release workflow builds it (see [Releasing](#releasing)). `pnpm build` gives you the built action locally.

## License

MIT, see [LICENSE](LICENSE). The dashboard embeds IBM Plex under the SIL OFL 1.1 ([notice](packages/dashboard/fonts/OFL.txt)).
