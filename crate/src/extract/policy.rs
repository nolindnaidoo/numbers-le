//! The one numeric policy every format extractor shares.
//!
//! Ported from `heuristics.ts`, which is already the single source the
//! extension's six extractors share. One policy in one place is why
//! `12abc` is rejected everywhere rather than in four places out of six.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

/// How a literal was written, where this tool read the literal itself.
///
/// The field exists because `0x1A` and `26` are the same number and not
/// the same line of code, and a reviewer checking a constant against a
/// specification is reading the code, not the double.
///
/// **It follows coercion.** A typed format hands over a number its own
/// parser already resolved — `0x1A` is 26 by the time TOML reaches this
/// module, and the token is gone — so those report `decimal`. An untyped
/// format hands over text that this module parses itself, so those keep
/// what the text said. Source languages and the plain-text scan read
/// their literals directly and keep everything.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Notation {
    Decimal,
    Hex,
    Binary,
    Octal,
    Scientific,
    BigInt,
}

/// One number, and how the source wrote it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Literal {
    pub(crate) value: f64,
    pub(crate) notation: Notation,
}

impl Literal {
    pub(crate) const fn decimal(value: f64) -> Self {
        Self {
            value,
            notation: Notation::Decimal,
        }
    }
}

/// Whether a double still says what the integer literal said.
///
/// Past 2^53 the gap between neighbouring doubles is more than one, so
/// a literal can land on a value that is not the one written. The
/// boundary is not a single constant: 2^53 itself round-trips exactly,
/// and so do larger even numbers, while 2^53 + 1 does not. Asking the
/// double directly is both simpler and correct where a cutoff is not.
///
/// A tool whose entire output is numbers must never print a number that
/// was not in the file. `big = 9007199254740993` parsed into a double
/// and printed back came out `9007199254740992` — not the value, not a
/// refusal, just quietly wrong.
///
/// The extension cannot hold these at all: every JavaScript number is a
/// double, so `@iarna/toml` wraps past the i64 range and drops the
/// value. Reporting the exact literal here would therefore make the
/// shared `extract_numbers` tool answer differently on the two servers,
/// which is the one thing it may not do. Both sides showing nothing is
/// the answer they can both give, and it is the honest one: absent
/// beats wrong.
pub(crate) fn holds_exactly(value: i64) -> bool {
    #[expect(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        reason = "the lossy cast is the question being asked, and the \
                  round trip back to i64 is what answers it"
    )]
    let round_trip = (value as f64) as i64;
    round_trip == value
}

/// The same question for a literal this module parsed from text.
///
/// Only plain integers are checked. A fractional or exponent literal is
/// approximate by nature and its shortest round-trip rendering is the
/// documented answer, so `0.1` is not a defect and must not be dropped.
pub(crate) fn text_holds_exactly(text: &str) -> bool {
    let digits = text.strip_prefix(['-', '+']).unwrap_or(text);
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return true;
    }
    match text.parse::<i64>() {
        Ok(exact) => holds_exactly(exact),
        // Wider than i64 is wider than the exact range by definition.
        Err(_) => false,
    }
}

/// Decimal or scientific, for a token matching the plain grammar below.
/// Nothing else can appear there: the strict test rejects every base
/// prefix before this is reached.
pub(crate) fn plain_notation(token: &str) -> Notation {
    if token.contains(['e', 'E']) {
        return Notation::Scientific;
    }
    Notation::Decimal
}

/// A string is a number only if **all** of it is one: optional sign,
/// digits, an optional decimal point, an optional exponent.
///
/// The rejections are the point. `parseFloat` in the extension's v1.x
/// read `12abc` as 12 and `1.2.3` as 1.2, and a version string quietly
/// becoming a number is the kind of wrong an audit cannot see. Hex and
/// underscored literals are rejected here too — where a *parser*
/// resolves them, as YAML and TOML do for `0x1A`, they arrive as numbers
/// already and never reach this test.
static STRICT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$").expect("a constant pattern compiles")
});

