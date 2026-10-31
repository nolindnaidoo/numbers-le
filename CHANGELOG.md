# Changelog

All notable changes to Numbers-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**, the npm MCP server and the
npm command line. The Rust CLI in `crate/` keeps its own
[CHANGELOG](crate/CHANGELOG.md). From 2.6.0 every surface carries one
version and releases from one tag.

## [Unreleased]

### Fixed

- The extension's MCP server, the one `numbers-le-mcp` and the editor run, died
  on an unhandled EPIPE with a Node stack trace when the client closed the
  pipe, which a host logs as the server crashing. It exits 2 quietly at the
  first reply it cannot write, as the crate's server and the npm command
  line do.
- The npm command line's MCP server joined the chunks of a line in progress
  on every chunk, copying the whole line so far each time, so a 16 MiB line
  cost about a gigabyte of transient copies on its way to the frame limit.
  It joins them once, at the newline.

## [2.8.0] - 2026-10-27

### Changed

- The MCP servers refuse a tool argument that does not fit the tool's
  schema as a JSON-RPC error, `-32602`, where it was a result carrying
  `isError`: a missing `content`, a `maxResults` that is not a whole number
  of one or more, a `format`, `filename` or `path` that is not a string, a
  `dedupe`, `hidden` or `ignored` that is not a boolean, and any argument
  the schema does not declare, which `additionalProperties: false` now
  enforces. A wrong type on an optional argument was read as absent before,
  so `format: 7` scanned the text and `hidden: "yes"` walked nothing
  hidden. A path that is not there stays the tool's own failure, `isError`,
  because that is a fact about the filesystem and not the schema. All three
  servers refuse in the same words.

### Fixed

- The npm command line's stdout wrapper answered nothing where the stream
  answers whether the pipe is full, so the MCP server wrote around it to
  wait for a slow client. It answers the stream's own boolean now, as
  envsync-le's does, and the server waits for drain through it.
- The help document is in the display language. Every sentence in it goes
  through the bundle now, in all twelve locales; format names, setting keys,
  defaults and links stay as they are. A German host reads it back in German
  in the integration suite, which is the first runtime string a real host
  has shown in a language other than English.
- The npm command line passed over a symbolic link in a walk without a
  word. It is still never followed, by design; it is counted now, `N
  symbolic links not followed` on stderr and `symbolicLinks` in the scan
  tool's envelope, as binary files are counted. The crate does the same.
- The npm command line's `numbers_le_scan` tool answered `ok: true` with
  empty `diagnostics` for a tree holding a file it could not read: the
  envelope's filter looked for a severity no report carries. A skipped file
  is named in the envelope now, as `unreadable`, on the crate's server too.
  The dead "incomplete" exit branch that same severity fed is gone on both.
- The npm command line dropped a FIFO, a socket or a device without a word:
  one in a tree vanished from the report, and one named outright answered
  "0 numbers in 0 files". Each is a `skipped` report now, `not a regular
  file`, never opened (a read on a pipe with no writer never returns), and it
  fails `--strict` as any unread input does. The crate does the same.
- Deduplicate and Sort in place replaced the whole document with a result
  computed from the text as it was before the sort picker opened, so an edit
  made while the picker was open was overwritten without a word. The command
  now compares the document version and writes nothing if it moved, saying so.
