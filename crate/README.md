<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/numbers-le/main/src/assets/images/icon.png" alt="numbers-le logo" width="96" height="96"/>
</p>

<h1 align="center">numbers-le</h1>

<p align="center">
  <b>Find every hardcoded number in a codebase so a person can check them</b><br/>
  <i>printed exactly as JavaScript prints them, so the two frontends never disagree</i>
</p>

<p align="center">
  <a href="https://crates.io/crates/numbers-le">
    <img src="https://img.shields.io/crates/v/numbers-le.svg" alt="numbers-le on crates.io" />
  </a>
  <a href="https://crates.io/crates/numbers-le">
    <img src="https://img.shields.io/crates/d/numbers-le.svg" alt="crates.io downloads" />
  </a>
  <a href="https://github.com/nolindnaidoo/numbers-le/actions/workflows/ci-crate.yml">
    <img src="https://github.com/nolindnaidoo/numbers-le/actions/workflows/ci-crate.yml/badge.svg" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/badge/rustc-1.88+-93450a.svg" alt="MSRV: Rust 1.88+" />
  <a href="https://github.com/nolindnaidoo/numbers-le/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="https://letools.dev/tools/numbers-le">
    <img src="https://img.shields.io/badge/web-letools.dev-00A0FF.svg" alt="letools.dev" />
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/numbers-le/main/assets/demo.gif" alt="numbers-le demo — the real binary, recorded by assets/demo.tape" width="100%"/>
</p>

