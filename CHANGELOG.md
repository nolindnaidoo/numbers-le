# Changelog

All notable changes to Numbers-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-08-05

### Added

- Runtime strings are localized, and this time they render. All 41 of them —
  notifications, status bar, quick-picks and prompts — go through
  `vscode.l10n` and ship as twelve translated bundles in `l10n/`. The v1.x
  line carried manifest catalogues that worked and runtime catalogues that
  never reached the screen: `vscode-nls` was configured without
  `__filename`, so every runtime string fell back to English while the VSIX
  looked correct.
- An integration test covering both localization mechanisms — manifest
  substitution, key parity across all thirteen catalogues, and placeholder
  integrity in every translation. A translation that silently drops `{0}`
  now fails the build instead of shipping a message with the value missing.

- Dependency review on pull requests, failing on a high-severity addition
  before Dependabot's auto-merge can act.

### Fixed

- The large-output dialog's "Copy only" choice could deliver nothing at all.
  The dialog offers Open / Copy only / Cancel regardless of the
  `copyToClipboardEnabled` setting, but the copy that followed was gated on
  that setting — so choosing "Copy only" with it off opened no document and
  copied nothing, then reported "Extracted 150" for results the user never
  received. An explicit choice now performs the copy, and nothing is reported
  when nothing was delivered.
- The six format parsers reported a failure with `(error as Error).message`.
  The cast is accepted by the compiler and wrong the moment a parser throws
  anything that is not an Error — a string or a plain object produced
  "Failed to parse JSON: undefined". `extract.ts` already guarded with
  `instanceof Error`; that is now the single convention, behind one
  `errorMessage()` helper with tests for the non-Error cases.
- The sort quick-pick widened its `value` to `string` and cast back to
  `SortMode` at the call site — the one place an invalid mode could reach
  `sortNumber`. The options array is typed, so the choice stays typed end to
  end and the last cast in the codebase is gone.
- The CSV column-index validator message was never localized; it is returned
  from a `validateInput` callback rather than assigned to a property.
- The large-file warning was never localized either — an interpolated template
  literal inside a multi-line `notifier.warn(...)` call.

### Changed

- Every `else` block is gone (11 of them), replaced by guard clauses, early
  returns and value expressions, per the code style in `AGENTS.md`.
- Dedupe and sort carried the same two blocks verbatim — collecting the numbers
  and writing the result. Both now use one implementation in
  `commands/postProcessShared.ts`; dedupe drops from 130 lines to 51 and sort
  from 150 to 75. The mutable `let numbers` each maintained is gone with them.
- `commands/extract.ts` held orchestration, CSV handling, the normal extraction
  path and output routing in 509 lines. CSV moved to `commands/extractCsv.ts`,
  leaving 257 and 268.

- Test coverage raised from 62.78% to 80.11% of branches (78.28% to 89.62% of
  statements), which moves the repo from 2.78 points above the branch floor to
  20.11, with no file left below any of the repo's own floors. The activation
  entry point had no test at all — it was one of two in the family at 0%
  statements, so a command declared in the manifest but never registered would
  have failed at the moment a user ran it with nothing to catch it. Only two
  of `detectFileType`'s seven arms were covered, which decides which extractor
  runs. The gap was concentrated almost entirely in `commands/extract.ts`,
  whose settings and prompt-answer permutations — side-by-side output, the
  large-output prompt, the safety thresholds, CSV column selection and the
  multi-column path, the streaming toggle — were unreachable from the
  default-config tests. Writing them found the unlocalized warning above and
  two behaviours worth recording: the file-size gate warns rather than
  refusing, and dismissing the CSV column prompt continues with default
  options instead of cancelling.
- The `vscode` test mock honours `validateInput`. VS Code will not hand a
  command a value its own validator rejected — the input box stays open until
  the input is valid or the user escapes — but the mock returned whatever the
  test supplied, which let tests drive commands with input the real UI could
  never deliver.

### Changed

- CI gains fleet-wide checks that no single repo can perform: shared config is
  compared across all ten extensions, and every README link is verified —
  including Open VSX links, which are checked against the API because
  open-vsx.org answers HTTP 200 for extensions that do not exist.

## [2.0.1] - 2026-08-04

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.
- Search keywords widened to 30, targeting the terms users actually type
  rather than internal vocabulary.
- Toolchain moved to current: TypeScript 7, vitest 4, Biome 2.5.7,
  @types/node 26. `@types/vscode` is now pinned exactly to the
  `engines.vscode` floor — the caret had let the type surface drift 15
  minors ahead of the version actually supported.
- Runtime dependencies updated across majors where present: csv-parse 7,
  ini 7, js-yaml 5. Extraction output is unchanged, verified against the
  characterization goldens.
- Packaging no longer walks the npm tree (`vsce package --no-dependencies`).
  The bundle is self-contained, so the walk served no purpose and failed
  after any dependency change. Scrape-LE keeps it, since it genuinely
  ships `playwright-core`.
- Documentation claims corrected against the code. Removed: Numbers-LE
  "with statistics", EnvSync-LE "visual diffs", Regex-LE "live feedback",
  String-LE "and validation" — none of those features exist.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.
- README now carries measured Performance and Testing sections, both
  generated rather than written — from `scripts/benchmark.ts` and from the
  coverage summary. CI fails if the coverage numbers drift from a real run.
- Coverage thresholds enforced at 75 lines / 80 functions / 60 branches /
  75 statements.
- CodeQL scanning, Dependabot with grouped weekly updates, and auto-merge
  limited to patch and minor devDependency bumps that pass CI.

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
