# numbers-le — Rust specification

A port of the [Numbers-LE](https://github.com/nolindnaidoo/numbers-le)
VS Code extension to a Rust CLI and MCP server: get every number out of
a codebase so a person can check them.

**Parity first.** The extension is the reference implementation. The
numbers this produces for a given document, **the order they come in, and
the text they are printed as**, must match what the extension produces. A
difference is a regression until proven otherwise.

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
│   ├── extract/    pure: the seven extractors, the shared numeric
│   │               policy, JS number rendering, positions.
│   ├── walk.rs     ignore-aware tree walking
│   ├── scan.rs     one file end to end — the only path either surface calls
│   ├── cli.rs      the terminal surface
│   └── mcp/        the agent surface
└── fixtures/       the shared corpus, read by both frontends
```

**`extract/` touches no filesystem** and carries the **90% line coverage
floor per module**.

## Extraction — parity scope

### One numeric policy

Ported from `heuristics.ts`, which is already the single source the
extension's six format extractors share:

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

### The fallback has no grammar

For an unrecognised format, numbers come from a scan of the raw text:
optional sign, digits, optional point, optional exponent. **`v1.2.3`
reads as `1.2` and `0.3`.** That is not a defect to fix here — it is what
the extension does, and a scan with no parser cannot know that a version
string is one token. It is why the fallback is only used when the format
is unknown.

## Output contract

**stdout is protocol, stderr is human.** One JSON report per line, one
line per file.

```json
{
  "file": "src/pricing.toml",
  "format": "toml",
  "numbers": [
    { "value": "0.0825", "line": 4, "column": 12 },
    { "value": "1e+21", "line": 9, "column": 8 }
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
  envelope, byte-identical output. `fixtures/mcp-extract-numbers.json`
  runs against both.
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
