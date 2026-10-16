# numbers-le

Get every hardcoded number in a codebase into one list, with the file and
line each came from, so a person can check them: the auditor confirming the
tax rate in the code is the rate in the specification, the reviewer looking
for the retry limit that changed, the actuary reading a retention window.

```bash
npx numbers-le src/
npx numbers-le --values --dedupe src/ > numbers.txt
cat rates.toml | npx numbers-le --stdin --format toml
```

This is the same command line as the Rust crate
[`numbers-le`](https://crates.io/crates/numbers-le), and it behaves
identically: same flags, same walk, same positions, same output, same exit
codes. Install whichever toolchain you already have. It reads documents with
the parsers of the numbers-le editor extension, so the few documents the
extension and the crate read differently, which the crate's
[SPEC](https://github.com/nolindnaidoo/numbers-le/blob/main/crate/SPEC.md#deliberate-divergences)
lists, are read here as the extension reads them. When a parser refuses a
broken document, both report it as unparsed under the same
`Failed to parse JSON: ` prefix, and the rest is each parser's own words.

## What it reads

Every file. JSON, JSONC, YAML, CSV, TSV, TOML, INI and dotenv are parsed.
Python, Rust, Go, Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL and
shell are read by their own literal syntax, hex, binary, octal, digit
separators and type suffixes included, so `u32` is a type and not the number
32. Anything else is scanned as text and reported as format `unknown`.
Directories are walked the way ripgrep walks them: `.gitignore`, `.ignore`
and hidden files are respected unless you pass `--no-ignore` or `--hidden`. A
binary file is passed over and counted in the summary.

Every number is printed exactly as JavaScript prints it: `0xFF` is `255`,
`1_000` is `1000`, `1e21` is `1e+21`. It reports what is there and nothing
else. Which numbers matter is yours to decide.

## Output

stdout carries one JSON report per file whenever it is piped or redirected,
and nothing when it is a terminal. stderr lists every number with its
position. `--values` prints just the values, one per line, wherever stdout
goes.

```text
$ numbers-le src rates.toml
rates.toml:1:18  30
rates.toml:2:7  0.2
src/pricing.ts:1:21  255
src/pricing.ts:2:22  1000
4 numbers in 2 files
```

```json
{"file":"src/pricing.ts","format":"typescript","numbers":[{"value":"255","notation":"hex","line":1,"column":21},{"value":"1000","notation":"decimal","line":2,"column":22}],"diagnostics":[],"summary":{"numbers":2,"unlocated":0}}
```

Columns count UTF-16 code units, as an editor does. A number a parser
resolved from text no run of digits spells, such as TOML's `0x1A`, carries no
`line` or `column`, and `summary.unlocated` counts them.

## Exit codes

grep's convention:

- **0**: numbers found.
- **1**: none found. That is an answer, not an error.
- **2**: the question was malformed, or `--strict` and a text file could not
  be read.

## For agents

`numbers-le mcp` serves the Model Context Protocol on stdio with two tools:
`extract_numbers` for a document's text and `numbers_le_scan` for files and
directories. Hosts that want the document tool alone can install
[`numbers-le-mcp`](https://www.npmjs.com/package/numbers-le-mcp).

`numbers-le --help` lists every option.

MIT licensed. Part of [letools](https://letools.dev/tools/numbers-le).
