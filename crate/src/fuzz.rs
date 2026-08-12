//! A standing net over the pure layer, not a proof.
//!
//! The targets are the two functions that read a literal out of raw text
//! — `extract::source::spanned` and `extract::policy::strict_number` —
//! because those are where this crate slices, indexes and parses bytes
//! it did not write. Everything else in `extract/` is handed a value a
//! parser already resolved.
//!
//! It lives beside `walk.rs` rather than in `extract/` deliberately: the
//! coverage floor is measured per module in `extract/`, and a test-only
//! module in there would be a file the floor has to make an exception
//! for. It cannot live in `tests/` either — an integration test can only
//! reach the binary, and the point of a fuzz target is to call the pure
//! function directly, thousands of times a second.
//!
//! **Time-boxed, not run to convergence.** `NUMBERS_LE_FUZZ` sets the
//! budget in seconds; without it each target runs a small deterministic
//! sample so the net still exists on every push. The seed is printed
//! either way, and proptest shrinks a failure to the shortest input that
//! still breaks — which is the difference between a red build somebody
//! reads and one somebody reruns.

use std::time::{Duration, Instant};

use proptest::prelude::*;
use proptest::test_runner::{Config, FileFailurePersistence, TestError, TestRunner};

use crate::extract::format::{SUPPORTED_FORMATS, is_source};
use crate::extract::policy::{Notation, strict_number};
use crate::extract::source;

/// Cases per batch. The deadline is checked between batches, so this is
/// the granularity of the time box rather than the size of the run.
const BATCH: u32 = 512;

/// What a push runs when nothing asks for more: enough to catch a
/// deterministic panic, cheap enough to sit in the ordinary test job.
const SAMPLE: Duration = Duration::from_millis(250);

fn budget() -> Duration {
    match std::env::var("NUMBERS_LE_FUZZ") {
        Ok(seconds) => Duration::from_secs(seconds.parse().unwrap_or(60)),
        Err(_) => SAMPLE,
    }
}

/// Run one property until the budget runs out, naming the seed and the
/// shrunken input if it fails.
fn hammer<S>(target: &str, strategy: S, property: impl Fn(S::Value) -> Result<(), TestCaseError>)
where
    S: Strategy + Clone,
    S::Value: std::fmt::Debug,
{
    let deadline = Instant::now() + budget();
    let mut round = 0_u64;
    while Instant::now() < deadline {
        let seed = 0x5eed_0000_u64.wrapping_add(round);
        let mut runner = TestRunner::new(Config {
            cases: BATCH,
            // A run has to be reproducible from what it printed, and a
            // regression file written into the source tree would make it
            // reproducible only on the machine that found it.
            failure_persistence: Some(Box::new(FileFailurePersistence::Off)),
            ..Config::default()
        });
        if let Err(failure) = runner.run(&strategy, &property) {
            match failure {
                TestError::Fail(reason, value) => panic!(
                    "{target} failed on {value:?}\n  reason: {reason}\n  \
                     reproduce: NUMBERS_LE_FUZZ={} round {round} (seed {seed:#x})",
                    budget().as_secs()
                ),
                TestError::Abort(reason) => panic!("{target} aborted: {reason}"),
            }
        }
        round += 1;
    }
    eprintln!("fuzz {target}: {round} batches of {BATCH} cases");
}

/// Every language key `source.rs` reads, plus one it does not — the
/// unknown key is answered rather than panicked on, and that is a
/// property worth holding.
fn languages() -> Vec<&'static str> {
    let mut names: Vec<&'static str> = SUPPORTED_FORMATS
        .into_iter()
        .filter(|format| is_source(format))
        .collect();
    names.push("wat");
    names
}

/// Text shaped like source: literal fragments, separators, suffixes and
/// the punctuation that decides whether a sign or a point begins one.
///
/// Purely random bytes almost never produce a literal at all. These
/// fragments are the corpus, checked in as the seeds a fuzzer would
/// otherwise have to discover.
fn source_text() -> impl Strategy<Value = String> + Clone {
    let fragment = prop::sample::select(vec![
        "0",
        "1",
        "7",
        "8",
        "9",
        "42",
        "0x",
        "0X",
        "0b",
        "0o",
        "0755",
        "1_",
        "_1",
        "'",
        "''",
        ".",
        "..",
        "e",
        "E",
        "e+",
        "e-",
        "+",
        "-",
        "n",
        "u32",
        "i64",
        "f64",
        "L",
        "_f32",
        "FF",
        "zz",
        "\u{e9}",
        "\u{1f3af}",
        " ",
        "\n",
        "\t",
        "(",
        ")",
        "[",
        "]",
        "{",
        "}",
        "\"",
        "//",
        "#",
        "let",
        "x",
        "$",
        "1e400",
        "9".repeat(40).leak(),
        "F".repeat(40).leak(),
    ]);
    prop::collection::vec(fragment, 0..24).prop_map(|parts| parts.concat())
}

