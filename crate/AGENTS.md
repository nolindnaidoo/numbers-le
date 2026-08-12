# numbers-le (CLI) — engineering standards

This is the source of truth for how code in `crate/` is written, tested,
and reviewed. It applies to every contributor, human or AI-assisted. CI
(`.github/workflows/ci-crate.yml`) enforces the mechanical parts;
reviewers enforce the rest. [SPEC.md](SPEC.md) defines the product
behavior — verdicts, exit codes, the parity scope; this file is how the
code gets there. The extension at the repo root is a separate TypeScript
product with its own `AGENTS.md`.

## What this project is

The command-line and MCP frontend of Numbers-LE: get every hardcoded
number out of a codebase so a person can check them. Nothing is filtered,
rewritten or judged — see SPEC.md, "Non-goals". One product, two
frontends, one repository: the corpus (`fixtures/`) is shared with the VS
Code extension, and CI fails when either side drifts from it.

**The reader is not the author.** Someone verifying that a rate in the
code matches a rate in a specification is an auditor, an actuary, a
compliance reviewer — usually without a checkout and always without the
editor open. Every decision below follows from that.

**Status: released.** All seven extractors, both surfaces and
the test layers below are green. Releases go out through
`release-crate.yml`, which is dispatch-only and refuses a version that
crates.io already carries, has no changelog entry, would ship a tarball
missing its own corpus, or whose corpus the extension no longer
reproduces.

## Layout

```
crate/src/
├── extract/     pure: the seven extractors, the shared numeric policy,
│                JS number rendering, positions. No filesystem.
├── walk.rs      ignore-aware tree walking
├── scan.rs      one file end to end — the only path either surface calls
├── cli.rs       the terminal surface
└── mcp/         the agent surface
```

- **`extract/` touches no filesystem.** It takes document text and a
  format and returns values, so the entire extraction layer tests from a
  fixture file — no temp directories, no flake. It carries the **90%
  line coverage floor per module**, enforced by the `coverage` job. A
  `std::fs` call appearing there is a bug, and the `policy` job greps
  for one.
- **`scan.rs` and `walk.rs` are the only modules allowed to touch the
  filesystem.**
- **Both surfaces are one implementation.** `cli.rs` and `mcp/` both call
  `scan.rs`. A surface that grows its own copy of a rule is a bug, and
  a contract test asserts the two return identical reports for the same
  tree.
- **`walk.rs` selects, it does not decide.** Its one rule — a file named
  explicitly is read whatever the ignore rules say — is why intent beats
  configuration.
- Keep modules flat. No layers, registries, managers, or services. No
  trait with a single implementation.

## Decisions already made (do not relitigate)

- **How a number is printed is the contract.** `render.rs` implements
  ECMAScript's `Number::toString`, not Rust's `{}`. JavaScript writes
  `1e+21` where Rust writes `1000000000000000000000`, and this tool's
  entire output is numbers as text. The corpus pins both notation
  boundaries in both directions; moving one is a behaviour change for
  every consumer.
- **`value` is a string in the report, and a raw token over MCP.**
  Re-encoding through a JSON number hands the reader whatever their
  parser prints. The MCP tool emits `RawValue` tokens this crate
  rendered itself, because `1e+21` and `1e21` are the same double and
  different bytes, and only one of them is what the npm server writes.
- **Numbers are parsed from source text with `str::parse`.**
  `serde_json`'s float parsing is not correctly rounded for every token —
  it reads `123456789012345680000` one ULP below what `str::parse` and
  JavaScript both give. `corpus.rs` keeps a live test on that so the
  workaround can go when it is fixed upstream.
- **Coercion is per format, never per call.** INI, `.env` and CSV are
  untyped and coerce; JSON, YAML and TOML do not. This is the rule most
  likely to be "simplified" by someone later.
- **The parsers decide more than the policy does.** `0x1A` is rejected as
  a coerced string in INI and resolved to `26` in YAML and TOML. Both
  frontends inherit it from their parsers; the corpus pins it.
