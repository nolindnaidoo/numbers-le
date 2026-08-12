//! The shared corpus, embedded and run as unit tests.
//!
//! `fixtures/` is the contract between this crate and the extension.
//! Embedding it means `cargo test` on the published tarball runs every
//! case, so whoever installed this can check the parity claim in the
//! README instead of trusting it.
//!
//! The extension's side is checked by
//! `../scripts/check-extraction-parity.ts`.

/// One corpus document, by name. Panics on a name the corpus does not
/// carry — a test naming a file that is not there is a broken test, not
/// a runtime condition.
#[cfg_attr(not(test), expect(dead_code, reason = "the corpus is a test fixture"))]
pub(crate) fn document(name: &str) -> &'static str {
    match name {
        "numbers.json" => include_str!("../../fixtures/documents/numbers.json"),
        "numbers.yaml" => include_str!("../../fixtures/documents/numbers.yaml"),
        "numbers.toml" => include_str!("../../fixtures/documents/numbers.toml"),
        "mixed-array.toml" => include_str!("../../fixtures/documents/mixed-array.toml"),
        "numbers.ini" => include_str!("../../fixtures/documents/numbers.ini"),
        "numbers.env" => include_str!("../../fixtures/documents/numbers.env"),
        "numbers.csv" => include_str!("../../fixtures/documents/numbers.csv"),
        "numbers.txt" => include_str!("../../fixtures/documents/numbers.txt"),
        "numbers.py" => include_str!("../../fixtures/documents/numbers.py"),
        "numbers.rs" => include_str!("../../fixtures/documents/numbers.rs"),
        "numbers.go" => include_str!("../../fixtures/documents/numbers.go"),
        "numbers.java" => include_str!("../../fixtures/documents/numbers.java"),
        "numbers.ts" => include_str!("../../fixtures/documents/numbers.ts"),
        other => panic!("the corpus has no document named {other}"),
    }
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use crate::extract::render::js_number;

    const CORPUS: &str = include_str!("../../fixtures/extraction.json");

    #[derive(Debug, Deserialize)]
    struct Corpus {
        rendering: Vec<RenderCase>,
    }

    #[derive(Debug, Deserialize)]
    struct RenderCase {
        /// The **source token**, as text a document could hold.
        ///
        /// Deliberately not a JSON number. `serde_json`'s float parsing is
        /// not correctly rounded for every token — it reads
        /// `123456789012345680000` as a double one ULP below the one
        /// Rust's own `str::parse` and JavaScript both produce — so a
        /// corpus of numbers would have been testing the reader rather
        /// than the renderer.
        input: String,
        expected: String,
    }

    /// The rendering contract, checked against the extension's own
    /// answers rather than against this implementation's idea of them.
    #[test]
    fn every_pinned_rendering_matches_javascript() {
        let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
        assert!(!corpus.rendering.is_empty(), "the corpus pins no rendering");

        for case in corpus.rendering {
            let value: f64 = case.input.parse().expect(&case.input);
            assert_eq!(js_number(value), case.expected, "rendering {}", case.input);
        }
    }

    /// The reason the corpus stores text. Left as a live check rather
    /// than a comment, because the day `serde_json` fixes this is the day
    /// the warning in `json.rs` stops needing to be there.
    #[test]
    fn serde_json_still_rounds_a_large_integer_differently() {
        let token = "123456789012345680000";
        let via_serde: f64 = serde_json::from_str(token).expect("a number");
        let via_std: f64 = token.parse().expect("a number");
        assert_ne!(
            via_serde.to_bits(),
            via_std.to_bits(),
            "serde_json now parses this correctly — json.rs can stop working around it"
        );
        assert_eq!(
            js_number(via_std),
            token,
            "str::parse is the one that agrees"
        );
    }

    /// The corpus has to keep covering the boundaries, or it stops being
    /// the thing that would notice them moving.
    #[test]
    fn the_corpus_pins_both_notation_boundaries() {
        let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
        let pinned: Vec<&str> = corpus
            .rendering
            .iter()
            .map(|case| case.expected.as_str())
            .collect();
        for boundary in ["100000000000000000000", "1e+21", "0.000001", "1e-7"] {
            assert!(
                pinned.contains(&boundary),
                "the corpus no longer pins {boundary}"
            );
        }
    }
}

#[cfg(test)]
mod document_tests {
    use serde::Deserialize;

    use super::document;
    use crate::extract::{Notation, Number, Options, extract};

    const CORPUS: &str = include_str!("../../fixtures/extraction.json");

    #[derive(Debug, Deserialize)]
    struct Corpus {
        documents: Vec<Case>,
    }

    #[derive(Debug, Deserialize)]
    struct Case {
        name: String,
        file: String,
        #[serde(rename = "fileType")]
        file_type: String,
        /// Each number as `{ value, notation }` — the extension's answer,
        /// shape included, since 0.2.0 moved the value shape.
        expected: Vec<Expected>,
        errors: Vec<String>,
    }

    #[derive(Debug, Deserialize)]
    struct Expected {
        value: String,
        notation: Notation,
    }

    /// Every number, in the extension's order, printed the way the
    /// extension prints it.
    #[test]
    fn every_corpus_document_reproduces() {
        let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
        assert!(!corpus.documents.is_empty(), "the corpus is empty");

        for case in corpus.documents {
            // The mixed-array TOML is the one sanctioned divergence: the
            // extension's parser is TOML 0.5 and refuses it, this one is
            // 1.0 and reads it. SPEC.md says so and toml.rs tests it.
            if case.file == "mixed-array.toml" {
                assert!(
                    !case.errors.is_empty(),
                    "the divergence has stopped being one"
                );
                continue;
            }
            let expected: Vec<Number> = case
                .expected
                .into_iter()
                .map(|pinned| Number {
                    value: pinned.value,
                    notation: pinned.notation,
                })
                .collect();
            assert_eq!(
                extract(document(&case.file), &case.file_type, Options),
                expected,
                "{}",
                case.name
            );
        }
    }

    #[test]
    fn the_corpus_covers_every_extractor() {
        let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
        for format in [
            "json", "yaml", "toml", "ini", "env", "csv", "unknown", "python", "rust", "go", "java",
        ] {
            assert!(
                corpus.documents.iter().any(|case| case.file_type == format),
                "no corpus case reads {format}"
            );
        }
    }

    /// Every notation this tool can report has a document pinning it, so
    /// the field cannot grow a value nothing checks.
    #[test]
    fn the_corpus_pins_every_notation() {
        let corpus: Corpus = serde_json::from_str(CORPUS).expect("the corpus is valid JSON");
        for notation in [
            Notation::Decimal,
            Notation::Hex,
            Notation::Binary,
            Notation::Octal,
            Notation::Scientific,
            Notation::BigInt,
        ] {
            assert!(
                corpus
                    .documents
                    .iter()
                    .flat_map(|case| &case.expected)
                    .any(|pinned| pinned.notation == notation),
                "no corpus case pins {notation:?}"
            );
        }
    }
}
