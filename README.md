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
| `import-old` | empty | Path of an old-format `snapshots/` in the data branch (`.` for the root), converted into this repo's folder before the run. See [Data branch](#data-branch). |

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

- Release downloads, stars, forks, watchers, open issues and Docker Hub pulls are stored on the data branch. That branch is public when the repo is.
- Stars are stored as timestamps only (`stargazers.json`). No logins are stored.
- Traffic is opt-in twice. With `traffic: true`, views, clones, referrers and paths are stored on the data branch, which is public when the repo is. `pages-traffic: true` only controls whether the Pages copy includes traffic. Both default to `false`.
- Planned for several repos: their data would live in one private central repo rather than in each public repo. Not implemented yet; one repo per run for now.

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
  traffic/views.json              daily series, merged by date           (traffic: true)
  traffic/clones.json             same                                   (traffic: true)
  traffic/referrers/YYYY-MM-DD.json   GitHub's 14-day aggregate that day  (traffic: true)
  traffic/paths/YYYY-MM-DD.json       same                                (traffic: true)
  daily.csv                       derived: one row per snapshot day
  dataset.json                    derived: everything the outputs read
  charts/*-light.svg, *-dark.svg  derived: SVG charts
  badges/*.json, badges/*.svg     derived: shields.io endpoint JSON and flat SVG badges
```

Everything except `snapshots/`, `stargazers.json` and `traffic/` is rebuilt on every run, so the snapshots are the only source of truth.

### Migrating an old data branch

To move manga-downloader's old `snapshots/` (at the branch root) into `<owner>/<repo>/snapshots/`, set `import-old: .` for one run. The days are converted and committed; days already in the new folder are kept, and the old root files are left alone. Check the branch, then remove the root `snapshots/` by hand if you want it gone, and unset `import-old`.

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

Files on the data branch are served by `raw.githubusercontent.com`. Replace `OWNER/REPO` with the repo that runs the action. It appears twice in each URL: as the repo, and as the `<owner>/<repo>` folder on the branch:

```md
[![Downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Fstats-data%2FOWNER%2FREPO%2Fbadges%2Fdownloads.json)](https://github.com/OWNER/REPO)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/stats-data/OWNER/REPO/charts/stars-dark.svg">
  <img alt="Stars over time" src="https://raw.githubusercontent.com/OWNER/REPO/stats-data/OWNER/REPO/charts/stars-light.svg">
</picture>
```

The badge JSON follows the shields.io endpoint schema, so any shields.io endpoint badge can read it.

## Config

The file is YAML, optional, read from `.github/stats.yml` by default. Unknown keys are an error. Example: [examples/stats.yml](examples/stats.yml), the config of manga-downloader.

```yaml
groups:                     # first match wins; unmatched assets are "other"
  - { name: app, label: Desktop app, assets: "manga-downloader-gui-*" }
  - { name: cli, label: CLI, assets: "manga-downloader-*" }
ignore: ["*.md5", "*-SHA256SUMS.txt"]   # not counted as downloads (still stored)
counters:                   # named counts of matching assets, not downloads
  - { name: updates, label: In-app updates, assets: "manga-downloader-gui-*-SHA256SUMS.txt", from: v1.19.0 }
epochs:                     # dashboard periods and chart markers
  - { version: v1.0.0, label: 1.0 rewrite }
  - { version: v1.11.0, label: First desktop app }
  - { version: v1.18.0, label: Installer and updater }
  - { version: v1.20.0, label: Multilingual }
platforms:                  # label rules for asset names
  - { match: "*-windows-amd64-installer.exe", label: Windows amd64 installer }
docker: elboletaire/manga-downloader   # optional Docker Hub image
```

- `groups`: `name` (letters, digits, `-`, `_`; `other` and `ignored` are reserved), `label` (defaults to the name), `assets` (a glob). Without `groups`, every asset counts as `downloads`.
- `ignore`: globs on asset names.
- `counters`: `name`, `label`, `assets`, and `from`, an optional quoted semver; releases before it aren't counted.
- `epochs`: `version` as a quoted semver (`"v1.11.0"`, so YAML doesn't read `1.11` as a number), `label` defaults to the version. Optional.
- `platforms`: `match` and `label`. Without a matching rule, the asset name minus the tag, repo name and archive suffixes is used.
- `docker`: `namespace/name`.

Globs: `*` matches any run of characters, everything else is literal.

## Command line

```
github-stats [collect] --repo owner/name --out <dir> [--config <file>] [--traffic] [--dry-run] [--import-old <dir>]
github-stats render (--data <dir> | --from-branch <ref>) --out <dir> [--repo owner/name] [--config <file>]
```

`collect` needs `GITHUB_TOKEN` in the environment. `--dry-run` is accepted for parity with the action, and the CLI never pushes: copy the output into the data branch yourself.

### Importing the old format

manga-downloader's old `stats-data` branch (`snapshots/YYYY-MM-DD.json` from its `tools/stats-snapshot`) converts into this layout with `--import-old`, which takes a checkout of that branch:

```sh
git clone --branch stats-data --single-branch https://github.com/elboletaire/manga-downloader /tmp/mdl-stats
GITHUB_TOKEN=... github-stats --repo elboletaire/manga-downloader --out ./out --import-old /tmp/mdl-stats
```

The imported days go to `out/elboletaire/manga-downloader/snapshots/`, alongside the snapshot of today. Commit them to the data branch to keep the history.

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

MIT, see [LICENSE](LICENSE).
