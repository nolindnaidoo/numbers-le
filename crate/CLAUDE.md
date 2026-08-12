# Instructions for AI coding assistants

Read [AGENTS.md](AGENTS.md) first — it is the engineering-standards
document for this crate and the source of truth for layout, control-flow
style, the settled decisions, testing requirements, and the definition
of done. [SPEC.md](SPEC.md) defines the product behavior. AGENTS.md wins
on any conflict. The extension at the repo root is a separate product
with its own `CLAUDE.md`.

- Before declaring any change complete, run exactly what CI runs:
  `cargo fmt --all --check`,
  `cargo clippy --all-targets -- -D warnings`,
  `cargo test --locked`. All three must pass — and
  `bun ../scripts/check-extraction-parity.ts` when extraction changed.
- Never add inline `#[allow(...)]` — CI fails the build on it. Fix the
  lint, or add a commented relaxation to `[lints.clippy]` in
  `Cargo.toml`. Two are there already, each with its reason.
- New logic goes in `extract/` when it is pure (it must then be
  unit-tested, 90% module coverage floor), and in `walk.rs` / `scan.rs`
  only when it needs the filesystem. A `std::fs` call in `extract/`
  fails a CI job.
- **`render.rs` is the contract, not a helper.** Everything this tool
  outputs is a number as text, and JavaScript and Rust print the same
  double differently. Do not reach for `{}` or `{:e}`; do not "simplify"
  the notation boundaries, which are the spec's and are corpus-pinned.
- **Never take a float from a JSON library.** `serde_json`'s parsing is
  not correctly rounded for every token. Parse the source text with
  `str::parse`. `corpus.rs` keeps a live test on the discrepancy.
- **Coercion is per format.** INI, `.env` and CSV coerce; JSON, YAML and
  TOML do not. This is the rule most likely to be "tidied" into one
  behaviour, and doing so would change what half the formats report.
- **An unrecognised format is a text scan, not a refusal**, and it is
  named `unknown` because that name is user-visible in every MCP answer.
- **Do not give this tool an opinion.** No magic-number heuristic, no
  range check, no arithmetic — see SPEC.md. Contract tests on both
  surfaces enforce it.
- `fixtures/` is shared with the extension — changing it changes both
  frontends and needs a CHANGELOG entry. **What it holds equal is the
  shared `extract_numbers` MCP tool**, which must answer identically from
  either server; a difference there is a bug. The surfaces themselves
  are IDE-first and terminal-first and are meant to differ —
  the walk, `--format`, `--values`, `--strict`, the exit codes and JSON Lines have no
  editor equivalent and are not drift. SPEC.md's "Deliberate
  divergences" is the bar for a new one.
- Write regression tests for every bug you fix; keep unit tests free of
  clocks, randomness, and the filesystem outside `walk`/`scan`.
- **Run the binary, not only the tests.** Four divergences here were
  caught by the corpus and a fifth by a 20,000-value scenario, none by
  reading the code.
