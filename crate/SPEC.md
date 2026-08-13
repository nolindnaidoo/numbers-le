# numbers-le — Rust specification

A port of the [Numbers-LE](https://github.com/nolindnaidoo/numbers-le)
VS Code extension to a Rust CLI and MCP server: get every number out of
a codebase so a person can check them.

**One answer is held equal; the surfaces are not.** The shared
`extract_numbers` MCP tool must return the same numbers, their order, and **the text they are printed as**
from either server — a difference there is a bug. Everything else is
IDE-first in the extension and terminal-first here, and is meant to
differ. See "Deliberate divergences".

## The one question

**What numbers are hardcoded in here, and are they the right ones?**

Asked over a whole tree rather than a buffer, answered into a file
someone can check against a specification.

## Who asks it

Not the author. Someone verifying a calculation: a rate, a threshold, a
multiplier, a rounding boundary, a retention window. In a regulated
setting that check is a deliverable and the person doing it is an
auditor, an actuary, a compliance reviewer — often without a checkout and
always without the editor open.

A magic-number linter does not serve them. It tells a developer to hoist
a literal into a constant; it never hands anyone the list of every
literal with its file, its line, and the text around it. That list is
what this produces.

## The hard part: how a number is printed

JavaScript numbers are IEEE-754 doubles and so are Rust's, so the
*values* agree by construction. **The strings do not.**

| value | JavaScript | Rust `{}` |
|---|---|---|
| `1e21` | `1e+21` | `1000000000000000000000` |
| `1e-7` | `1e-7` | `0.0000001` |
| `1.7976931348623157e308` | `1.7976931348623157e+308` | `17976931348623157…` (309 digits) |
| `5e-324` | `5e-324` | `0.000…005` |
| `-0` | `0` | `-0` |

This tool's whole output is numbers rendered as text, so the rendering
**is** the contract. `format.rs` implements ECMAScript's
`Number::toString`: shortest round-trip digits, decimal notation while
`1e-6 ≤ |x| < 1e21`, exponential with an explicit `e+`/`e-` outside it,
and `-0` printed as `0`. The corpus pins the boundaries in both
directions.

## Shape

**One crate.** Self-contained: no published `-core`, no shared crate with
the family, and nothing holding this code equal to the similar files in
the sibling repos.

```
crate/
├── src/
│   ├── extract/    pure: the eight extractors, the shared numeric
│   │               policy, JS number rendering, positions.
│   ├── walk.rs     ignore-aware tree walking
│   ├── scan.rs     one file end to end — the only path either surface calls
│   ├── cli.rs      the terminal surface
│   └── mcp/        the agent surface
└── fixtures/       the shared corpus, read by both frontends
```

**`extract/` touches no filesystem** and carries the **75% line coverage
floor per module**.

## Extraction — parity scope

### One numeric policy

Ported from `heuristics.ts`, which is already the single source the
extension's format extractors share:

- **Only finite numbers.** `NaN` and `±Infinity` are rejected even where
  a format can express them — YAML `.inf`, TOML `nan`. JSON cannot
  express them at all, and an extracted `Infinity` is noise to every
  downstream use.
- **String coercion is per format.** INI, `.env` and CSV values are
  inherently text, so a numeric-looking value there **is** a number.
  JSON, YAML and TOML distinguish `42` from `"42"`, and a quoted number
  in those is data — never extracted.
- **A coerced string must be numeric in full**: optional sign, digits, an
  optional decimal point, an optional exponent. `12abc`, `1.2.3`, `0x1A`
  and `1_000` are rejected. The extension's v1.x `parseFloat` accepted
  the first two silently and that is the bug this policy exists to fix.
- **Dates are not numbers.** A `Date` is skipped explicitly in the walk,
  which is what keeps a TOML datetime out of the results.
- Numbers come back in document order, duplicates included.

**The parsers decide more than the policy does**, and that is worth
stating: `0x1A` is *rejected* as a coerced string in INI, and *accepted*
as the number 26 in YAML and TOML, because those parsers resolve it
before the policy ever sees it. Both frontends inherit that from their
parsers and the corpus pins it.

### Twelve source languages have a literal reader

`python rust go java kotlin csharp cpp c javascript typescript sql
shellscript` — plus their file extensions and the React language ids —
are read by a numeric-literal extractor rather than by the text scan.

It understands hex `0xFF`, binary `0b1010`, octal `0o755` and the legacy
`0755`, digit separators `1_000_000` and `1'000`, and suffixes `123n`,
`1.5f`, `10u32`, `100L`, `1.5e3f64`. Two rules do most of the work: a
literal never begins inside a word, and a literal is consumed whole,
suffix included.

**Type names are not numbers.** `u32`, `i64`, `f32`, `usize` and `int64`
report nothing. Under the text scan they reported `32`, `64`, `32` and
`64`, and a Rust file yielded numbers that were never in it — the one
failure an audit tool cannot have.

**A dialect changes an answer, so the language is not a label.** `0755`
is 493 in C, C++, Go and Java and 755 in Rust, Python 3, Kotlin and C#;
`1_000` is one thousand in Rust and the number 1 in C; `123n` is a BigInt
in JavaScript and nowhere else. That is why the twelve resolve to their
own names rather than to one `source` key.

It reads comments and strings too, deliberately: a threshold quoted in a
docstring is exactly as interesting to a reviewer as one in an
expression, and skipping either would need a per-language lexer.

### The fallback has no grammar

For a format nothing here parses and no language claims — Markdown, a
log, plain text — numbers come from a scan of the raw text: optional
sign, digits, optional point, optional exponent. **`v1.2.3` reads as
`1.2` and `0.3`.** That is not a defect to fix here — it is what the
extension does, and a scan with no parser cannot know that a version
string is one token. It is why the fallback is now reserved for prose.

### Notation

Every finding carries how the literal was written: `decimal`, `hex`,
`binary`, `octal`, `scientific` or `bigint`. Without it a reader cannot
tell `0x1A` from `26`, which got worse the moment hex was supported at
all.

**Notation follows coercion.** A typed format hands over a number its own
parser already resolved — `0x1A` is 26 by the time TOML reaches the
policy, and the token is gone — so JSON, YAML and TOML report `decimal`.
An untyped format hands over text this policy parses itself, so INI,
`.env` and CSV keep what the text said. The source languages and the text
scan read their literals directly and keep everything.

## Deliberate divergences

The shared `extract_numbers` MCP tool must answer identically from either
server, and a difference there is a bug until it is written down here.
The surfaces themselves — IDE-first there, terminal-first here — are meant
to differ and are not on this list. These are the ones that are
written down. Each is pinned by a test, and
`scripts/differential-extraction.ts` generates around them rather than
through them.

**Refusal messages are not shared.** They come from whichever parser
refused, and `@iarna/toml` and the `toml` crate word them differently.
A refused document is compared structurally: both refused, both said so,
both returned nothing.

**TOML 0.5 against TOML 1.0.** `@iarna/toml` is 0.5, where an inline
array must hold one type; the `toml` crate is 1.0, where `[1, 2.5]` is
fine. Pinned by `fixtures/documents/mixed-array.toml`.

**A TOML integer at or above 2^53.** `@iarna/toml` hands back a
JavaScript `BigInt` there, which the extension's numeric walk does not
recognise, so it reports nothing; the `toml` crate returns an `i64`,
which becomes the same double a JavaScript number would. Past `i64` the
two part company again: the crate refuses the document — TOML integers
are 64-bit signed, so it is not a valid document — where `@iarna/toml`
wraps it silently to a negative number that is not in the file. **The
crate's answer is the one to trust**; the extension's is a defect in the
library it parses with, and reading its `BigInt` would mean reporting
the wrapped value as though it were real. `toml.rs` pins both halves.

**An INI value led by U+0085.** Whitespace is JavaScript's set
everywhere this crate trims — `js.rs` defines it, because Rust's strips
U+0085 and keeps U+FEFF and JavaScript does the exact opposite. The one
place that is not enough is INI: `rust-ini` strips U+0085 from a value
before the numeric policy sees it and the npm `ini` package does not, so
`rate = <U+0085>42` is the number 42 here and text there. A difference
between two parsers rather than a trim this crate performs, and not
recoverable from what either hands back.

**A base-prefixed literal wider than 128 bits.** `0x` followed by 33 or
more hex digits is **consumed and not reported**, on both sides — there
is no correctly-rounded reader for it here, and guessing a double is
worse than reporting nothing. Consuming it is what stops the scan
re-entering the run and reporting the digits inside as separate numbers.
Not a divergence — both frontends do this — but it is the one place the
tool knowingly stays silent about something numeric, so it is recorded
next to the ones that are.

## Output contract

**stdout is protocol, stderr is human.** One JSON report per line, one
line per file.

```json
{
  "file": "src/pricing.toml",
  "format": "toml",
  "numbers": [
    { "value": "0.0825", "notation": "decimal", "line": 4, "column": 12 },
    { "value": "1e+21", "notation": "decimal", "line": 9, "column": 8 }
  ],
  "diagnostics": [],
  "summary": { "numbers": 2, "unlocated": 0 }
}
```

`value` is a **string**, not a JSON number. Re-encoding through a JSON
number would hand the reader whatever the consuming parser prints, which
is the one thing this crate exists to control.

### Exit codes are the API

Following grep, as urls-le and string-le do — this reports what is there
and holds no opinion about it:

- **0** — numbers found.
- **1** — none found. An answer, not an error.
- **2** — the question was malformed.

## The CLI surface

```
usage: numbers-le [options] <file|dir>...
       numbers-le [options] --stdin [--format <format>]
       numbers-le mcp
       numbers-le --version | --help

Options:
  --dedupe             collapse repeated values to their first occurrence
  --format <format>    force a format instead of inferring it from the
                       file name; an unknown name falls back to a text
                       scan rather than failing
  --values             print only the numbers, one per line, for piping
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes
```

## The MCP surface

- **`extract_numbers` belongs to both servers**: same schema, same
  envelope, byte-identical number tokens.
  `fixtures/mcp-extract-numbers.json` runs against both. Each entry of
  `data.numbers` is `{ value, notation }` — the value a JSON number
  rendered by this crate, never re-encoded by a serializer.
- **`numbers_le_scan` is this server's own**: files or directories in,
  the same reports the CLI writes.

## Non-goals

- **It does not judge a number.** No magic-number heuristic, no range
  check, no "this looks like a rate" guess. Which numbers matter is the
  reviewer's call.
- **It does not do arithmetic**, and never rewrites a file.
- **No network, ever.**

## Not in v1

- **Units and currency.** `0.0825` and `8.25%` are the same rate written
  twice and this reports the digits it finds, not what they mean.
- **A baseline file** for accepting known numbers.

## Files that cannot be read

Exit 2 means the *question* was malformed — an unknown flag, an
unreadable format name, a path that does not exist. It does not mean one
file in fifty thousand was a PNG.

Two different things, and the difference is the whole point:

**A binary file was never a text candidate.** A NUL byte in the first
8 KiB — ripgrep's own test — and the file is not read, produces **no
report line**, and never affects the exit code. Reporting a PNG as a
file that could not be read made `--strict` exit 2 on every repository
holding an image, which made the flag useless in CI, the one place it is
most worth having. It is **counted on stderr** (`16 binary files
skipped`) so a reader still knows coverage was narrower than the tree;
the MCP scan tool carries the same count as `data.binaryFiles`.

**A file that looked like text and could not be read** — a permissions
error, or invalid UTF-8 with no NUL byte — is:

- named on stderr,
- carried in the JSON report with a `skipped` diagnostic saying why,
- and left out of the exit code unless `--strict` is on.

`--strict` turns that one back into exit 2, for a pipeline that wants
zero tolerance. What is never allowed is the third option: a *text* file
that silently vanishes from the report, which reads to whoever ran it as
a file that was clean.

## The byte-order mark

A leading BOM is stripped before extraction. It is three invisible bytes
that Notepad, Excel and a PowerShell redirect all add, and that VS Code
removes before the extension sees a document — so leaving it in means
the two frontends read the same file differently. It shifts every column
on the first line, and in a structured format it can lose the document
entirely.

A BOM anywhere other than the start is a zero-width no-break space and
belongs to the text.
