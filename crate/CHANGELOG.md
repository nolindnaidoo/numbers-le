# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-11

First release. The extension's extraction engine, ported and pinned
against a shared corpus, over a tree instead of a buffer.

### Added

- **All seven extractors** — JSON, YAML, TOML, INI, dotenv, CSV and the
  plain-text scan — reproducing the extension's numbers, in its order,
  for every case in `fixtures/`. That includes the parts worth stating:
  only finite numbers, coercion per format rather than per call, a
  coerced string that must be numeric in full, and dates that are not
  numbers.
- **JavaScript's number rendering**, implemented rather than
  approximated. `1e+21`, `1e-7`, `5e-324` and `-0` all print the way the
  extension prints them, and the corpus pins both notation boundaries.
- **Positions**, which the extension does not produce: the file always,
  and a 1-based line and column found by matching *values* against the
  document's numeric runs — because a number's source and its printed
  form are often different. A value the scan cannot see reports none,
  with the count in the summary.
- **The CLI**: JSON reports on stdout one per line, a human summary on
  stderr, and exit codes following grep — 0 numbers found, 1 none found,
  2 the question was malformed. `--dedupe`, `--format`, `--values`,
  `--stdin`, `--hidden`, `--no-ignore`.
- **The MCP server** (`numbers-le mcp`) with two tools:
  `extract_numbers`, shared byte-for-byte with the npm server — tokens
  included — and `numbers_le_scan`.

### Known divergences

Written down rather than left to be discovered, each pinned by a test.

- **TOML versions.** The `toml` crate is 1.0 and reads a mixed inline
  array; `@iarna/toml` is 0.5 and refuses one.
- **Refusal messages.** They come from whichever parser refused, so the
  text cannot match. What matches is that both refused, both reported
  it, and both returned nothing.
- **A position can match a key.** Numbers are located by value against
  the document's numeric runs, so in `k26 = 0x1A` the extracted `26`
  finds the digits in the key. The number is right; the position is a
  best effort, and forward-only so it can never point above a number
  already reported.

[0.1.0]: https://github.com/nolindnaidoo/numbers-le/releases/tag/crate-v0.1.0