/// Parse a string as a number only if the entire string is numeric.
///
/// The trim is JavaScript's, because `heuristics.ts` calls
/// `String.prototype.trim` here and the two sets are not the same one:
/// Rust strips U+0085 and keeps U+FEFF. Both characters lead real
/// values in real files — a CSV cell copied out of a spreadsheet begins
/// with a byte-order mark — and either spelling made a number appear on
/// one server and not the other.
pub(crate) fn strict_number(raw: &str) -> Option<Literal> {
    let trimmed = super::js::trim(raw);
    if !STRICT.is_match(trimmed) {
        return None;
    }
    trimmed
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
        .map(|value| Literal {
            value,
            notation: plain_notation(trimmed),
        })
}

/// The numbers this tool emits: finite, and actually numbers.
///
/// `NaN` and `±Infinity` are rejected even where a format can express
/// them — YAML `.inf`, TOML `nan`. JSON cannot express them at all, so
/// finite-only is what keeps the formats answering consistently, and an
/// extracted `Infinity` is noise to everything downstream.
pub(crate) fn is_extractable(value: f64) -> bool {
    value.is_finite()
}

/// A parsed document, in the shape every parser here is normalised into.
///
/// `Date` is a variant of its own rather than a number or a string,
/// because the extension skips it explicitly and a TOML datetime would
/// otherwise arrive as text and be coerced.
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Value {
    Number(f64),
    Text(String),
    /// A date, a boolean, a null — anything with a type of its own that
    /// is not a number.
    Other,
    Seq(Vec<Value>),
    Map(Vec<Value>),
}

/// Whether a format's text values count as numbers.
///
/// **Per format, and not negotiable per call.** INI, `.env` and CSV
/// values are inherently text, so a numeric-looking one *is* a number
/// there. JSON, YAML and TOML distinguish `42` from `"42"`, and a quoted
/// number in those is data — a version pinned as a string, an id that
/// must not lose its leading zero.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Coercion {
    /// The format has types; only real numbers count.
    Typed,
    /// The format is all text; numeric-looking values count.
    Untyped,
}

/// Collect numbers depth-first, in document order.
pub(crate) fn collect(value: &Value, coercion: Coercion) -> Vec<Literal> {
    let mut out = Vec::new();
    walk(value, coercion, &mut out);
    out
}