- **Only finite numbers.** `NaN` and `±Infinity` are dropped wherever a
  format can express them.
- **An unrecognised format is a text scan, not a refusal**, and its name
  is `unknown` — the extension's name, and user-visible in every MCP
  answer's `fileType`.
- **The text scan has no grammar.** `v1.2.3` reads as `1.2` and `0.3`.
  Ported behaviour, and the first thing anyone will report as a bug.
- **A parse failure is a warning, not an exit 2.** Only an unreadable
  *file* is a 2. One malformed config must not fail an audit of ten
  thousand files.
- **Refusal messages cannot be shared.** They come from whichever parser
  refused, and `@iarna/toml` and the `toml` crate word them differently.
  The corpus compares refusals structurally: both refused, both reported
  it, both returned nothing.
- **The `toml` crate is TOML 1.0 and `@iarna/toml` is 0.5.** A mixed
  inline array is read here and refused there. Sanctioned divergence,
  pinned by `fixtures/documents/mixed-array.toml`.
- **`JSON.parse("")` throws and jsonc-parser does not**, so an empty
  document is a parse failure here by hand.
- **Positions are found by value, not by text**, because a number's
  source and its printed form differ. A run in a key can take the match;
  that is written down in `locate.rs` rather than left to be discovered.
- **This tool has no opinions.** No magic-number heuristic, no range
  check, no arithmetic. A contract test asserts no flag asks for a
  judgment.
- **Exit codes follow grep**: 0 found, 1 none found, 2 could not answer.
- **One crate, self-contained.** No published `-core`, no shared crate,
  and nothing holding this code equal to the similar files in the
  sibling repos.
- **stdout is protocol, stderr is human. There is no `--json` flag.**
- **Parity scope is extraction and rendering** — `src/extraction/**`.
  Positions are outside it; the extension has none.

## Control-flow style

Flat over nested, guards over branches — the same rules as pixelcoords,
pixelactions and scrape-le:

- **No statement-position `else`.** Guard clauses and early `return`
  (`if !ok { return ... }` / `let Some(x) = ... else { return }`), then
  fall through to the happy path.
- **Value-position `if/else` is fine** — `let x = if cond { a } else
  { b }` is Rust's ternary.
- **`match` is fine and preferred** over any chain of condition tests on
  the same value; use match guards instead of `if/else` inside arms.
- Prefer combinators where they read cleanly: `bool::then_some`,
  `Option::map/filter/is_some_and`, `?`.
- No nesting deeper than two levels inside a function; extract a named
  helper instead.

## Hard rules

- **No inline `#[allow(...)]`** — CI greps and fails the build. Either
  fix the lint or add a visible, commented relaxation to
  `[lints.clippy]` in `Cargo.toml`.
- **Clippy pedantic, deny warnings.** `cargo clippy --all-targets --
  -D warnings` must pass exactly as CI runs it.
- **No async runtime.** This tool reads files and asks the filesystem
  about them. There is nothing to await.
- **`unsafe` is forbidden crate-wide** (`[lints.rust]`).
- **Dependencies are a cost.** Five format parsers is already more than
  most tools carry, and every one is justified by a comment in
  `Cargo.toml`. Justify any addition; prefer the standard library;
  prefer what is already in the tree.
- **No network, ever.**
- **Nothing writes, and nothing judges.** No `--fix`, no verdicts, no
  filtering.
- **Strict parsing, never silent defaults** — for flags. An unrecognised
  flag or an input that does not exist is an error with an actionable
  message. A format that does not resolve is the documented exception
  above: it falls back. A typo'd `--stict` that silently did
  nothing would report a clean audit that never ran the check asked for.
- **Refuse rather than guess.** A file that cannot be read is reported
  as unexamined and the run exits 2 — never a clean result that quietly
  skipped it. Never report coverage you did not achieve.
