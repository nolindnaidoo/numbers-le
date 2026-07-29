# AGENTS.md — Numbers-LE

Technical source of truth for this repo. README.md is the user-facing doc; this file is for anyone (human or agent) changing the code.

## What this is

A VS Code extension that extracts numeric values from the active document (JSON, YAML, CSV, TOML, INI, .env) into a results editor, with dedupe/sort post-processing and per-column CSV fan-out. No network access, no filesystem writes.

## Architecture

```
extension.ts            activate(): create telemetry/notifier/statusBar -> registerCommands()
commands/               one file per command; deps injected as a frozen bag
                        {notifier, statusBar, telemetry}
extraction/extract.ts   dispatcher: FileType (from filename extension) -> extractor,
                        plus the unknown-type regex fallback
extraction/heuristics.ts  THE single numeric policy: collectNumbers walker,
                        parseStrictNumber, scanTextForNumbers
extraction/formats/*.ts   one thin extractor per format: parse -> collectNumbers.
                        csv.ts owns ALL CSV parsing (csv-parse, sync + streaming
                        + parseCsvLine) — nothing else splits CSV
ui/                     notifier (window messages, gated by notificationsLevel:
                        all -> everything, important -> warn+error, silent -> error only;
                        every message passes sanitizeErrorMessage),
                        statusBar, prompts (file-type + CSV column pickers),
                        largeOutput (big-result modals)
utils/                  errors (sanitizeErrorMessage), sort (sortNumber/dedupeNumber)
config/config.ts        readConfig() snapshot; CONFIG_DEFAULTS table
types.ts                shared types only — no logic
```

Conventions: factory functions + `Object.freeze` (no classes), early returns, dependency bags typed inline at the consumer. Runtime strings are plain English; the 13 `package.nls*.json` catalogues localize **manifest** strings only (VS Code `%key%` substitution — do not add a runtime i18n layer without wiring real bundles).

## The numeric policy (extraction/heuristics.ts)

- Finite numbers only: NaN and ±Infinity are never extracted, even where the format can express them (YAML `.inf`, TOML `inf`).
- String coercion is opt-in per format: on for INI/.env/CSV (values there are inherently strings), off for JSON/YAML/TOML (`"42"` is data, not a number).
- A coerced string must be numeric **in full** — `12abc`, `1.2.3`, `1,000`, `0x1A` extract nothing.
- CSV: no header inference; every row is data; sync and streaming paths must produce identical results.
- Dates are leaves, not traversable objects.

## Invariants (things that were once broken — keep them true)

- **The bundle must be self-contained.** The VSIX ships `dist/extension.js` only; `scripts/check-bundle.js` (run in `vscode:prepublish` and CI) does a static require scan AND loads the bundle with `vscode` stubbed. esbuild uses `--main-fields=module,main` (UMD wrappers can smuggle `require` through factory parameters).
- **`CONFIG_DEFAULTS` must equal package.json defaults.** `config.test.ts` asserts parity over every declared setting; add new settings to both plus the KEY_MAP in the test.
- **Every declared setting must have a consumer.** v1 shipped 14 no-op settings; don't add a setting without wiring it.
- **Every declared command must be registered.** v1 declared `csv.toggleStreaming` without registering it — the palette entry errored for six minor versions.
- **Extractor behavior is pinned by golden snapshots** (`extraction/characterization.test.ts` + `__fixtures__/`). Any output change must update goldens in the same commit and be listed in the CHANGELOG.
- **Numeric heuristics live in one place** (`extraction/heuristics.ts`) and **CSV parsing lives in one place** (`extraction/formats/csv.ts`). Never re-implement number coercion or a CSV splitter elsewhere — v1 had four divergent walkers and three CSV splitters.
- **nls catalogues stay in key-parity:** all 12 locale files carry exactly the keys of `package.nls.json`.

## Toolchain

- **Build:** esbuild bundle (`bun run build`, `build:prod` minified). `tsc` is typecheck-only (`noEmit`) and covers test files.
- **Unit tests:** vitest; `vscode` aliased to `src/__mocks__/vscode.ts` (stateful mock with `_reset/_set` helpers). Coverage thresholds enforced: 80 lines / 80 funcs / 75 branches / 80 stmts.
- **Integration tests:** `bun run test:integration` — `@vscode/test-cli` launches a real VS Code (config in `.vscode-test.mjs`, tests compiled via `tsconfig.it.json` to `out-test/`). Integration fixtures are written to real temp files because file-type detection reads the filename extension.
- **Lint/format:** Biome (tabs, single quotes). `__fixtures__`/`__snapshots__` are exempt — formatting fixtures would corrupt goldens.
- **Packaging:** `bun run package` → `release/*.vsix`. `.vscodeignore` is an allow-list; the VSIX is ~21 files.

## Release

1. Bump `version` in package.json, add a CHANGELOG entry.
2. CI green on all 3 OSes (includes packaging + integration tests).
   Locally, `bun run package && bun run test:e2e-vsix` proves the actual
   VSIX installs and works in a clean VS Code profile.
3. `Release` workflow (manual dispatch) publishes to the VS Code Marketplace (`VSCE_PAT`) and Open VSX (`OVSX_PAT`) — Open VSX is what Cursor/VSCodium users install from. Locally: `bun run package` then `vsce publish` / `ovsx publish`.

## Known limitations (documented, not bugs)

- Results are values only — no source positions. Post-processing (dedupe/sort) operates on the flat number list, not on the original document.
- File type comes from the filename extension; untitled documents prompt for a type.
- The unknown-type fallback is a grammar-less text scan: `v1.2.3` reads as `1.2` and `0.3`.
- `@iarna/toml` rejects mixed int/float inline arrays (`[1, 2.5, 3]`) per TOML 0.5 — the file reports a parse error rather than extracting partially.
- CSV streaming mode still buffers the document text it is given (the streaming is per-record parsing, not file I/O streaming).