fn walk(value: &Value, coercion: Coercion, out: &mut Vec<Literal>) {
    match value {
        // The parser already resolved this one, notation and all — see
        // the note on `Notation`.
        Value::Number(number) => {
            if is_extractable(*number) {
                out.push(Literal::decimal(*number));
            }
        }
        Value::Text(text) => {
            if coercion == Coercion::Untyped
                && let Some(number) = strict_number(text)
            {
                out.push(number);
            }
        }
        Value::Seq(items) | Value::Map(items) => {
            for item in items {
                walk(item, coercion, out);
            }
        }
        Value::Other => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(literals: &[Literal]) -> Vec<f64> {
        literals.iter().map(|literal| literal.value).collect()
    }

    fn number(raw: &str) -> Option<f64> {
        strict_number(raw).map(|literal| literal.value)
    }

    #[test]
    fn a_fully_numeric_string_parses() {
        assert_eq!(number("42"), Some(42.0));
        assert_eq!(number("-1.5e3"), Some(-1500.0));
        assert_eq!(number("+7"), Some(7.0));
        assert_eq!(number(".5"), Some(0.5));
        assert_eq!(number("  8  "), Some(8.0));
    }

    /// The trim is JavaScript's. A byte-order mark leading a value —
    /// which is what a spreadsheet export hands you — is whitespace, and
    /// U+0085 is not, whatever Rust thinks of either.
    #[test]
    fn the_trim_is_the_one_the_extension_performs() {
        assert_eq!(number("\u{feff}42"), Some(42.0));
        assert_eq!(number("42\u{feff}"), Some(42.0));
        assert_eq!(number("\u{85}42"), None);
        assert_eq!(number("42\u{85}"), None);
    }

    /// An untyped format keeps what its text said, because this module
    /// is what parsed it.
    #[test]
    fn a_coerced_string_carries_the_notation_its_text_used() {
        assert_eq!(
            strict_number("42").expect("a number").notation,
            Notation::Decimal
        );
        assert_eq!(
            strict_number("-1.5e3").expect("a number").notation,
            Notation::Scientific
        );
        assert_eq!(
            strict_number("1E5").expect("a number").notation,
            Notation::Scientific
        );
    }

    /// The rejections are the policy. Each of these was a silent wrong
    /// answer under `parseFloat`.
    #[test]
    fn a_partly_numeric_string_is_not_a_number() {
        for input in ["12abc", "1.2.3", "0x1A", "1_000", "", "abc", "1,000", "--1"] {
            assert_eq!(number(input), None, "{input}");
        }
    }

    #[test]
    fn non_finite_values_are_never_extractable() {
        assert!(!is_extractable(f64::NAN));
        assert!(!is_extractable(f64::INFINITY));
        assert!(!is_extractable(f64::NEG_INFINITY));
        assert!(is_extractable(0.0));
    }

    /// An exponent large enough to overflow is infinity, not a number.
    #[test]
    fn an_overflowing_literal_is_rejected() {
        assert_eq!(number("1e400"), None);
    }

    #[test]
    fn a_typed_format_ignores_numeric_looking_text() {
        let document = Value::Map(vec![Value::Number(42.0), Value::Text("7".to_string())]);
        assert_eq!(values(&collect(&document, Coercion::Typed)), [42.0]);
    }

    #[test]
    fn an_untyped_format_reads_numeric_looking_text() {
        let document = Value::Map(vec![Value::Number(42.0), Value::Text("7".to_string())]);
        assert_eq!(values(&collect(&document, Coercion::Untyped)), [42.0, 7.0]);
    }

    /// A typed format's parser resolved the literal before this module
    /// saw it, so the token — and its notation — is already gone.
    #[test]
    fn a_parsed_number_is_reported_as_decimal() {
        let document = Value::Seq(vec![Value::Number(1e21)]);
        assert_eq!(
            collect(&document, Coercion::Typed)[0].notation,
            Notation::Decimal
        );
    }

    #[test]
    fn nesting_is_walked_in_document_order() {
        let document = Value::Map(vec![
            Value::Number(1.0),
            Value::Seq(vec![Value::Number(2.0), Value::Other, Value::Number(3.0)]),
            Value::Map(vec![Value::Number(4.0)]),
        ]);
        assert_eq!(
            values(&collect(&document, Coercion::Typed)),
            [1.0, 2.0, 3.0, 4.0]
        );
    }

    /// A date is not a number, in any format, coerced or not.
    #[test]
    fn a_date_is_never_a_number() {
        let document = Value::Map(vec![Value::Other, Value::Number(1.0)]);
        assert_eq!(values(&collect(&document, Coercion::Untyped)), [1.0]);
    }

    #[test]
    fn non_finite_numbers_are_dropped_by_the_walk() {
        let document = Value::Seq(vec![
            Value::Number(f64::INFINITY),
            Value::Number(f64::NAN),
            Value::Number(1.0),
        ]);
        assert_eq!(values(&collect(&document, Coercion::Typed)), [1.0]);
    }

    /// Duplicates are values too; collapsing them here would make
    /// `--dedupe` unable to be opt-in.
    #[test]
    fn repeats_are_kept() {
        let document = Value::Seq(vec![Value::Number(5.0), Value::Number(5.0)]);
        assert_eq!(values(&collect(&document, Coercion::Typed)), [5.0, 5.0]);
    }
}
