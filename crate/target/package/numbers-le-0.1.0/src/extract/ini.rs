//! INI, read with `rust-ini` where the extension reads with `ini`.
//!
//! **Untyped**: every value here is text, so a numeric-looking one is a
//! number. That is the same rule as `.env` and CSV, and the opposite of
//! JSON, YAML and TOML — where `0x1A` is resolved by the parser and
//! counts, here it stays a string and the strict test rejects it.
//!
//! Escape processing is off and bare keys are dropped before parsing,
//! both to match the npm parser. Those two were found the hard way in
//! string-le, whose INI extractor sits in the same seat.

use super::policy::{Coercion, Value, collect};

fn options() -> ini::ParseOption {
    ini::ParseOption {
        enabled_escape: false,
        ..ini::ParseOption::default()
    }
}

/// Drop the unindented separator-less lines that the npm `ini` package
/// tolerates and `rust-ini` rejects. An indented one continues the value
/// above it and must survive.
fn without_bare_keys(text: &str) -> String {
    text.lines()
        .filter(|line| {
            let trimmed = line.trim();
            trimmed.is_empty()
                || line.starts_with(char::is_whitespace)
                || trimmed.starts_with(';')
                || trimmed.starts_with('#')
                || trimmed.starts_with('[')
                || trimmed.contains('=')
                || trimmed.contains(':')
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub(crate) fn extract(text: &str) -> Vec<f64> {
    let Ok(parsed) = ini::Ini::load_from_str_opt(&without_bare_keys(text), options()) else {
        return Vec::new();
    };
    let mut values = Vec::new();
    for (_, properties) in &parsed {
        for (_, value) in properties {
            values.push(Value::Text(value.to_string()));
        }
    }
    collect(&Value::Seq(values), Coercion::Untyped)
}

pub(crate) fn parse_error(text: &str) -> Option<String> {
    ini::Ini::load_from_str_opt(&without_bare_keys(text), options())
        .err()
        .map(|error| format!("Failed to parse INI: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numeric_looking_values_are_numbers_here() {
        assert_eq!(extract("[s]\nport = 8080\nrate = 0.0825"), [8080.0, 0.0825]);
    }

    #[test]
    fn an_exponent_is_read() {
        assert_eq!(extract("[s]\na = -1.5e3"), [-1500.0]);
    }

    /// The strict test, doing the job it exists for. `parseFloat` read
    /// the first two of these as 12 and 1.2.
    #[test]
    fn partly_numeric_values_are_rejected() {
        assert!(extract("[s]\na = 12abc\nb = 1.2.3\nc = hello").is_empty());
    }

    /// The mirror of the YAML and TOML tests: no parser resolves this
    /// here, so it stays text and the strict test refuses it.
    #[test]
    fn hex_and_underscored_values_are_not_numbers_here() {
        assert!(extract("[s]\na = 0x1A\nb = 1_000").is_empty());
    }

    #[test]
    fn comment_lines_are_skipped() {
        assert_eq!(extract("[s]\n; n = 1\n# m = 2\na = 3"), [3.0]);
    }

    #[test]
    fn sections_are_walked_in_order() {
        assert_eq!(extract("[one]\na = 1\n\n[two]\nb = 2"), [1.0, 2.0]);
    }

    /// An indented line with no separator is left in place rather than
    /// dropped as a bare key. Checked against the extension, which reads
    /// this document as `1` and `8080` — the continuation contributes
    /// nothing either way, and dropping the line could have changed the
    /// value above it.
    #[test]
    fn an_indented_continuation_is_not_a_bare_key() {
        assert_eq!(extract("[s]\nmulti = 1\n  2\nport = 8080"), [1.0, 8080.0]);
    }

    #[test]
    fn a_document_that_cannot_parse_yields_nothing_and_says_why() {
        assert!(extract("[unclosed").is_empty());
        assert!(parse_error("[unclosed").is_some());
        assert!(parse_error("[s]\na = 1").is_none());
    }

    #[test]
    fn a_bare_key_does_not_take_the_file_down_with_it() {
        assert_eq!(extract("[s]\nport = 8080\nbarekey"), [8080.0]);
    }
}
