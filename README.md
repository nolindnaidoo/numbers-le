<p align="center">
  <img src="src/assets/images/icon.png" alt="Numbers-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Numbers-LE: Zero Hassle Number Extraction</h1>
<p align="center">
  <b>Pull every number out of the current file in one keystroke</b><br/>
  <i>JSON, YAML, CSV, TOML, INI, Environment files, and twelve source languages</i>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/OffensiveEdge/numbers-le">
    <img src="https://img.shields.io/open-vsx/dt/OffensiveEdge/numbers-le?style=for-the-badge&label=Open%20VSX&color=blue" alt="Open VSX downloads" />
  </a>
  <a href="https://www.npmjs.com/package/numbers-le-mcp">
    <img src="https://img.shields.io/npm/v/numbers-le-mcp?style=for-the-badge&label=MCP%20server&color=blue&logo=npm" alt="numbers-le-mcp on npm" />
  </a>
  <a href="https://crates.io/crates/numbers-le">
    <img src="https://img.shields.io/crates/v/numbers-le?style=for-the-badge&label=Rust%20CLI&color=blue&logo=rust" alt="numbers-le on crates.io" />
  </a>
  <a href="https://letools.dev/tools/numbers-le">
    <img src="https://img.shields.io/badge/LE%20Tools-letools.dev-blue?style=for-the-badge" alt="LE Tools" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Numbers-LE Demo" style="max-width: 100%; height: auto;" />
</p>

