//! Finding where each extracted number came from.
//!
//! Harder than locating a string, and for a reason worth stating: a
//! number's source text and its printed form are frequently different.
//! `0x1A` is reported as `26`, `1_000` as `1000`, `+7` as `7`, `1e21` as
//! `1e+21`. Searching the source for the *printed* form would miss all
//! of those and, worse, could match the wrong run.
//!
//! So the search is by **value, not by text**: scan the document for
//! numeric runs, parse each, and walk forward pairing every extracted
//! number with the next run that parses to the same double. A run the
//! scanner cannot see — a hex literal, an underscored literal — has no
//! offset to give, and that number is reported without a position.
//!
//! JSON and the plain-text fallback skip all of this: their extractors
//! already know the offset, because one walks an AST with ranges and the
//! other *is* the scanner.
//!
//! **A run is not always the value's source.** The scan sees the whole
//! document, keys and comments included, so a value can match a run that
//! is not where it came from: in `k26 = 0x1A` the extracted `26` finds
//! the digits in the *key*. The number is still right; the position is a
//! best effort, forward-only so it can never point above a value already
//! reported. Narrowing the scan to value regions would need a
//! position-preserving parser per format, which is the same purchase the
//! `unlocated` count exists to justify.

use super::position::PositionIndex;
use super::{Found, fallback, format, json, render};

/// Pair each number with where it was found, in order.
pub(crate) fn locate(text: &str, format_key: &str, values: &[f64]) -> Vec<Found> {
    let index = PositionIndex::new(text);

    // The two formats that already know. Their extractors are re-run
    // rather than threaded through, because a second scan of one
    // document is cheaper than a signature every format has to carry.
    let spans: Option<Vec<(f64, usize)>> = match format::canonical(format_key) {
        "json" => Some(json::extract_spanned(text)),
        "unknown" => Some(fallback::spanned(text)),
        _ => None,
    };
    if let Some(spans) = spans {
        return spans
            .into_iter()
            .map(|(value, offset)| Found {
                value: render::js_number(value),
                position: Some(index.at(offset)),
            })
            .collect();
    }

    let runs = fallback::spanned(text);
    let mut cursor = 0;

    values
        .iter()
        .map(|&value| {
            // Forward-only. A run earlier than the cursor belongs to a
            // number already reported above this one, and answering with
            // it would put the report out of order.
            // Exact bit equality is what is wanted here, not a
            // tolerance: the run and the extracted value came from the
            // same text through the same parser, so they are the same
            // double or they are a different number.
            let found = runs[cursor..]
                .iter()
                .position(|&(candidate, _)| candidate.to_bits() == value.to_bits());
            let position = found.map(|offset| {
                cursor += offset + 1;
                index.at(runs[cursor - 1].1)
            });
            Found {
                value: render::js_number(value),
                position,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(text: &str, format: &str, values: &[f64]) -> Vec<Option<(usize, usize)>> {
        locate(text, format, values)
            .into_iter()
            .map(|found| found.position.map(|p| (p.line, p.column)))
            .collect()
    }

    #[test]
    fn a_number_is_found_where_it_appears() {
        assert_eq!(at("port = 8080\n", "toml", &[8080.0]), [Some((1, 8))]);
    }

    /// The reason the cursor exists: two of the same value take their
    /// own occurrences.
    #[test]
    fn repeated_values_take_successive_runs() {
        let text = "a = 5\nb = 9\nc = 5\n";
        assert_eq!(
            at(text, "toml", &[5.0, 9.0, 5.0]),
            [Some((1, 5)), Some((2, 5)), Some((3, 5))]
        );
    }

    /// The reason the search is by value rather than by text. `26` never
    /// appears in the document; `0x1A` does, and the scanner cannot read
    /// it as a number.
    #[test]
    fn a_value_the_scanner_cannot_see_gets_no_position() {
        assert_eq!(at("a = 0x1A\n", "toml", &[26.0]), [None]);
    }

    /// A source form the scanner *can* read still matches, even though
    /// its printed form differs.
    #[test]
    fn a_value_written_differently_from_how_it_prints_still_matches() {
        assert_eq!(at("A=+7\n", "env", &[7.0]), [Some((1, 3))]);
        assert_eq!(at("a = 1.5e3\n", "ini", &[1500.0]), [Some((1, 5))]);
    }

    #[test]
    fn a_miss_does_not_move_the_cursor() {
        let text = "a = 1\nb = 3\n";
        assert_eq!(
            at(text, "toml", &[1.0, 2.0, 3.0]),
            [Some((1, 5)), None, Some((2, 5))]
        );
    }

    /// JSON is placed by its parser, so a value whose source text and
    /// printed form differ is still located.
    #[test]
    fn json_is_placed_by_its_parser() {
        assert_eq!(at(r#"{"a":1e21}"#, "json", &[1e21]), [Some((1, 6))]);
    }

    /// The fallback is the scanner, so it places its own values.
    #[test]
    fn the_fallback_places_its_own_runs() {
        assert_eq!(at("rate 0.0825 here", "unknown", &[0.0825]), [Some((1, 6))]);
    }

    /// The limitation, asserted rather than left to be discovered. A
    /// key carrying the same digits takes the match.
    #[test]
    fn a_run_in_a_key_can_take_the_match() {
        assert_eq!(at("k26 = 0x1A\n", "toml", &[26.0]), [Some((1, 2))]);
    }

    #[test]
    fn nothing_to_locate_is_nothing_returned() {
        assert!(locate("anything", "toml", &[]).is_empty());
    }

    /// Columns are UTF-16 units, so a number after a multi-byte
    /// character lands where an editor puts it.
    #[test]
    fn a_column_after_a_multibyte_character_is_counted_in_utf16() {
        assert_eq!(at("café = 42\n", "ini", &[42.0]), [Some((1, 8))]);
    }
}
