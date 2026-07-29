<p align="center">
  <img src="src/assets/images/icon.png" alt="Numbers-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Numbers-LE: Zero Hassle Number Extraction</h1>
<p align="center">
  <b>Pull every number out of the current file in one keystroke</b><br/>
  <i>JSON, YAML, CSV, TOML, INI, and Environment files</i>
</p>

<p align="center">
  <a href="https://open-vsx.org/extension/nolindnaidoo/numbers-le">
    <img src="https://img.shields.io/badge/Install%20from-Open%20VSX-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from Open VSX" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Numbers-LE Demo" style="max-width: 100%; height: auto;" />
</p>

## What it does

Open a file, press `Ctrl+Alt+N` (`Cmd+Alt+N` on Mac), and every numeric value in the document lands in a new editor — deduplicate and sort it from there. Works in VS Code and in VS Code–based editors like Cursor and VSCodium (installable from Open VSX).

- **Data validation** — pull the numbers out of a config or fixture and eyeball ranges at a glance
- **Config audits** — compare ports, thresholds, and limits across INI/TOML/.env files
- **CSV work** — extract everything, one column, or several columns into separate documents

## Supported formats

| Format | What counts as a number |
|---|---|
| JSON | Number values anywhere in the structure. Quoted numbers (`"42"`) are strings, not numbers, and are never extracted |
| YAML | Number values, including hex/octal int forms and exponents; multi-document (`---`) streams extract from every document |
| TOML | Integer and float values (dates are not numbers) |
| CSV | Cells whose entire content is numeric — `19.99` counts, `12abc` and `1,000` do not. No header inference: every row is data |
| INI | Values whose entire content is numeric (INI values are inherently strings) |
| Environment | Values whose entire content is numeric (`PORT=3000` yields 3000; `VERSION=1.2.3` yields nothing) |

The shared policy (one heuristics module, applied to every format): only finite numbers are extracted — `NaN` and `inf`/`.inf` never appear in results — and a coerced string must be numeric in full: plain decimals with optional sign, decimal point, and exponent. For unrecognized file types you can pick a format explicitly or fall back to a plain-text scan (no grammar: `v1.2.3` reads as `1.2` and `0.3`).

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

The settings UI is translated into 12 languages besides English.

## Privacy & security

- **No network access.** The extension never sends data anywhere. The `telemetryEnabled` setting only writes events to a local Output Channel you can inspect (`Numbers-LE`).
- Error notifications redact home directories and credential-shaped fragments.

## Development

```bash
bun install
bun run build            # esbuild bundle -> dist/extension.js
bun run typecheck        # tsc --noEmit (includes tests)
bun run test             # vitest unit suite
bun run test:integration # real VS Code extension host
bun run lint             # biome
bun run package          # VSIX into release/
```

Architecture and conventions live in [AGENTS.md](AGENTS.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## More from the LE Family

- **[String-LE](https://open-vsx.org/extension/nolindnaidoo/string-le)** - Extract user-visible strings for i18n and validation • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)
- **[Paths-LE](https://open-vsx.org/extension/nolindnaidoo/paths-le)** - Extract file paths from imports and dependencies • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le)
- **[EnvSync-LE](https://open-vsx.org/extension/nolindnaidoo/envsync-le)** - Keep .env files in sync with visual diffs • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)
- **[Regex-LE](https://open-vsx.org/extension/nolindnaidoo/regex-le)** - Test and validate regex patterns with live feedback • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.regex-le)
- **[Secrets-LE](https://open-vsx.org/extension/nolindnaidoo/secrets-le)** - Detect and sanitize secrets before you commit • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.secrets-le)
- **[Scrape-LE](https://open-vsx.org/extension/nolindnaidoo/scrape-le)** - Validate scraper targets before debugging • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)
- **[Colors-LE](https://open-vsx.org/extension/nolindnaidoo/colors-le)** - Extract and analyze colors from stylesheets • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)
- **[URLs-LE](https://open-vsx.org/extension/nolindnaidoo/urls-le)** - Extract URLs from any codebase with precision • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)
- **[Dates-LE](https://open-vsx.org/extension/nolindnaidoo/dates-le)** - Extract temporal data from logs and APIs • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le)

## License

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
