# Changelog

All notable changes to Numbers-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**. The Rust CLI in `crate/` is a
separate product on its own cadence and keeps its own
[CHANGELOG](crate/CHANGELOG.md).

## [Unreleased]

### Changed

- **New icon artwork.** A new drawing in the style the family is moving
  to, framed like the rest of the set.

### Fixed

- **The agent-files check no longer times out on Windows.** A test-only
  fix; nothing a user of the extension can observe.

## [2.3.0] - 2026-08-14

The numbers pulled out of a source file are now the numbers that are
actually written in it.

### Added

- **Numeric literals in twelve source languages** — Python, Rust, Go,
  Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL and shell, by
  `languageId` or by file extension. Hex `0xFF`, binary `0b1010`, octal
  `0o755` and legacy `0755`, digit separators `1_000_000` and `1'000`,
  and suffixes `123n`, `1.5f`, `10u32`, `100L`.

  **`u32` is a type name, not the number 32.** These files used to go
  through a text scan with no grammar, which splits on the first
  character that is not a digit: `0o755` came back as `0` and `755`,
  `1_000_000` as `1`, `0` and `0`, and `u32`, `i64`, `f32` and `usize`
  as `32`, `64`, `32` and `64`. A source file gave you numbers that were
  never written in it.

  **Expect your counts to fall, and that is the fix.** On one real Rust
  codebase the results lost 757 phantom `32`s and 402 phantom `64`s —
  every one of them a type annotation rather than a value anybody wrote.
  A smaller list after upgrading is a more honest list.

  A dialect changes an answer, so each language keeps its own name:
  `0755` is 493 in C, C++, Go and Java and 755 in Rust, Python 3, Kotlin
  and C#; `1_000` is one thousand in Rust and the number 1 in C; `123n`
  is a BigInt in JavaScript and TypeScript and nowhere else. Comments
  and strings are read too, on purpose — a threshold quoted in a
  docstring is exactly as interesting as one in an expression.

- **Every finding says how it was written.** A new `notation` on each
  number — `decimal`, `hex`, `binary`, `octal`, `scientific` or
  `bigint`. `0x1A` and `26` are the same number and not the same line of
  code, and a result list could not previously tell you which you were
  looking at.

  It describes the **literal**, not the value, so it follows what the
  file could express: JSON, YAML and TOML resolve a literal before this
  sees it, so those report `decimal`; INI, `.env`, CSV, the twelve
  source languages and the plain-text scan keep what the text said.

- **A command-line and agent version of the same engine**, in
  [`crate/`](crate/README.md), published to crates.io as `numbers-le`.
  It runs this extraction over a whole tree rather than one buffer, with
  exit codes following grep — 0 found, 1 none found, 2 the question was
  malformed — so checking every hardcoded number in a repository against
  a specification is one command and a file. This extension stays the
  reference implementation and a shared corpus holds the two together.

### Fixed

- **A very large number came back as a different number.** Asking the
  `extract_numbers` MCP tool about `123456789012345680000` could return
  `1.2345678901234567e+20` — not another way of writing the same value,
  a different one. Both servers that offer the tool now return the
  number exactly as it was found. For a tool whose whole output is
  numbers, this is the fix that matters most.

- **A file type given with an invisible character at the front now
  resolves.** A byte-order mark is what a spreadsheet export, Notepad
  and a PowerShell redirect all leave behind. One in front of a format
  name meant JSON was scanned as plain text instead of parsed — and a
  plain text scan reads a quoted `"42"` as a number, where JSON knows it
  is data. The same character in front of a CSV cell or a `.env` value
  stopped it being read as a number at all.

### Changed

- **A source file is recognised by its extension.** `a.rs` is `rust`
  rather than `unknown`, so the "which file type is this?" prompt no
  longer appears for source files.

- **`data.numbers` from the `extract_numbers` MCP tool is a list of
  `{ value, notation }` objects**, where it was a list of bare numbers.
  An agent or script reading `data.numbers[0]` as a number needs a
  one-line change to `data.numbers[0].value`. Both servers moved
  together — it is one tool with two implementations — and the shared
  corpus pins the new shape.

- **`ExtractionResult.numbers` is `readonly NumberFinding[]`**, each
  `{ value, notation }`, where it was `readonly number[]`. The commands
  still write one number per line; the notation belongs to the report
  surfaces.

- **New icon artwork.** All sixteen tools were redrawn in one style, so
  the family reads as one set wherever the listings sit side by side —
  the Marketplace, Open VSX and letools.dev. The framing is unchanged:
  the drawing fills 65.8% of an 800×800 canvas, and every smaller size
  is derived from that one file rather than drawn again.

### Known divergence

- **A TOML integer at or above 2^53 (9,007,199,254,740,992)** is
  silently missing from this extension's results — the TOML parser it
  uses hands back a value the numeric walk does not recognise. The Rust
  CLI reports it. If you are checking constants that large in a TOML
  file, use the CLI; the difference and its reason are written down in
  the CLI's [SPEC.md](crate/SPEC.md).

