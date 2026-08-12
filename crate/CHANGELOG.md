# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A numeric-literal extractor for twelve source languages** —
  `python rust go java kotlin csharp cpp c javascript typescript sql
  shellscript`, by language id or by file extension, including the React
  ids. It reads hex `0xFF`, binary `0b1010`, octal `0o755` and legacy
  `0755`, digit separators `1_000_000` and `1'000`, and suffixes `123n`,
  `1.5f`, `10u32`, `100L`, `1.5e3f64`.

  **`u32` and `i64` are type names, not the numbers 32 and 64.** That is
  the defect this exists for: the text scan these files used to go
  through splits on any non-digit, so it reported `0` and `755` for
  `0o755`, `1`,`0`,`0` for `1_000_000`, and `32`/`64` for `u32`/`u64`. A
  Rust file yielded numbers that were never in it.

  A dialect changes an answer, so the languages resolve to their own
  names rather than to one key: `0755` is 493 in C, C++, Go and Java and
  755 in Rust, Python 3, Kotlin and C#; `1_000` is one thousand in Rust
  and the number 1 in C; `123n` is a BigInt in JavaScript alone.

- **A `notation` on every finding** — `decimal`, `hex`, `binary`,
  `octal`, `scientific`, `bigint` — on both the CLI report and the MCP
  tool, under that one name on both.

### Changed

- **Behaviour change: `data.numbers` in `extract_numbers` is an array of
  `{ value, notation }` rather than an array of bare numbers.** The value
  is still a JSON number carrying the token this crate rendered, so
  `1e+21` is still `1e+21`. Both servers moved together and the shared
  corpus pins the new shape.

- **Behaviour change: the CLI report's `numbers[]` entries carry
  `notation`** alongside `value`, `line` and `column`.

- **Behaviour change: a source file no longer reports `format:
  "unknown"`.** It reports its language, and its numbers come from the
  literal reader.

- **Behaviour change: a binary file produces no report line.** A NUL byte
  in the first 8 KiB — ripgrep's own test — means the file was never a
  text candidate: it is not opened, not reported, and never affects the
  exit code. It is counted on stderr (`16 binary files skipped`) and in
  the scan tool's `data.binaryFiles`, so coverage is never overstated
  silently.

  It previously came back as a `skipped` report, which made `--strict`
  exit 2 on any repository holding an image — every repository — and so
  made the flag useless in CI. A file that *is* text and could not be
  read keeps its named `skipped` diagnostic and keeps failing `--strict`;
  that distinction is the point.

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

### Fixed

- **A leading byte-order mark is no longer part of the document.** Three
  invisible bytes, added by Notepad, Excel and a PowerShell redirect, and
  stripped by VS Code before the extension ever sees a file — so the two
  frontends read the same file differently. It shifted every column on
  line one, and before a `{` it made a structured parser reject the whole
  document, which is indistinguishable from a file with no numbers in it.

- **A file that cannot be read no longer fails the run.** Every
  repository has a PNG, a zip and something the runner lacks permission
  for. Exiting 2 on those made the tool unusable in CI, which is the one
  place it is most worth running. Such a file is now named on stderr and
  carried in the report with a `skipped` diagnostic, and the exit code
  reflects what was found. `--strict` restores the old behaviour for a
  pipeline that wants zero tolerance.

- **A file that is not text is named rather than dropped.** It used to
  vanish from the report entirely, which reads to whoever ran it as
  "that file was clean".
