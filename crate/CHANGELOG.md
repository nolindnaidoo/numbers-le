# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-12

The numbers this reports out of a source file are now the numbers that
are actually written in it, and a number too large for a double is
printed exactly as it was found rather than quietly rounded.

### Added

- **Numeric literals in twelve source languages** — Python, Rust, Go,
  Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL and shell, by
  language name or by file extension. Hex `0xFF`, binary `0b1010`,
  octal `0o755` and legacy `0755`, digit separators `1_000_000` and
  `1'000`, and suffixes `123n`, `1.5f`, `10u32`, `100L`, `1.5e3f64`.

  **`u32` is a type name, not the number 32.** A `.rs`, `.py` or `.ts`
  file used to go through a text scan with no grammar, which splits on
  the first character that is not a digit: `0o755` came back as `0` and
  `755`, `1_000_000` as `1`, `0` and `0`, and `u32`, `i64`, `f32` and
  `usize` as `32`, `64`, `32` and `64`. A source file yielded numbers
  that were never written in it, which is the one thing a tool built for
  checking constants cannot do.

  **Expect your counts to fall, and that is the fix.** On one real Rust
  codebase the results lost 757 phantom `32`s and 402 phantom `64`s —
  every one of them a type annotation. If you hold a baseline from an
  earlier version, it will shrink the first time you re-run, and the
  numbers that disappear are the ones that were never there.

  A dialect changes an answer, so each language keeps its own name
  rather than sharing one: `0755` is 493 in C, C++, Go and Java and 755
  in Rust, Python 3, Kotlin and C#; `1_000` is one thousand in Rust and
  the number 1 in C; `123n` is a BigInt in JavaScript and TypeScript and
  nowhere else. Comments and strings are read too, deliberately — a
  threshold quoted in a docstring is exactly as interesting to whoever
  is checking it as one in an expression.

- **Every finding says how it was written.** A new `notation` on each
  number — `decimal`, `hex`, `binary`, `octal`, `scientific` or
  `bigint` — on the CLI report and on the MCP tool, under that one name
  on both. `0x1A` and `26` are the same number and not the same line of
  code, and until now a report could not tell you which one you were
  looking at.

  It describes the **literal**, not the value, so it follows what the
  document could express. JSON, YAML and TOML resolve a literal before
  this tool sees it, so those say `decimal`; INI, `.env`, CSV, the
  twelve source languages and the plain-text scan keep what the text
  said.

### Fixed

- **A very large number came back as a different number.** Asking the
  `extract_numbers` tool for `123456789012345680000` returned
  `1.2345678901234567e+20` — not another way of writing the same value,
  a different one, and a different token from the one the npm server
  writes for the same document. For a tool whose entire output is
  numbers reported exactly, that was the worst kind of wrong: quiet, and
  only visible to someone who already knew the answer. Every number now
  reaches you as the text this tool rendered, untouched.

- **A format name with an invisible character at the front now
  resolves.** A byte-order mark is what a spreadsheet export, Notepad
  and a PowerShell redirect all leave behind, and passing
  `format: "<BOM>json"` used to fall through to a plain text scan
  instead of parsing JSON — which then read a quoted `"42"` as a number,
  because quoted numbers are data in JSON and text in a `.env` file. The
  same character at the front of a CSV cell, an INI value or a `.env`
  value stopped it being read as a number at all. Whitespace is now
  judged exactly as the editor extension judges it, everywhere.

- **One unreadable directory no longer hides the whole tree.** A folder
  the operating system refused ended the run: exit 2, and not a single
  report line, so a scan of ten thousand files answered nothing because
  one of them was locked. Exit 2 means the *question* was malformed — an
  unknown flag, a path that does not exist. A directory that cannot be
  opened is now named in the report and on stderr, counted as
  unexamined, and left to `--strict` to turn into a failure.

- **Report paths use `/` on every platform.** They contained `\` on
  Windows, so a report produced there could not be diffed against one
  produced anywhere else.

### Changed

- **A source file reports its language, not `unknown`.** `pricing.ts`
  comes back as `typescript`. Anything still unrecognised — Markdown, a
  log, plain text — is a text scan as before.

- **`data.numbers` from `extract_numbers` is a list of
  `{ value, notation }` objects**, where it was a list of bare numbers.
  A consumer reading `data.numbers[0]` as a number needs a one-line
  change to `data.numbers[0].value`. Both servers moved together — it is
  one tool with two implementations — and the shared corpus pins the new
  shape. The CLI report's entries gained `notation` beside `value`,
  `line` and `column` in the same way.

- **A binary file produces no report line at all.** A NUL byte in the
  first 8 KiB — ripgrep's own test — means the file was never a text
  candidate: it is not opened, not reported, and cannot affect the exit
  code. It is counted on stderr (`16 binary files skipped`) and in the
  scan tool's `data.binaryFiles`, so you still know the scan covered
  fewer files than the tree holds.

  It used to come back as a file that could not be read, which made
  `--strict` exit 2 on any repository holding an image — every
  repository — and so made the flag useless in CI, the one place it is
  most worth having. A file that genuinely *is* text and could not be
  read still says so, and still fails `--strict`.

### Known divergences

Two places where this and the editor extension answer differently on
purpose, both recorded in [SPEC.md](SPEC.md) with a test holding each
side to what it actually does.

- **A TOML integer at or above 2^53 (9,007,199,254,740,992).** The
  extension reports nothing for one — its TOML parser hands back a value
  its numeric walk does not recognise, and the number silently vanishes
  from the results. This reports it, as the same double JavaScript would
  give. **Trust this one.** Larger still, past the 64-bit range TOML
  allows, this refuses the document and says why — that document is not
  valid TOML — where the extension's parser wraps the value round to a
  negative number that appears nowhere in the file, and then drops that
  too.

- **An INI value led by U+0085.** The two INI parsers disagree about
  whether that character is whitespace, so `rate = <U+0085>42` is the
  number 42 here and ordinary text there.

### Internal

- Six CI jobs, each because something real reached a release: hazardous
  inputs and platform behaviour on macOS, Windows and Linux; ~2,500
  generated documents put through both MCP servers; a fuzz net over the
  literal reader and the numeric policy; a wall-clock budget; and a
  check that every file type this claims to open, opens. The rounding
  bug, the byte-order-mark bug, the unreadable directory and the Windows
  paths above were all found by them.

- Corpus documents for Kotlin, C#, C++, C, JavaScript, SQL and shell,
  which were offered as formats with nothing pinning their behaviour
  against the extension.


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

[0.2.0]: https://crates.io/crates/numbers-le/0.2.0
[0.1.0]: https://crates.io/crates/numbers-le/0.1.0