## [2.2.4] - 2026-08-07

### Changed

- Documentation only — no behaviour change.

  The cross-references now point at each tool's own page on letools.dev rather
  than its VS Code Marketplace listing. The Marketplace listing shows one of
  the four channels a tool ships through; the detail page shows all of them,
  which is what a reader following a link from another tool is looking for.
  Install instructions are untouched, and the rating links now lead with Open
  VSX — where the audience these READMEs reach actually installs from.

- `homepage` in the extension and MCP manifests, and `websiteUrl` in the
  registry entry, resolve to the same detail page.

## [2.2.3] - 2026-08-05

### Changed

- Documentation and packaging metadata only — no behaviour change.

  The MCP server's source now explains its decisions rather than restating its
  code: why MCP's stdio transport is line-delimited and what happens to a client
  if you copy LSP's framing, why a tool failure is a result carrying `isError`
  rather than a JSON-RPC error and what each does to a model's next move, why
  the result cap is measured in context windows rather than milliseconds, and
  why `truncated` matters more than the cap itself.

- The npm package declares `publishConfig.provenance`, so a release published
  from CI carries a Sigstore attestation binding the tarball to the commit and
  workflow that built it. A consumer can verify it with `npm audit signatures`.

- The registry entry names its registry (`registryBaseUrl`) and how to run the
  package (`runtimeHint`), rather than leaving a client to infer both.

- Package metadata points at the author's site, and the npm page links the rest
  of the family, the Rust tools and their crates.

## [2.2.2] - 2026-08-05

### Changed

- Documentation only — no behaviour change.

  The README described a keyboard shortcut and little else. 2.2.1 added an MCP
  server that VS Code registers with agent mode, published it to npm and to the
  official MCP registry, and submitted a Zed extension — and a reader could
  discover none of it from this page. There is now a section for calling the
  tool from an agent, including the JSON config for hosts that use one and a
  one-line check that the server answers before you wire it into anything.

  The privacy section previously spoke only for the extension. It covers the
  server too, which is the part an agent actually runs.

  The registry listing gains a display name, an icon and a link to letools.dev;
  the npm page gains the badges and links it was missing. Every surface now
  points at the others.

## [2.2.1] - 2026-08-05

### Changed

- **VS Code 1.101 is now the minimum.** `engines.vscode` moves from `^1.90.0`
  to `^1.101.0` and `@types/vscode` is pinned exactly to the new floor, per the
  rule that the declared floor and the type surface must match. 1.101 is the
  first stable release carrying `registerMcpServerDefinitionProvider`, which
  the MCP integration needs — declaring the contribution point against an older
  floor would be a claim the code could not honour. Cursor and VSCodium track
  well past this; Cursor 3.6.21 reports 1.105.1.

### Added

- An MCP server, shipped inside the VSIX as `dist/mcp-server.js`. It exposes
  `extract_numbers` over stdio, so an agent can pull every number out of a document
  with its 1-based position.

  It imports the extraction engine and nothing from `vscode` —
  `check:mcp-bundle` fails the build if that stops being true, because the
  server has to run in Zed, in Claude Code, and from `npx`.

- The extension now offers that server to VS Code's agent mode, so installing
  it adds `extract_numbers` to the agent's tools alongside the existing commands.
  Nothing is downloaded at runtime: the server is the copy inside the VSIX.
  The registration is skipped on editors that do not implement the API, which
  is not an error — an editor without agent mode is not a broken install.

- The server is on npm as [`numbers-le-mcp`](https://www.npmjs.com/package/numbers-le-mcp),
  so `npx numbers-le-mcp` gives the same tool to Claude Code, Cursor, Windsurf or
  anything else that speaks MCP. It is the same build the VSIX carries, and its
  version is written from this manifest rather than maintained separately.

- A **Zed extension**, under `zed/`. Zed's extension API has no way to read the
  active buffer or register a command, so this extension could never be ported
  there in any language; a context server is the surface that fits. The crate
  is a launcher — it installs `numbers-le-mcp` and starts it with Zed's Node — so
  there is no second implementation to keep in agreement with the goldens.

  This server is the odd member of the family: an unrecognised format is not an
  error. `extractNumber` falls back to scanning plain text, so the tool takes
  `format` and `filename` as hints rather than requirements — refusing work it
  could have done would be the actual bug. It returns the values themselves in
  document order; unlike the rest of the family this engine does not carry
  positions, and inventing them at the boundary would be a claim the code
  cannot back.

### Fixed

- The coverage gate could pass against a stale summary. `coverage-readme.js`
  reads `coverage/coverage-summary.json` rather than running coverage, so when
  that file was older than the code both modes lied — the rewrite reproduced
  stale numbers and `--check` then compared the README against the same stale
  file and reported it current. Both modes now refuse a summary older than
  `src/`.

- The manifest placeholder gate only inspected `contributes.commands`, so a
  `%key%` on any other contribution point could ship as literal text. It now
  walks the whole `contributes` tree.

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