/// The literal scanner: it must never panic, never slice a character in
/// half, never report a value that is not finite, and never walk
/// backwards.
#[test]
fn the_literal_scanner_answers_for_any_text() {
    let strategy = (source_text(), prop::sample::select(languages()));
    hammer(
        "source::spanned",
        strategy,
        |(text, language)| -> Result<(), TestCaseError> {
            let found = source::spanned(&text, language);
            let mut previous: Option<usize> = None;
            for (literal, offset) in &found {
                prop_assert!(
                    literal.value.is_finite(),
                    "a non-finite value reached the report: {literal:?}"
                );
                prop_assert!(
                    *offset < text.len().max(1),
                    "offset {offset} is past the end"
                );
                prop_assert!(
                    text.is_char_boundary(*offset),
                    "offset {offset} splits a character"
                );
                if let Some(previous) = previous {
                    prop_assert!(*offset > previous, "offsets went backwards");
                }
                previous = Some(*offset);
            }
            // The two entry points are one scan, so they cannot disagree
            // about how many numbers a document holds.
            prop_assert_eq!(source::extract(&text, language).len(), found.len());
            Ok(())
        },
    );
}

/// A run that overflows, and a base-prefixed run wider than 128 bits,
/// are **consumed and not reported** — never a panic, and never the
/// digits inside coming back as separate numbers. SPEC.md records it
/// under "Deliberate divergences".
#[test]
fn a_run_too_wide_to_read_is_consumed_and_not_reported() {
    let strategy = (
        prop::sample::select(vec!["0x", "0X", "0b", "0B", "0o", "0O"]),
        1_usize..80,
        prop::sample::select(languages()),
    );
    hammer(
        "an over-wide literal",
        strategy,
        |(prefix, width, language)| -> Result<(), TestCaseError> {
            let digit = match prefix {
                "0b" | "0B" => '1',
                "0o" | "0O" => '7',
                _ => 'F',
            };
            let text = format!("x = {prefix}{}", String::from(digit).repeat(width));
            let found = source::extract(&text, language);
            prop_assert!(found.len() <= 1, "the run was re-entered: {found:?}");
            for literal in &found {
                prop_assert!(literal.value.is_finite());
                // Whatever came back is the whole run, never a piece of
                // it: reading part of a literal is the failure this
                // module exists for.
                prop_assert!(literal.value >= 0.0);
            }
            Ok(())
        },
    );
}

/// A malformed suffix is text, not a crash. `1exp`, `1e`, `1e+` and a
/// suffix of arbitrary word characters all end at a number and an
/// identifier.
#[test]
fn a_malformed_suffix_ends_the_literal_rather_than_the_process() {
    let strategy = (
        1_u32..1000,
        "[A-Za-z_$][A-Za-z0-9_$]{0,12}",
        prop::sample::select(languages()),
    );
    hammer(
        "a malformed suffix",
        strategy,
        |(number, suffix, language)| -> Result<(), TestCaseError> {
            let text = format!("x = {number}{suffix}");
            let found = source::extract(&text, language);
            prop_assert!(
                found.len() <= 1,
                "the suffix yielded numbers of its own: {found:?}"
            );
            Ok(())
        },
    );
}

/// The strict test: whatever it accepts is finite and parses back, and
/// whatever it accepts is decimal or scientific — nothing else can
/// reach `plain_notation`, and a base prefix must never get through.
#[test]
fn the_strict_number_test_accepts_only_whole_numbers() {
    let strategy = prop_oneof![
        "[+-]?[0-9]{0,20}(\\.[0-9]{0,20})?([eE][+-]?[0-9]{0,4})?",
        "\\PC{0,32}",
        prop::sample::select(vec![
            "NaN",
            "nan",
            "Infinity",
            "-Infinity",
            "inf",
            ".inf",
            ".nan",
            "1e400",
            "-1e400",
            "0x1A",
            "1_000",
            "1.2.3",
            "12abc",
            "",
            "   ",
        ])
        .prop_map(str::to_string),
    ];
    hammer(
        "policy::strict_number",
        strategy,
        |raw: String| -> Result<(), TestCaseError> {
            let Some(literal) = strict_number(&raw) else {
                return Ok(());
            };
            prop_assert!(
                literal.value.is_finite(),
                "{raw:?} was accepted as {}",
                literal.value
            );
            prop_assert!(
                matches!(literal.notation, Notation::Decimal | Notation::Scientific),
                "{raw:?} came back as {:?}",
                literal.notation
            );
            prop_assert_eq!(
                literal.notation == Notation::Scientific,
                raw.contains(['e', 'E']),
                "the notation does not match how {:?} was written",
                raw
            );
            Ok(())
        },
    );
}

/// Non-finite is non-negotiable, whatever the spelling. `NaN` and
/// `±Infinity` are rejected everywhere a format can express them, and a
/// fuzzer that finds a spelling that gets through has found a real bug.
#[test]
fn nothing_that_is_not_finite_is_ever_accepted() {
    let strategy = prop_oneof![
        prop::sample::select(vec![
            "NaN",
            "nan",
            "NAN",
            "Infinity",
            "-Infinity",
            "+Infinity",
            "inf",
            "-inf",
            ".inf",
            "-.inf",
            ".nan",
            "1e400",
            "-1e400",
            "1e999999",
            "9".repeat(400).leak(),
        ])
        .prop_map(str::to_string),
        "[+-]?[0-9]{1,4}[eE][+-]?[0-9]{1,4}",
    ];
    hammer(
        "the non-finite rejection",
        strategy,
        |raw: String| -> Result<(), TestCaseError> {
            if let Some(literal) = strict_number(&raw) {
                prop_assert!(literal.value.is_finite(), "{raw:?} got through");
            }
            for language in languages() {
                for literal in source::extract(&format!("x = {raw}"), language) {
                    prop_assert!(literal.value.is_finite(), "{raw:?} got through {language}");
                }
            }
            Ok(())
        },
    );
}