- **Refusals speak the caller's vocabulary.** An MCP caller has no
  command line; no message aimed at one mentions `--dedupe` or any other
  flag. A test asserts no MCP output contains `--`.
- **`extract_numbers` belongs to both servers.** The npm server
  (`src/mcp/tools.ts`) and this one offer the same tool: same schema,
  same envelope, byte-identical output — **numbers, never positions, and
  the same JSON tokens**. `fixtures/mcp-extract-numbers.json` runs
  against both, so changing one without the other fails a build.
  Every tool here returns that envelope — `{ ok, data, diagnostics,
  meta }` — where `ok` means the check ran, never that the answer was
  yes.

## The corpus contract

`fixtures/` lives inside this crate so the published package is
self-contained — `cargo package` cannot reach above its own directory.
The corpus is **not** needed to build the binary; that was checked
rather than assumed, by deleting it from an unpacked tarball and
building. It is needed to *verify*: `cargo test` on the published crate
runs every corpus case, so a consumer can check the parity claims
instead of trusting them. That is why it ships, and the release workflow
asserts it is in the tarball. It is still shared ground: the extension
reads the same files.
`../scripts/check-extraction-parity.ts` (the `parity` job in
`ci-crate.yml`) fails when the extension drifts. Changing a document or
an expectation is a behavior change for **both** frontends and needs a
CHANGELOG entry.

Where the two must disagree, the disagreement is written down in
SPEC.md and a test asserts what each side actually answers. There is no
other sanctioned way to differ.

## Testing

The bar, enforced by review:

- **`extract/`: 90% line coverage floor per module.** Everything in it
  is pure; if something is hard to test there, the design is wrong. Per
  module rather than the crate total, because a total lets one module
  slide while the others carry it.
- **The parity corpus is embedded.** Every `fixtures/` case runs as a
  unit test; the expected values are the extension's answers.
- **Exit codes belong in `tests/contracts.rs`.** They are the API —
  callers branch on them — so they are pinned by tests that drive the
  built binary against a temporary tree: no network, no privileged
  operation, so they run everywhere on every push. A new refusal adds
  its case there.
- **Anything needing a document larger than an editor opens is
  `tests/scenarios.rs`** — gated behind `STRING_LE_SCENARIOS` and run by
  CI on all three OSes. A skipped scenario is never reported as a pass; each one says
  plainly that it did not run.
- **Every bug fix ships with a regression test** that fails before the
  fix. Three divergences got through a green suite here and were caught
  the first time the corpus and then the binary actually ran: rust-ini
  resolving `\U` as an escape, the fallback regex matching across
  newlines where JavaScript's `.` cannot, and a bare key in an INI file
  taking every value in that file down with it. Run the binary, not only
  the tests.
- Tests are deterministic: no clocks, no randomness, and **no filesystem
  in `extract/` tests** — everything there runs from the corpus.

## Verification — the definition of done

All of it, exactly as CI runs it, before every push:

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
bun ../scripts/check-extraction-parity.ts   # when extraction changed
```

CI additionally builds on macOS, Windows and Linux, checks the Rust 1.88
minimum version, runs `cargo audit`, the no-inline-`#[allow]` and
no-filesystem-in-`extract/` policy jobs, the per-module coverage floor,
the gated scenarios, and parity — including on extension-side edits to
`src/extraction/**`, so neither frontend can drift green. A change is
not done because it compiles; it is done when it is tested, linted,
documented where behavior changed (README / CHANGELOG / SPEC / this
file), and honest — claims in docs must match the code.

## Commits and pull requests

The repo root's convention applies unchanged (root `AGENTS.md`):
conventional prefix, imperative subject under 72 characters, body
carrying the *why* — enforced by the `commit-msg` hook and the
`Commit messages` CI job. One concern per change; if docs describe the
thing you changed, update them in the same commit. Release tags are
`crate-v*`, and a release goes out by dispatching `release-crate.yml`
with its publish opt-in — never by pushing a tag, because a crates.io
version can never be reused.
