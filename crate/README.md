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

## The text scan has no grammar

For a format nothing here parses — a `.ts`, a `.sql`, a `.log` — numbers
come from scanning the raw text. **`v1.2.3` reads as `1.2` and `0.3`.**

That is not a defect to report; it is what the extension does, and a scan
with no parser cannot know a version string is one token. It is why the
scan is only used when the format is unknown — and why it is still worth
having, because a hardcoded constant in a source file is exactly what an
audit is looking for.

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

JSON and the text scan skip all of that: one walks an AST with real
ranges, the other *is* the scanner.

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

All ten LE tools are on **[letools.dev](https://letools.dev)**.

## Also by nolindnaidoo

**Rust** — pixelcoords and pixelactions are one loop: pixelcoords answers *where*, pixelactions *acts* there. The seven LE crates are the terminal half of the extensions they sit in — the same extraction, held to the extension's own corpus, and an exit code instead of a results editor.

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)
- **[paths-le](https://github.com/nolindnaidoo/paths-le/tree/main/crate)** — Find every path in a codebase and report whether it still points at anything
  [crates.io](https://crates.io/crates/paths-le)
- **[secrets-le](https://github.com/nolindnaidoo/secrets-le/tree/main/crate)** — Find hardcoded credentials, and never print one
  [crates.io](https://crates.io/crates/secrets-le)
- **[urls-le](https://github.com/nolindnaidoo/urls-le/tree/main/crate)** — Extract every URL from a codebase, with its protocol and exact position
  [crates.io](https://crates.io/crates/urls-le)
- **[regex-le](https://github.com/nolindnaidoo/regex-le/tree/main/crate)** — Find every regex in a codebase and report which can be driven into catastrophic backtracking
  [crates.io](https://crates.io/crates/regex-le)
- **[string-le](https://github.com/nolindnaidoo/string-le/tree/main/crate)** — Get every string in a codebase out where a person can read them
  [crates.io](https://crates.io/crates/string-le)
- **[envsync-le](https://github.com/nolindnaidoo/envsync-le/tree/main/crate)** — Compare the dotenv files in a tree and say which keys are missing from which
  [crates.io](https://crates.io/crates/envsync-le)
- **[scrape-le](https://github.com/nolindnaidoo/scrape-le/tree/main/crate)** — Check whether a page is scrapeable before the scraper is written
  [crates.io](https://crates.io/crates/scrape-le)

**Contact Developer** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## License

MIT — see [LICENSE](https://github.com/nolindnaidoo/numbers-le/blob/main/LICENSE).
