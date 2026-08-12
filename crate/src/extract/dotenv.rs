//! `.env`, line by line — the one format the extension parses by hand.
//!
//! **Untyped**, like INI and CSV: every value is text, so `PORT=8080`
//! yields the number 8080.

use super::js;
use super::policy::{Literal, strict_number};

pub(crate) fn extract(text: &str) -> Vec<Literal> {
    text.lines().filter_map(value_of).collect()
}

/// Every trim here is JavaScript's, not Rust's: the npm `dotenv` package
/// the extension parses with trims `\s`, which includes U+FEFF and not
/// U+0085 — the opposite of `str::trim` on both counts.
fn value_of(raw_line: &str) -> Option<Literal> {
    let line = js::trim(raw_line);
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    let content = line.strip_prefix("export ").map_or(line, js::trim);
    let (_, raw_value) = content.split_once('=')?;
    strict_number(unquote(strip_inline_comment(js::trim(raw_value))))
}

/// A `#` inside a quoted value is part of the value, which is the whole
/// reason quoting exists in these files.
fn strip_inline_comment(value: &str) -> &str {
    if value.starts_with('"') || value.starts_with('\'') {
        return value;
    }
    value
        .split_once('#')
        .map_or(value, |(before, _)| js::trim(before))
}

fn unquote(value: &str) -> &str {
    for quote in ['"', '\''] {
        if value.len() > 1 && value.starts_with(quote) && value.ends_with(quote) {
            return &value[1..value.len() - 1];
        }
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(text: &str) -> Vec<f64> {
        extract(text)
            .into_iter()
            .map(|literal| literal.value)
            .collect()
    }

    #[test]
    fn a_numeric_value_is_a_number() {
        assert_eq!(values("PORT=8080"), [8080.0]);
    }

    #[test]
    fn signs_and_leading_points_are_read() {
        assert_eq!(values("A=+7\nB=.5\nC=-1.5e3"), [7.0, 0.5, -1500.0]);
    }

    #[test]
    fn keys_are_never_read_as_numbers() {
        assert!(values("PORT8080=hello").is_empty());
    }

    #[test]
    fn comments_and_blank_lines_are_skipped() {
        assert_eq!(values("# n = 1\n\nA=2\n   \nB=3"), [2.0, 3.0]);
    }

    #[test]
    fn an_export_prefix_is_removed() {
        assert_eq!(values("export PORT=8080"), [8080.0]);
    }

    #[test]
    fn quotes_are_removed_before_the_strict_test() {
        assert_eq!(values("A=\"42\"\nB='7'"), [42.0, 7.0]);
    }

    #[test]
    fn an_inline_comment_ends_an_unquoted_value() {
        assert_eq!(values("A=42 # the port"), [42.0]);
    }

    #[test]
    fn non_numeric_values_are_skipped() {
        assert!(values("A=hello\nB=0x1A\nC=1_000\nD=").is_empty());
    }

    /// The trims are JavaScript's. A value led by a byte-order mark is a
    /// number, and one led by U+0085 is not — the reverse of what
    /// `str::trim` would give, and the extension's answer either way.
    #[test]
    fn the_trims_are_the_ones_the_extension_performs() {
        assert_eq!(values("A=\u{feff}42"), [42.0]);
        assert_eq!(values("\u{feff}A=42"), [42.0]);
        assert!(values("A=\u{85}42").is_empty());
        assert!(values("A=42\u{85}").is_empty());
    }
}