> **Useful?** A star or rating is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/numbers-le) ·
> [★ Open VSX](https://open-vsx.org/extension/OffensiveEdge/numbers-le/reviews) ·
> [★ Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le&ssr=false#review-details)

## What it does

Open a file, press `Ctrl+Alt+N` (`Cmd+Alt+N` on Mac), and every numeric value in the document lands in a new editor — deduplicate and sort it from there. Works in VS Code and in VS Code–based editors like Cursor and VSCodium (installable from Open VSX).

- **Data validation** — pull the numbers out of a config or fixture and eyeball ranges at a glance
- **Config audits** — compare ports, thresholds, and limits across INI/TOML/.env files
- **CSV work** — extract everything, one column, or several columns into separate documents

## Install

| Where | What you get | Install |
|---|---|---|
| **VS Code** | The same extraction, in your editor, on a keystroke | [Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le) |
| **Cursor, VSCodium, Windsurf** | The same extension | [Open VSX](https://open-vsx.org/extension/OffensiveEdge/numbers-le) |
| **A terminal or a CI step** | The same run over a whole tree, with exit codes | `cargo install numbers-le` · [crates.io](https://crates.io/crates/numbers-le) |
| **Any MCP agent, via Node** | `extract_numbers` over stdio | `npx numbers-le-mcp` · [npm](https://www.npmjs.com/package/numbers-le-mcp) |
| **Zed** | The MCP server as a context server | [add it by hand](https://zed.dev/docs/ai/mcp) *(no listing yet)* |

## Use it from an AI agent

The same engine runs as an [MCP](https://modelcontextprotocol.io) server, so an agent can call it directly instead of you running a command.

| Editor | How |
|---|---|
| **VS Code** 1.101+ | Nothing to install — the extension registers `extract_numbers` with agent mode |
| **Zed** | No listing yet — [add the MCP server by hand](https://zed.dev/docs/ai/mcp) |
| **Claude Code** | `claude mcp add numbers-le -- npx -y numbers-le-mcp` |
| **Cursor, Windsurf, anything else** | point it at `npx numbers-le-mcp` |

```
extract_numbers(content, format?, filename?, dedupe?, maxResults?)
```

Returns the values in document order, capped at 500 by default with `meta.truncated`. A format is optional — anything unrecognised is scanned as plain text rather than refused.

The server takes content and returns data — it reads no files and makes no network requests of its own. Published as [`numbers-le-mcp`](https://www.npmjs.com/package/numbers-le-mcp) on npm and as `io.github.nolindnaidoo/numbers-le` in the [MCP registry](https://registry.modelcontextprotocol.io).

<details>
<summary><b>Configuring it by hand</b> — any host with an MCP config file</summary>

Most hosts read a JSON config. Add one entry:

```json
{
  "mcpServers": {
    "numbers-le": {
      "command": "npx",
      "args": ["-y", "numbers-le-mcp"]
    }
  }
}
```

`-y` skips the install prompt on first run. Pin a version if you would rather not track releases — `numbers-le-mcp@2.3.0`.

Prefer not to go through `npx` on every launch? Install it once and point at the binary instead:

```bash
npm install -g numbers-le-mcp
```

```json
{
  "mcpServers": {
    "numbers-le": { "command": "numbers-le-mcp" }
  }
}
```

It speaks MCP over stdio and needs no environment variables, no API key and no configuration of its own. To check it before wiring it into anything:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y numbers-le-mcp
```

That prints the tool list and exits — if you see `extract_numbers`, the server works.

</details>

## Supported formats

| Format | What counts as a number |
|---|---|
| JSON | Number values anywhere in the structure. Quoted numbers (`"42"`) are strings, not numbers, and are never extracted |
| YAML | Number values, including hex/octal int forms and exponents; multi-document (`---`) streams extract from every document |
| TOML | Integer and float values (dates are not numbers) |
| CSV | Cells whose entire content is numeric — `19.99` counts, `12abc` and `1,000` do not. No header inference: every row is data |
| INI | Values whose entire content is numeric (INI values are inherently strings) |
| Environment | Values whose entire content is numeric (`PORT=3000` yields 3000; `VERSION=1.2.3` yields nothing) |

The shared policy (one heuristics module, applied to every format): only finite numbers are extracted — `NaN` and `inf`/`.inf` never appear in results — and a coerced string must be numeric in full: plain decimals with optional sign, decimal point, and exponent.

Python, Rust, Go, Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL and shell are read by a numeric-literal extractor that understands hex `0xFF`, binary `0b1010`, octal `0o755` and legacy `0755`, digit separators `1_000_000` and `1'000`, and suffixes `123n`, `1.5f`, `10u32`, `100L` — and that knows `u32` is a type name, not the number 32. A dialect changes an answer: `0755` is 493 in C, C++, Go and Java, and 755 in Rust, Python 3, Kotlin and C#.

Every finding carries the notation it was written in — `decimal`, `hex`, `binary`, `octal`, `scientific`, `bigint`. For anything left over you can pick a format explicitly or fall back to a plain-text scan (no grammar: `v1.2.3` reads as `1.2` and `0.3`).

## The CLI

The same extraction runs from a terminal or a shell pipeline: a Rust CLI
in [`crate/`](crate/README.md), sharing one corpus with the extension —
[`crate/fixtures/`](crate/fixtures/) — so the two can never read a
document differently.

```bash
numbers-le .                     # every number in the tree, as JSON
numbers-le --values config/      # just the numbers, one per line
numbers-le mcp                   # the same extraction over MCP on stdio

# the point of the whole thing:
numbers-le --values --dedupe src/ | sort -n > after.txt
diff before.txt after.txt        # what constants moved this release
```

**Somebody has to verify that the rate in the code is the rate in the
specification.** A tax percentage, a retention window, a rounding
boundary. In a regulated setting that check is a deliverable, and the
person doing it usually has no checkout and never has the editor open.

**Numbers are printed exactly as JavaScript prints them** — `1e+21`, not
Rust's `1000000000000000000000`. This tool's whole output is numbers as
text, so the rendering is the contract, and the corpus pins it.

**Exit codes follow grep** — 0 numbers found, 1 none found, 2 the question
was malformed.

## Commands

| Command | Description |
|---|---|
| `Numbers-LE: Extract Numbers` (`Ctrl+Alt+N` / `Cmd+Alt+N`) | Extract all numbers from the active document |
| `Numbers-LE: Deduplicate Numbers` | Remove duplicate numbers from the results |
| `Numbers-LE: Sort Numbers` | Sort results numerically or by magnitude |
| `Numbers-LE: Toggle CSV Streaming` | Flip `csv.streamingEnabled` for large CSV files |
| `Numbers-LE: Open Settings` | Open Numbers-LE settings |
| `Numbers-LE: Help & Troubleshooting` | Built-in documentation |

## Settings

| Setting | Default | Description |
|---|---|---|
| `numbers-le.openResultsSideBySide` | `true` | Open results beside the current editor |
| `numbers-le.postProcess.openInNewFile` | `true` | Dedupe/Sort write to a new file instead of replacing the editor content |
| `numbers-le.copyToClipboardEnabled` | `false` | Also copy results to the clipboard (non-CSV) |
| `numbers-le.dedupeEnabled` | `false` | Deduplicate automatically during extraction |
| `numbers-le.sortEnabled` | `false` | Sort automatically during extraction |
| `numbers-le.sortMode` | `off` | `numeric-asc/desc`, `magnitude-asc/desc` |
| `numbers-le.csv.streamingEnabled` | `false` | Incremental CSV parsing for large files |
| `numbers-le.showParseErrors` | `false` | Surface parse errors as notifications |
| `numbers-le.notificationsLevel` | `silent` | `all` = every notification, `important` = warnings + errors, `silent` = errors only |
| `numbers-le.safety.enabled` | `true` | Guardrails for very large files/outputs |
| `numbers-le.safety.fileSizeWarnBytes` | `1000000` | Warn above this file size |
| `numbers-le.safety.largeOutputLinesThreshold` | `50000` | Offer Open/Copy/Cancel above this result count |
| `numbers-le.safety.manyDocumentsThreshold` | `8` | Confirm before opening this many column documents |
| `numbers-le.statusBar.enabled` | `true` | Show the status bar item |
| `numbers-le.telemetryEnabled` | `false` | Local-only event log (see Privacy) |

## Languages

Twelve languages besides English:

German · Spanish · French · Indonesian · Italian · Japanese · Korean ·
Portuguese (Brazil) · Russian · Ukrainian · Vietnamese · Chinese (Simplified)

Both halves are covered — the manifest (command titles, setting names and
descriptions) and everything shown while the extension runs (notifications,
the status bar, quick-picks and prompts). The extension follows VS Code's
display language, so it matches whatever the editor is already set to; no
setting of its own.

## Privacy & security

- **No network access.** The extension never sends data anywhere. The `telemetryEnabled` setting only writes events to a local Output Channel you can inspect (`Numbers-LE`).
- **The MCP server holds the same line.** It takes content as an argument and returns data: no filesystem access, no network calls, no telemetry. Your agent already has file-read tools, so duplicating them inside the server would add a path-traversal surface for no capability. `check:mcp-bundle` fails the build if the server ever imports something that could reach either.
- Error notifications redact home directories and credential-shaped fragments.

## Documentation

| What | Where |
|---|---|
| What the tool is allowed to say — scope, output contract, refusals, non-goals | [`crate/SPEC.md`](crate/SPEC.md) |
| How the extension is built and held together — architecture, invariants, toolchain, release | [AGENTS.md](AGENTS.md) |
| How the CLI is built and held together | [`crate/AGENTS.md`](crate/AGENTS.md) |
| What changed | [CHANGELOG.md](CHANGELOG.md) · [`crate/CHANGELOG.md`](crate/CHANGELOG.md) |
| The tool's page, and the other fifteen | [letools.dev/tools/numbers-le](https://letools.dev/tools/numbers-le) |

## Performance

<!-- performance:start -->
| Input | Size | Found | Time | Rate | Scan speed |
| --- | --- | --- | --- | --- | --- |
| JSON metrics | 2.18 MB | 120,000 | 22.32 ms | 5,376,475/sec | 97.9 MB/s |
| CSV data | 0.93 MB | 150,000 | 51.26 ms | 2,926,066/sec | 18.2 MB/s |
| INI config | 0.42 MB | 30,000 | 20.05 ms | 1,496,430/sec | 20.7 MB/s |

Median of 7 runs after warmup, on Apple M5 Pro, 24 GB RAM, Node 24.3.0. Inputs are generated
by `scripts/benchmark.ts` rather than checked in, so the sizes above are
exactly what was measured. Reproduce with `bun run benchmark`.

These are machine-specific and are not asserted in CI — a benchmark that gates
a build only tells you how busy the runner was.
<!-- performance:end -->

## Testing

<!-- coverage:start -->
| Metric | Coverage |
| --- | --- |
| Statements | 90.65% |
| Branches | 84.08% |
| Functions | 96.34% |
| Lines | 92.42% |

358 test cases across 23 files, plus an integration suite that runs
in a real VS Code extension host and an end-to-end test that installs the
built `.vsix` into a clean profile.

Generated from a real run — `coverage/coverage-summary.json` and
`coverage/test-results.json` — by `scripts/coverage-readme.js`; CI fails if
this section drifts. Reproduce with `bun run test:coverage`, and the case
count is the one vitest prints.
<!-- coverage:end -->

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

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