> **Useful?** A star is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/numbers-le) ·
> [letools.dev/tools/numbers-le](https://letools.dev/tools/numbers-le)

Somebody has to verify that the rate in the code is the rate in the
specification. A tax percentage, a retention window, a rounding
boundary, a retry limit. In a regulated setting that check is a
deliverable, and the person doing it is an auditor or an actuary or a
compliance reviewer — usually without a checkout, always without the
editor open.

A magic-number linter does not serve them. It tells a developer to hoist
a literal into a constant; it never hands anyone the list of every
literal with its file and its line.

```bash
numbers-le --values src/ > numbers.txt
```

## Sixty seconds

```bash
numbers-le .                     # every number in the tree, as JSON
numbers-le --values config/      # just the numbers, one per line
numbers-le --dedupe --values .   # each distinct number once
cat rates.toml | numbers-le --stdin --format toml

# the point of the whole thing:
numbers-le --values --dedupe src/ | sort -n > after.txt
diff before.txt after.txt        # what constants moved this release
```

```
./config.json:2:11  8080
./rates.env:1:5  0.2
./src/pricing.ts:1:17  1.15
3 numbers in 3 files
```

**Exit codes follow grep** — `0` numbers found, `1` none found, `2` the
question was malformed. Finding none is an answer, not an error.

## Install

| Route | Command | Worth knowing |
|---|---|---|
| **cargo** | `cargo install numbers-le` | Any platform, needs **Rust 1.88+**. |
| **From source** | `git clone https://github.com/nolindnaidoo/numbers-le`<br>`cd numbers-le/crate && cargo build --release` | The same build CI runs. |

No runtime, no network, nothing written.

## How a number is printed is the contract

JavaScript numbers are IEEE-754 doubles and so are Rust's, so the values
agree by construction. **The strings do not.**

| value | JavaScript | Rust's default |
|---|---|---|
| `1e21` | `1e+21` | `1000000000000000000000` |
| `1e-7` | `1e-7` | `0.0000001` |
| `-0` | `0` | `-0` |

This tool's whole output is numbers rendered as text, so it implements
ECMAScript's `Number::toString` rather than reaching for Rust's: shortest
round-trip digits, decimal notation while `1e-6 ≤ |x| < 1e21`,
exponential with an explicit sign outside it. Both boundaries are pinned
by the corpus the extension also builds against.

That is also why `value` is a **string** in the JSON report. Re-encoding
through a JSON number would hand you whatever your parser prints, which
is the one thing this exists to control.

## What counts as a number

One policy, shared by every format:

- **Only finite numbers.** `NaN` and `±Infinity` are rejected even where
  a format can express them — YAML `.inf`, TOML `nan`. An extracted
  `Infinity` is noise to everything downstream.
- **Coercion is per format.** INI, `.env` and CSV values are inherently
  text, so `PORT=8080` is the number 8080. JSON, YAML and TOML tell `42`
  from `"42"`, and a quoted number there is data — a version pinned as a
  string, an id that must not lose its leading zero.
- **A coerced string must be numeric in full.** `12abc`, `1.2.3`, `0x1A`
  and `1_000` are rejected. `parseFloat` read the first two as `12` and
  `1.2`, and a version string quietly becoming a number is the kind of
  wrong an audit cannot see.
- **Dates are not numbers**, so a TOML datetime stays out.

**The parsers decide more than the policy does.** `0x1A` is rejected as a
coerced string in INI and accepted as `26` in YAML and TOML, because
those parsers resolve it before the policy ever sees it. Both frontends
inherit that, and the corpus pins it.

## Source languages have a literal reader

`python rust go java kotlin csharp cpp c javascript typescript sql
shellscript`, by language id or by file extension, are read by a
numeric-literal extractor: hex `0xFF`, binary `0b1010`, octal `0o755` and
legacy `0755`, separators `1_000_000` and `1'000`, suffixes `123n`,
`1.5f`, `10u32`, `100L`.

**Type names are not numbers.** `u32`, `i64`, `f32` and `usize` report
nothing. Under the text scan they reported `32`, `64`, `32` — a Rust file
yielded numbers that were never in it.

**A dialect changes an answer**, so the language is not a label: `0755`
is 493 in C, C++, Go and Java, and 755 in Rust, Python 3, Kotlin and C#.

## The text scan has no grammar

For a format nothing here parses and no language claims — Markdown, a
log, plain text — numbers come from scanning the raw text. **`v1.2.3`
reads as `1.2` and `0.3`.**

That is not a defect to report; it is what the extension does, and a scan
with no parser cannot know a version string is one token. It is why the
scan is now reserved for prose.

## Notation

Every finding carries how the literal was written — `decimal`, `hex`,
`binary`, `octal`, `scientific`, `bigint` — because `0x1A` and `26` are
the same number and not the same line of code.

**It follows coercion.** A typed format hands over a number its parser
already resolved, so JSON, YAML and TOML report `decimal`; INI, `.env`
and CSV parse their own text and keep what it said; source languages and
the text scan keep everything.

## Binary files

A NUL byte in the first 8 KiB — ripgrep's own test — and the file is
never opened as text: no report line, no effect on the exit code, and a
count on stderr so coverage is never overstated silently. A file that
*is* text and could not be read keeps its named diagnostic and still
fails `--strict`.

## Positions, and where they stop

Each number is reported with its file and, where it can be found, a
1-based line and column in **UTF-16 units** — the number your editor
shows.

Finding it is harder than for text, because a number's source and its
printed form are often different: `0x1A` is reported as `26`, `+7` as
`7`, `1e21` as `1e+21`. So the search is **by value, not by text** — scan
the document for numeric runs, and pair each number with the next run
that parses to the same double.

Two consequences, both honest:

- A run the scanner cannot see — a hex literal, an underscored literal —
  has no offset to give. That number reports no position and
  `summary.unlocated` counts them.
- A run in a *key* can take the match. In `k26 = 0x1A` the extracted `26`
  finds the digits in the key. The number is right; the position is a
  best effort, and it is forward-only so it can never point above a
  number already reported.

JSON, the source languages and the text scan skip all of that: JSON
walks an AST with real ranges, and the other two *are* scanners — which
is why a hex literal is placed in a `.rs` file and unplaced in a `.toml`
one.

## It has no opinions

No magic-number heuristic. No range check. No "this looks like a rate"
guess. No arithmetic, and nothing is ever rewritten.

Which numbers matter is the reviewer's call, and a tool that pre-filtered
would decide the audit before the auditor saw it. A contract test asserts
no flag asks for a judgment.

## Options

```
--dedupe             collapse repeated values to their first occurrence
--format <format>    force a format instead of inferring from the name;
                     an unknown name falls back to a text scan
--strict             exit 2 if a text file could not be read
--values             print only the numbers, one per line, for piping
--stdin              read one document from stdin
--hidden             walk hidden files and directories too
--no-ignore          walk files that .gitignore excludes
```

## As an MCP server

```bash
numbers-le mcp
```

Two tools, both returning `{ ok, data, diagnostics, meta }`:

- **`extract_numbers`** — content in, numbers out, no positions. Touches
  no filesystem. The npm server ships the same tool with byte-identical
  output, tokens included; one corpus runs against both.
- **`numbers_le_scan`** — files or directories in, the same reports the
  CLI writes, positions included.

## The other four ways to run it

| Where | What you get | Install |
|---|---|---|
| **VS Code** | The same extraction, in your editor, on a keystroke | [Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le) |
| **Cursor, VSCodium, Windsurf** | The same extension | [Open VSX](https://open-vsx.org/extension/OffensiveEdge/numbers-le) |
| **Any MCP agent, via Node** | `extract_numbers` over stdio | `npx numbers-le-mcp` · [npm](https://www.npmjs.com/package/numbers-le-mcp) |
| **Zed** | The MCP server as a context server | [add it by hand](https://zed.dev/docs/ai/mcp) *(no listing yet)* |

All sixteen LE tools are on **[letools.dev](https://letools.dev)**.

## Documentation

| What | Where |
|---|---|
| What this tool is allowed to say — scope, output contract, refusals, non-goals | [SPEC.md](https://github.com/nolindnaidoo/numbers-le/blob/main/crate/SPEC.md) |
| How the code is written and held together — architecture, invariants, the gates | [AGENTS.md](https://github.com/nolindnaidoo/numbers-le/blob/main/crate/AGENTS.md) |
| The VS Code extension this shares its extraction with | [README.md](https://github.com/nolindnaidoo/numbers-le/blob/main/README.md) |
| What changed | [CHANGELOG.md](https://github.com/nolindnaidoo/numbers-le/blob/main/crate/CHANGELOG.md) |
| The tool's page, and the other fifteen | [letools.dev/tools/numbers-le](https://letools.dev/tools/numbers-le) |

## More from the LE family

Sixteen single-purpose tools for the work in front of every model. Each ships
a Rust CLI and an MCP server. One page: **[letools.dev](https://letools.dev)**

**Get it out**

- **[String-LE](https://letools.dev/tools/string-le)** — Extract every string in a codebase, with its position, so a person can read them
- **[Numbers-LE](https://letools.dev/tools/numbers-le)** — Extract every hardcoded number in a codebase, so a person can check them
- **[Units-LE](https://letools.dev/tools/units-le)** — Extract every quantity with its unit, normalized, and refuse the ambiguous ones by name
- **[Dates-LE](https://letools.dev/tools/dates-le)** — Extract every date and timestamp, and the exact instant each one resolves to
- **[IDs-LE](https://letools.dev/tools/ids-le)** — Extract every UUID, ULID, NanoID, ObjectId and Snowflake, and decode the time inside
- **[IPs-LE](https://letools.dev/tools/ips-le)** — Extract every IP address, CIDR block and MAC, normalized and classified by scope
- **[URLs-LE](https://letools.dev/tools/urls-le)** — Extract every URL in a codebase, with its protocol and exact position
- **[Paths-LE](https://letools.dev/tools/paths-le)** — Extract every file path in a codebase, and say whether it still points at anything
- **[Colors-LE](https://letools.dev/tools/colors-le)** — Extract every color in a codebase, and say which ones are not in your palette

**Check it**

- **[Regex-LE](https://letools.dev/tools/regex-le)** — Find every regex in a codebase, and report which can be driven into catastrophic backtracking
- **[Versions-LE](https://letools.dev/tools/versions-le)** — Find where one dependency is constrained differently across a repository's manifests
- **[i18n-LE](https://letools.dev/tools/i18n-le)** — Identify the i18n library a project uses, then audit its catalogs by that library's rules
- **[Scrape-LE](https://letools.dev/tools/scrape-le)** — Check whether a page is scrapeable before the scraper is written, and say when it cannot tell

**Guard it**

- **[Secrets-LE](https://letools.dev/tools/secrets-le)** — Find hardcoded credentials in a codebase, and never print one into the report
- **[EnvSync-LE](https://letools.dev/tools/envsync-le)** — Compare the dotenv files in a tree, and say which keys are missing from which
- **[Unicode-LE](https://letools.dev/tools/unicode-le)** — Find the Unicode that hides meaning — bidi controls, invisibles, homoglyphs, mixed scripts

Each stands on its own: no shared crate, no published core. Where two of them
agree, it is because the same answer was right twice.

**Contact** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## Also by nolindnaidoo

**Rust** — pixelcoords and pixelactions are one loop: pixelcoords answers
*where*, pixelactions *acts* there. Their own tools, their own voice — not
part of the LE family.

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)

## License

MIT — see [LICENSE](https://github.com/nolindnaidoo/numbers-le/blob/main/LICENSE).
