//! `.env`, line by line — the one format the extension parses by hand.
//!
//! **Untyped**, like INI and CSV: every value is text, so `PORT=8080`
//! yields the number 8080.

use super::policy::strict_number;

pub(crate) fn extract(text: &str) -> Vec<f64> {
    text.lines().filter_map(value_of).collect()
}

fn value_of(raw_line: &str) -> Option<f64> {
    let line = raw_line.trim();
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    let content = line.strip_prefix("export ").map_or(line, str::trim);
    let (_, raw_value) = content.split_once('=')?;
    strict_number(unquote(strip_inline_comment(raw_value.trim())))
}

/// A `#` inside a quoted value is part of the value, which is the whole
/// reason quoting exists in these files.
fn strip_inline_comment(value: &str) -> &str {
    if value.starts_with('"') || value.starts_with('\'') {
        return value;
    }
    value
        .split_once('#')
        .map_or(value, |(before, _)| before.trim())
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

    #[test]
    fn a_numeric_value_is_a_number() {
        assert_eq!(extract("PORT=8080"), [8080.0]);
    }

    #[test]
    fn signs_and_leading_points_are_read() {
        assert_eq!(extract("A=+7\nB=.5\nC=-1.5e3"), [7.0, 0.5, -1500.0]);
    }

    #[test]
    fn keys_are_never_read_as_numbers() {
        assert!(extract("PORT8080=hello").is_empty());
    }

    #[test]
    fn comments_and_blank_lines_are_skipped() {
        assert_eq!(extract("# n = 1\n\nA=2\n   \nB=3"), [2.0, 3.0]);
    }

    #[test]
    fn an_export_prefix_is_removed() {
        assert_eq!(extract("export PORT=8080"), [8080.0]);
    }

    #[test]
    fn quotes_are_removed_before_the_strict_test() {
        assert_eq!(extract("A=\"42\"\nB='7'"), [42.0, 7.0]);
    }

    #[test]
    fn an_inline_comment_ends_an_unquoted_value() {
        assert_eq!(extract("A=42 # the port"), [42.0]);
    }

    #[test]
    fn non_numeric_values_are_skipped() {
        assert!(extract("A=hello\nB=0x1A\nC=1_000\nD=").is_empty());
    }
}