- 155 translated values did not fit their place. A count placeholder was
  read as a format or a name in nine locales ("Detected {0} numbers" as
  "numbers of type {0}", "opening {0} documents" as "documents in format
  {0}", "Sorted {0} numbers" likewise); "number" was the word for a phone
  number in de, fr, ja, ko, ru, uk and id; "Column" was a newspaper column
  in ten; "Extraction" was decompression in seven; the status bar tooltip
  kept "Run" in English in all twelve, and es and zh-cn translated the
  product name. French dropped the "out of range" sentence, Indonesian
  titled the sort command "Spelling", and Vietnamese's "agent mode" was a
  sales agent. Each reads as what it names now.
- Eleven strings were shown in English in every display language: the
  status bar's "Extracted N", "Copied to clipboard", "Dedupe/Sort applied"
  and "CSV opened", the dedupe and sort counts, the "Failed to extract
  numbers" and unclosed-quote CSV errors. Each goes through the bundle now,
  in all twelve locales, and a test reads the source for a literal handed to
  a notification, the notifier or the status bar.
- The help document claimed CSV streaming, which nothing implements, said
  results open beside the editor only when a setting is on when that is the
  default, repeated a Quick Start step, named six formats where the
  extension reads twenty, and left six settings out. It now states every
  setting with the default the manifest declares, and a test holds it there.
- Picking an unnamed CSV column by its generated `(Column N)` label fell to
  all columns in every display language but English: the label shown was
  translated and the pick was matched back against the English literal. Two
  header columns sharing a name always picked the first. The pick carries
  its index.
- The three MCP servers this repository ships answered a malformed frame
  three different ways. The extension's server echoed whatever protocol
  version the client asked for, where the other two answer their own; it
  answered a request carrying a null id, which the other two read as a
  notification; and the npm command line and the crate dropped a frame that
  was not JSON, or not UTF-8, without a word, where the extension's server
  refused it with a parse error, and held a frame of any size where the
  extension's server refuses one over 16 MiB. All three now answer alike, in
  the same words: `Invalid JSON`, `Not a JSON-RPC 2.0 request`, `Unknown
  method: …`, `Unknown tool: …` and `tools/call requires a string `name``.
  The npm command line also waits for a slow client to drain the pipe before
  reading the next frame, as the crate's blocking write does.
- The npm command line's `numbers_le_scan` tool dropped a `paths` entry that
  was not a string without a word, so `["dir", 7]` was answered for `dir`
  alone; the crate's server did the same. The entry is named, and a `path`
  that is not a string is refused as such, in the same words on both.
- `numbers-le --help` said a `.ts` or `.sql` file falls back to the text
  scan. Since 0.2.0 a source file is read by its language for its literals;
  the text says so, on the npm command line and the crate alike.
- A file-type prompt the editor tore down was reported as "Document is no
  longer valid", which was false. The prompt no longer sits inside the guard
  that reads the document, so the failure is reported as what it was.
- Extract reported success by what it had decided to do, not by what
  happened. A results document the editor refused to open still flashed
  `Extracted N` in the status bar, logged an extraction and counted toward
  the rating prompt; the CSV fan-out said "CSV opened" when every column
  document was refused, and said nothing at all when no chosen column held a
  number. Each path now reports what reached the user, and a refusal the host
  throws as something other than an `Error` is reported rather than
  swallowed.
- The plain-text scan read `٣5` as the number 5: its digits were ASCII, so a
  run opening with a digit from another script lost that digit and reported
  the rest, where the crate's server consumed the run whole and reported
  nothing. The scan's digits are now Unicode's, and a run holding any digit
  the parse cannot read is consumed and refused, on the shared tool and in
  the editor alike. The corpus pins `rate ٣5 and 🎯 7`.
- `.env.local`, `.env.production` and the rest of the dotenv family prompted
  for a file type in the editor, and the MCP server read them with the text
  scan, which has no comment rule, so a commented-out `# OFF=600` became a
  finding the crate's server, reading dotenv, never reported. The server's
  resolver follows the crate's rule, `.env` and everything after it, and is
  now the one resolver the extension and the npm command line read through;
  a format name is also stripped of every leading dot, as the crate strips it.
  The corpus pins `.env.local`.
- The MCP server and the npm command line read `maxResults` written as an
  integer-valued float or exponent, `2.0`, `1e3` or `1E20`, differently from
  the crate's server, which refused the first two and the command line the
  third. JSON Schema's `integer` is any number with a zero fractional part,
  and all three servers now read it so: a whole number of one or more,
  clamped at the ceiling. The corpus pins `2.0`.
- A CSV whose header row is written in a script without Latin letters, such
  as Japanese or Cyrillic, was read as a file without a header and asked for
  column indexes by number. A letter in any script makes a header.
- Deduplicate and Sort read the empty last line of a document that ends in a
  newline, a blank line and a CRLF line ending as the number 0, so a list of
  three numbers deduped to the three and a 0 the file never held, and the
  count said so. Blank lines are not numbers.
- The MCP server answered a `filename` or `format` that is an
  `Object.prototype` name, such as `constructor` or `__proto__`, with a
  function or an object for its file type. It answers as it does for any
  unknown format.
- A number setting cleared to an empty string or null read as 0 and was
  clamped to its floor, so the size guard became 1,000 bytes. It falls back
  to the default.
- The MCP server held every byte of a frame until its newline, with no
  ceiling, so a client that streamed without one grew the process without
  bound and got no answer. A frame over 16 MiB is refused with a parse error
  and the next line is served.
- A failure inside a command, such as the editor refusing to open a document
  or a dialog going away, escaped as an unhandled rejection the editor
  reported in its own words, home directory included. Every command reports
  it as one redacted, localized error.
- The crate release workflow read a crates.io answer it could not parse, or
  a failed request, as "unpublished" and would have let the publish run. It
  refuses to publish without a version list.

## [2.7.1] - 2026-10-18

### Changed

- **The listing carries the words people search for.** Open VSX ranks a
  match in the name five times a match in the description, and "Numbers-LE"
  holds "numbers" but not "number", which Open VSX does not match to it, so
  a search for "number" put it 14th on 2026-10-18. The name is "Numbers-LE:
  Number Extractor", the description opens with "Number extractor", where a
  card has room for about forty characters, and the keywords are cut from 30
  to 8 phrases someone would search for.

## [2.7.0] - 2026-10-17

### Removed

- **The `numbers-le.csv.streamingEnabled` setting and the Toggle CSV
  Streaming command.** They promised incremental CSV parsing for large files
  and never delivered it: both paths read the whole document, parsed it the
  same way and wrote each result in one edit. Turned on, the setting left an
  empty tab for a column with no numbers, skipped the large-output prompt for
  a single-column extraction, and reported errors untranslated. CSV
  extraction now always takes the path the default already used, and the
  help no longer recommends the setting for large files.

### Fixed

- **Choosing one CSV column extracts that column.** The picker's single
  choice, by header name or by index, was never read: the extraction returned
  every number in the file, header row included. It now returns the chosen
  column's numbers, below the header when the column was picked by name.
- **Extracting several CSV columns reads a quoted field that holds a line
  break as one cell.** The document was split on newlines before parsing,
  which cut such a record in two and could read a number out of its second
  half. It is now read as records with the shared CSV parser.
- **`mcp` no longer ends the session on a frame that is not UTF-8**, in
  the crate or the npm package. Such a frame is dropped like one that is not
  JSON, and the requests after it are served. The npm server reads frames
  with `src/cli/frames.ts`, the crate server's framing in one file shared
  across the family, and `check:cli-pipes` now feeds both servers eighteen
  malformed frames and requests and compares the answers.
- **Every parsed format now reads exactly as the Rust crate does.** The
  extension, the npm MCP server and the npm command line parsed JSON,
  JSONC, YAML, TOML, INI, CSV and dotenv with npm libraries
  (`JSON.parse`, js-yaml, `@iarna/toml`, `ini`, csv-parse, dotenv) that
  accept and refuse different documents from the crate's, and word their
  refusals differently. They now parse with transcriptions of the crate's
  own parsers in `src/parsers/`, shared with units-le. What changed for a
  user:
  - A refused document is refused in the crate's words.
  - A TOML inline array of mixed types (`[1, 2.5]`) is read, as TOML 1.0
    allows, instead of refused.
  - A TOML integer at or above 2^53 is reported instead of silently
    dropped, and one past 64 bits refuses the document.
  - A JSON key repeated in one object counts every time, as does a key
    repeated in a dotenv file.
  - A broken INI section header refuses the file instead of yielding
    values, and an INI value led by U+0085 is the number after it.
- The CLI parity and the differential compare refusals word for word,
  and the CLI parity tree holds a broken document of every parsed format.

## [2.6.2] - 2026-10-17

### Fixed

- **The npm command line no longer crashes when its reader goes away.**
  A reader that closed stdout early, as `| head` does, got a Node stack
  trace and an exit code of 1, or 0 in some tools. It now gets what the
  Rust CLI prints, `numbers-le: could not write the report: Broken pipe (os error 32)`, and exit 2.
  A reader that closes stderr early no longer stops the run, and stdout
  is written in full. `numbers-le mcp` exits 2 without a word when it cannot
  write a reply, as the crate's server does.
- The listing on stderr now follows the reports written to stdout before
  it, as the crate's does. `scripts/check-cli-pipes.ts` closes each pipe
  under both binaries on macOS, Windows and Linux and fails on any
  difference.

## [2.6.1] - 2026-10-17

### Fixed

- **The npm command line no longer cuts off the end of stderr.** It exited
  once stdout had drained, while stderr could still hold the end of the
  listing and its summary line. On macOS and Windows a pipe writes
  asynchronously, so a reader slower than the writer lost them. It now
  exits once both streams have drained.

## [2.6.0] - 2026-10-16

### Changed

- **One version for every surface.** The extension, the MCP server on
  npm, the new npm command line and the Rust crate all release as 2.6.0
  from the tag `v2.6.0`. The crate jumps from 0.4.4 to join them, and CI
  now fails a commit where any of them disagree.

### Added

- An npm command line, `numbers-le`, built in `cli/` from `src/cli/`. It is
  the Rust CLI's surface over this extension's extraction engine: the same
  flags, walk, positions, exit codes, JSON Lines and stderr listing, and
  `numbers-le mcp` serves the same two tools with the same bytes.
  `scripts/check-cli-parity.ts` runs both binaries over one tree on three
  operating systems and fails on any byte of difference other than the
  words a parser uses to refuse a broken document. It is published as
  `numbers-le` on npm, beside `numbers-le-mcp`.

### Fixed

- The rating prompt's Rate button opened the Marketplace review page for
  every install, including one from Open VSX in VSCodium, Cursor or
  Windsurf, because it told the registries apart by a publisher name the
  Open VSX listing does not carry. It reads the editor's name instead, and
  an Open VSX install rates on Open VSX.

## [2.5.0] - 2026-10-07

### Added

- A rating prompt. On the 3rd successful use, one notification asks whether
  you would rate the extension, with *Rate*, *Later* and *Don't Ask Again*.
  *Rate* opens the registry your copy was installed from: the VS Code
  Marketplace or Open VSX. *Later*, or dismissing it, asks once more on the
  20th use; that second ask is the last. It never appears on activation or
  after a failed run, and it is never shown if you have set
  `notificationsLevel` to `important` or `silent` yourself. The answer
  follows you through Settings Sync. Translated into all 12 locales.
- Positions are now a setting. `numbers-le.showPositions` decides whether the
  output gives the line and column of each number, and
  `numbers-le.clipboardIncludesPositions` decides the same for the copy on the
  clipboard. Both are off by default, so the output is what it was. Positions
  are known for JSON, source code and plain text. For TOML, YAML, INI, CSV and
  dotenv there are none to show, and the extension says so rather than guess.
  With positions shown, Sort still orders by the number and keeps each
  position with it, and Dedupe keeps the first occurrence of a number, with
  that occurrence's position.

### Changed

- No command is bound to a key by default any more. The one default this
  extension shipped sat on a key the editor, the system or another LE
  extension already used. Every command can still be given a key under
  Keyboard Shortcuts.

## [2.4.3] - 2026-10-04

### Fixed

- The Open VSX links and the Open VSX downloads badge in the README, the npm
  README and the Help command pointed at a namespace the listing has left, so
  they led nowhere. The listing is under `nolindnaidoo` now, and so are they.

### Removed

- The Zed extension in `zed/`, with the CI job that built it and the workflow
  that synced it. It was never listed in Zed's registry.

## [2.4.2] - 2026-10-03

### Fixed

- **`.jsonc` and `.tsv` were read as JSON and CSV.** A comment in a `.jsonc`
  failed the strict JSON parse, and a `.tsv` was split on commas, so neither
  gave the right answer — in the editor and from the npm server. Both are now
  read the way the Rust CLI has read them since August: JSONC tolerates
  comments and trailing commas, TSV splits on tabs.
- **`.conf` and `.cfg` were read as INI.** A redis or nginx config has no
  sections and no `=`, and the INI reader took it as a valid document holding
  nothing. Both are scanned as text, as the CLI reads them.
- The npm server's `format` list now offers `jsonc` and `tsv`, which it
  accepts, and its README names them.

### Added

- `scripts/check-mcp-definition.ts`, run in CI after the differential: it fails
  when the two servers define the shared MCP tool differently — its
  description or any part of its schema. Six of the ten had drifted.
- The npm README test also checks that every value an argument offers is
  named in that argument's row.

## [2.4.1] - 2026-10-03

### Fixed

- **The npm README described a URL extractor.** Its opening line, its argument
  table, what the tool returns and its example were all copied from `urls-le-mcp`
  when the package was created. It now documents `extract_numbers` as the code defines
  it, and the example is an answer the server actually gives.
- The npm README's list of the family's Rust tools left out `dates-le`.

### Added

- `src/mcp/readme.test.ts` holds the npm README to the tool it documents: the
  heading names the tool, the argument table lists exactly the schema's
  arguments, the required ones are marked, the example is this tool's answer,
  and the opening sentence names what the tool works on.

## [2.4.0] - 2026-09-30

### Added

- **The shared `extract_numbers` tool reports where each number is**, as
  its siblings do: a 1-based line and UTF-16 column for JSON, the source
  languages and plain text, where the scanner knows the exact offset. A
  parsed format (YAML, TOML, CSV, INI, dotenv) still carries no position:
  its parser hands over resolved values, and placing one would be a search
  for its digits, which can land in a key. Both servers answer the same.

## [2.3.1] - 2026-08-16

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
