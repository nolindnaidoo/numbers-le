//! CSV, read with `csv` where the extension reads with `csv-parse`.
//!
//! **Every row is data.** There is no header inference here and none in
//! the extension — its v1.x streaming path silently consumed the first
//! row as a header and disagreed with its own synchronous path, and one
//! rule for both is what fixed it. A header row of column names simply
//! yields no numbers, which is the right answer for a row of names.
//!
//! **Untyped**, like INI and `.env`: a numeric-looking cell is a number.

use super::policy::{Literal, strict_number};

/// Move the whitespace around a quoted field before parsing, and catch
/// an unterminated quote.
///
/// `csv-parse` trims a cell and then decides whether it is quoted; the
/// `csv` crate decides first and trims after, so ` "1, 2"` was never a
/// quoted field. Found in string-le, whose CSV extractor sits in the
/// same seat.
fn trim_around_quotes(text: &str) -> Result<String, String> {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    let mut at_field_start = true;

    while let Some(character) = chars.next() {
        if at_field_start && (character == ' ' || character == '\t') {
            let mut held = String::from(character);
            while let Some(&next) = chars.peek() {
                if next == ' ' || next == '\t' {
                    held.push(next);
                    chars.next();
                } else {
                    break;
                }
            }
            if chars.peek() != Some(&'"') {
                out.push_str(&held);
            }
            at_field_start = false;
            continue;
        }

        if character == '"' && at_field_start {
            out.push('"');
            at_field_start = false;
            let mut closed = false;
            while let Some(inner) = chars.next() {
                out.push(inner);
                if inner == '"' {
                    if chars.peek() == Some(&'"') {
                        out.push(chars.next().expect("peeked"));
                        continue;
                    }
                    while matches!(chars.peek(), Some(' ' | '\t')) {
                        chars.next();
                    }
                    closed = true;
                    break;
                }
            }
            if !closed {
                return Err("Failed to parse CSV: quoted field is never closed".to_string());
            }
            continue;
        }

        out.push(character);
        at_field_start = matches!(character, ',' | '\n' | '\r');
    }
    Ok(out)
}

/// The byte between cells. Tab-separated files are the same grammar
/// with a different one, and reading a tab row on commas made the whole
/// row a single cell — never numeric in full, so a `.tsv` of ports and
/// rates reported nothing, with no diagnostic and exit 1.
pub(crate) const COMMA: u8 = b',';
pub(crate) const TAB: u8 = b'\t';

fn rows(text: &str, delimiter: u8) -> Result<Vec<Vec<String>>, String> {
    let text = trim_around_quotes(text)?;
    csv::ReaderBuilder::new()
        .delimiter(delimiter)
        // csv-parse's `columns: false`: every record is cells, and the
        // first row is never special.
        .has_headers(false)
        // `relax_column_count`: a ragged row is data, not a failure.
        .flexible(true)
        .from_reader(text.as_bytes())
        .records()
        .map(|record| {
            record
                .map(|row| row.iter().map(str::to_string).collect())
                .map_err(|error| format!("Failed to parse CSV: {error}"))
        })
        .collect()
}

pub(crate) fn extract(text: &str, delimiter: u8) -> Vec<Literal> {
    let Ok(rows) = rows(text, delimiter) else {
        return Vec::new();
    };
    rows.iter()
        .flat_map(|row| row.iter())
        .filter_map(|cell| strict_number(cell))
        .collect()
}

pub(crate) fn parse_error(text: &str, delimiter: u8) -> Option<String> {
    rows(text, delimiter).err()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(text: &str) -> Vec<f64> {
        extract(text, COMMA)
            .into_iter()
            .map(|literal| literal.value)
            .collect()
    }

    /// The delimiter is the whole fix: on commas a tab row is one cell,
    /// never numeric in full, so the document reported nothing.
    #[test]
    fn a_tab_row_is_cells_under_tab_and_one_cell_under_comma() {
        assert_eq!(extract("id\tport\nsvc\t8080\n", TAB).len(), 1);
        assert!(extract("id\tport\nsvc\t8080\n", COMMA).is_empty());
    }

    #[test]
    fn numeric_cells_are_numbers() {
        assert_eq!(values("1,2.5\n3,4"), [1.0, 2.5, 3.0, 4.0]);
    }

    /// No header inference, in either frontend. A row of names yields no
    /// numbers, which is the right answer for a row of names.
    #[test]
    fn the_first_row_is_data_like_any_other() {
        assert_eq!(values("id,rate\n1,0.0825"), [1.0, 0.0825]);
        assert_eq!(values("1,2\n3,4"), [1.0, 2.0, 3.0, 4.0]);
    }

    #[test]
    fn non_numeric_cells_are_skipped() {
        assert_eq!(values("1,3abc,alpha,2"), [1.0, 2.0]);
    }

    #[test]
    fn empty_cells_are_skipped() {
        assert_eq!(values("1,,2"), [1.0, 2.0]);
    }

    #[test]
    fn a_quoted_cell_may_contain_the_delimiter() {
        assert_eq!(values("\"1,2\",3"), [3.0]);
    }

    #[test]
    fn whitespace_before_a_quoted_field_does_not_break_it() {
        assert_eq!(values("1, \"2\"\n"), [1.0, 2.0]);
    }

    #[test]
    fn ragged_rows_are_data_not_failure() {
        assert_eq!(values("1,2,3\n4"), [1.0, 2.0, 3.0, 4.0]);
        assert!(parse_error("1,2,3\n4", COMMA).is_none());
    }

    #[test]
    fn an_unterminated_quote_is_a_parse_failure() {
        assert!(values("1,\"unterminated").is_empty());
        assert!(parse_error("1,\"unterminated", COMMA).is_some());
    }
}
