# Changelog

All notable changes to Numbers-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-08-03

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.

## [2.0.0] - 2026-07-29

Full rehabilitation release. The headline: **v1.x VSIXes built from this
repo could not activate** — the build had no bundler while the package
excluded `node_modules`, so the extension crashed on load with
`Cannot find module 'vscode-nls'`. 2.0.0 ships a self-contained esbuild
bundle, verified by a packaging gate and a real extension-host
integration suite on every CI run.

### Fixed

- **Packaging**: `dist/extension.js` is now a single self-contained
  bundle (VSIX: 21 files). A bundle gate (static require scan + loading
  the bundle with `vscode` stubbed) blocks any regression.
- **`Toggle CSV Streaming`**: the command was declared in the manifest
  (palette entry, activation event) but never registered — invoking it
  errored with "command not found" in every 1.x release. It now flips
  `csv.streamingEnabled` globally and reports the new state.
- **Errors were invisible by default**: the notifier suppressed error
  messages at the default `silent` level. `silent` now means errors
  only; `important` adds warnings; `all` shows everything.
- **`postProcess.openInNewFile`** shipped declared (default `true`) but
  ignored — Dedupe/Sort always overwrote the current editor. It is now
  honored, and in-place replacement is the opt-out.
- **Config**: code fallbacks silently disagreed with manifest defaults
  (`openResultsSideBySide`, `postProcess.openInNewFile`); a parity test
  now asserts every declared key. Non-numeric setting overrides no
  longer produce `NaN` thresholds that disabled every safety check.
- **Context menu**: the `resourceExtname in …` when-clause never
  matched ('in' tests context-list membership, not string equality), so
  the right-click entry never appeared; replaced with an `editorLangId`
  regex.
- **Error hygiene**: user directories and credential-shaped fragments
  are redacted from every notification.

### Changed — extraction output

One shared heuristics module replaces four divergent per-format number
collectors, and csv-parse replaces three hand-rolled CSV splitters
(which mishandled escaped quotes). The unified policy:

- **Coerced strings must be numeric in full** (INI/.env/CSV): `12abc`
  no longer extracts `12`, `VERSION=1.2.3` no longer extracts `1.2`,
  `"1,000"` no longer extracts `1`. JSON/YAML/TOML quoted numbers
  remain data, not numbers (unchanged, now deliberate and documented).
- **Finite numbers only**: YAML `.inf` / TOML `inf` no longer leak the
  literal `Infinity` into results.
- **CSV sync and streaming now agree**: the streaming path previously
  consumed the first row as a header and silently dropped it. No header
  inference anywhere — every row is data.
- **Multi-document YAML** (`---` streams) now extracts from every
  document instead of failing with a parse error.
- **Unknown-file-type fallback** now understands exponents, leading
  `+`, and leading-dot floats (`1e6` no longer reads as `1` and `6`).

### Removed

- 14 settings that were never read by any code path (`analysis.*`,
  `performance.*`, `keyboard.*`, `presets.*`). 15 real settings remain,
  each with a consumer.
- The runtime "localization" layer: it never loaded a single
  translation (broken `vscode-nls` wiring; the per-module bundles it
  needed were never generated) — users always saw English.
  Manifest/settings translations in 13 catalogues remain, pruned to
  exact key parity.
- The 450-line performance monitor (metrics recorded with hardcoded
  zeros into a buffer nothing read), two dead 380+-line utility
  modules, 138MB of committed benchmark fixtures, and the fabricated
  documentation set (`ENTERPRISE_QUALITY.md`, `docs/`) — replaced by an
  accurate README + AGENTS.md.
- The `Post-Process: Analyze` section of the help document: no such
  command exists, and no statistics feature ships in this extension.

### Infrastructure

- esbuild bundle + allow-list `.vscodeignore` + bundle gate.
- tsc now typechecks tests and configs (`noEmit`, strict).
- Stateful vscode mock; 243 unit tests, coverage thresholds enforced
  (80 lines / 80 funcs / 75 branches / 80 stmts).
- Real extension-host integration suite (`@vscode/test-cli`).
- CI on 3 OSes: lint → typecheck → coverage → build → bundle gate →
  package → integration tests; VSIX artifact uploaded. Manual release
  workflow publishes to Marketplace + Open VSX.
- Publisher/branding: `nolindnaidoo`.

## 1.x (condensed) - 2025

Versions 1.7.0–1.8.1 claimed statistical analysis, smart filtering,
stream processing of "millions of rows", currency/percentage detection,
and enterprise security hardening. Most of those claims did not hold
against the code (no analysis command ever existed, filtering was
`parseFloat` coercion, and the published VSIX could not activate at
all); their entries are condensed here rather than preserved as
documentation.
