//! Numeric literals in a source language.
//!
//! The plain-text scan in `fallback.rs` has no concept of a literal, and
//! on a source file that is not a near miss — it splits on the first
//! character that is not a digit. `0o755` came back as `0` and `755`,
//! `1_000_000` as `1`, `0`, `0`, and — worst of all — `u32` and `i64`
//! came back as `32` and `64`. A Rust file yielded numbers that were
//! never in it, which is the one failure an audit tool cannot have.
//!
//! Two rules do most of the work here:
//!
//! - **A literal never begins inside a word.** That single boundary
//!   check is what makes `u32` a type name again, and it takes `sha256`,
//!   `utf8`, `float32` and `int64` with it.
//! - **A literal is consumed whole, suffix included.** `10u32` is one
//!   number, so the scan resumes *after* the suffix rather than finding
//!   `32` inside it.
//!
//! **It reads comments and strings too**, deliberately. A number written
//! in a comment is still a number in the file, and the reviewer this
//! tool serves is checking constants against a specification — a
//! threshold quoted in a docstring is exactly as interesting as one in
//! an expression. Skipping either would need a per-language lexer, which
//! is a different product.
//!
//! Dialects differ in only three ways that change an answer, and each is
//! a real fork rather than a nicety: `0755` is 493 in C and Go and 755
//! in Rust and Python; `1_000` is a separator in most of these and a
//! suffix in C; `123n` is a `BigInt` in JavaScript and nowhere else.

use super::policy::{Literal, Notation, is_extractable};

/// The three ways a language changes what a literal means.
#[derive(Debug, Clone, Copy)]
struct Dialect {
    /// What a language puts between digit groups: `_` for most of them,
    /// `'` for C++14 and the headers C shares with it, nothing for SQL
    /// and shell.
    separator: Option<u8>,
    /// A leading `0` makes the rest octal. **This is a value fork, not a
    /// notation one**: `0755` is 493 in C, C++, Go and Java, and 755 in
    /// Rust, Python 3, Kotlin and C#. Reading it wrong reports a number
    /// the file does not contain.
    legacy_octal: bool,
    /// `123n`.
    bigint: bool,
}

const PLAIN: Dialect = Dialect {
    separator: None,
    legacy_octal: false,
    bigint: false,
};

/// Every language key `format.rs` routes here.
fn dialect(language: &str) -> Dialect {
    match language {
        "python" | "rust" | "kotlin" | "csharp" => Dialect {
            separator: Some(b'_'),
            ..PLAIN
        },
        "go" | "java" => Dialect {
            separator: Some(b'_'),
            legacy_octal: true,
            ..PLAIN
        },
        // Legacy octal is a syntax error in a module and this reads
        // modern sources, so `0755` here is the digits it looks like.
        "javascript" | "typescript" => Dialect {
            separator: Some(b'_'),
            bigint: true,
            ..PLAIN
        },
        "c" | "cpp" => Dialect {
            separator: Some(b'\''),
            legacy_octal: true,
            ..PLAIN
        },
        // SQL and shell have no separator and no base prefix of their
        // own; hex is still read, because `0xFF` means the same in both.
        _ => PLAIN,
    }
}

pub(crate) fn extract(text: &str, language: &str) -> Vec<Literal> {
    spanned(text, language)
        .into_iter()
        .map(|(literal, _)| literal)
        .collect()
}

/// The literals, each with the byte offset it starts at. A scan already
/// knows where it matched, so a source file places its numbers for free
/// — including the hex and underscored ones the text scanner cannot see.
pub(crate) fn spanned(text: &str, language: &str) -> Vec<(Literal, usize)> {
    let dialect = dialect(language);
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut at = 0;

    while at < bytes.len() {
        let Some(token) = token_at(bytes, at, dialect) else {
            at += 1;
            continue;
        };
        if let Some(literal) = token.literal {
            out.push((literal, at));
        }
        at = token.end;
    }
    out
}

struct Token {
    /// `None` for a literal-shaped run this tool will not report: one
    /// that overflows to infinity, and one whose base-prefixed digits do
    /// not fit 128 bits. The run is still consumed, so the scan cannot
    /// re-enter it and report the digits inside.
    literal: Option<Literal>,
    end: usize,
}

fn token_at(bytes: &[u8], start: usize, dialect: Dialect) -> Option<Token> {
    let here = *bytes.get(start)?;
    let signed = matches!(here, b'+' | b'-');
    if signed && !sign_may_begin(bytes, start) {
        return None;
    }
    let body = if signed { start + 1 } else { start };
    if !body_may_begin(bytes, body) {
        return None;
    }

    let (value, notation, end) = read_body(bytes, body, dialect)?;
    let negative = signed && here == b'-';
    Some(Token {
        literal: value
            .map(|value| if negative { -value } else { value })
            .filter(|value| is_extractable(*value))
            .map(|value| Literal { value, notation }),
        end,
    })
}

/// Whether the byte before an offset belongs to a word.
///
/// Any byte above ASCII counts, so `café1` is one identifier rather than
/// a word and the number 1 — the alternative is a UTF-8 decode on every
/// candidate to answer a question with one right answer.
fn is_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$') || byte >= 0x80
}

/// A sign is part of a literal only where nothing can sit to its left:
/// `x = -1` is negative one, `a-1` is a subtraction and yields 1.
fn sign_may_begin(bytes: &[u8], at: usize) -> bool {
    let Some(previous) = at.checked_sub(1).map(|before| bytes[before]) else {
        return true;
    };
    !is_word(previous) && !matches!(previous, b')' | b']')
}

fn body_may_begin(bytes: &[u8], at: usize) -> bool {
    match bytes.get(at) {
        Some(byte) if byte.is_ascii_digit() => digit_may_begin(bytes, at),
        Some(b'.') => {
            bytes.get(at + 1).is_some_and(u8::is_ascii_digit) && point_may_begin(bytes, at)
        }
        _ => false,
    }
}

/// The boundary rule, and the reason this module exists: `u32` is a type
/// and `sha256` is a name.
///
/// A digit behind a point is refused too when that point follows a value
/// — `t.0` is a tuple index and the `3` of `1.2.3` is the tail of a
/// version, not a third number.
fn digit_may_begin(bytes: &[u8], at: usize) -> bool {
    let Some(previous) = at.checked_sub(1).map(|before| bytes[before]) else {
        return true;
    };
    if is_word(previous) {
        return false;
    }
    if previous != b'.' {
        return true;
    }
    at.checked_sub(2)
        .map(|before| bytes[before])
        .is_none_or(|before| !is_word(before) && !matches!(before, b')' | b']'))
}

/// `.5` is a literal; the `.5` of `x.5`, `f().5` and `1..5` is not.
fn point_may_begin(bytes: &[u8], at: usize) -> bool {
    at.checked_sub(1)
        .map(|before| bytes[before])
        .is_none_or(|previous| !is_word(previous) && !matches!(previous, b')' | b']' | b'.'))
}

fn read_body(bytes: &[u8], at: usize, dialect: Dialect) -> Option<(Option<f64>, Notation, usize)> {
    read_prefixed(bytes, at, dialect).or_else(|| read_decimal(bytes, at, dialect))
}

/// `0xFF`, `0b1010`, `0o755` — the bases that announce themselves.
fn read_prefixed(
    bytes: &[u8],
    at: usize,
    dialect: Dialect,
) -> Option<(Option<f64>, Notation, usize)> {
    if *bytes.get(at)? != b'0' {
        return None;
    }
    let (radix, notation) = match bytes.get(at + 1)? {
        b'x' | b'X' => (16, Notation::Hex),
        b'b' | b'B' => (2, Notation::Binary),
        b'o' | b'O' => (8, Notation::Octal),
        _ => return None,
    };

    let (digits, after) = read_digits(bytes, at + 2, radix, dialect);
    if digits.is_empty() {
        return None;
    }
    let (_, end) = read_suffix(bytes, after);
    Some((from_radix(&digits, radix), notation, end))
}

fn read_decimal(
    bytes: &[u8],
    at: usize,
    dialect: Dialect,
) -> Option<(Option<f64>, Notation, usize)> {
    let (integer, mut end) = read_digits(bytes, at, 10, dialect);
    let mut token = integer.clone();
    let mut notation = if dialect.legacy_octal && is_legacy_octal(&integer) {
        Notation::Octal
    } else {
        Notation::Decimal
    };

    // The point is only part of the literal when a digit follows it, so
    // `1..5` stays a range and `1.max(2)` stays a method call.
    if bytes.get(end) == Some(&b'.') && bytes.get(end + 1).is_some_and(u8::is_ascii_digit) {
        let (fraction, after) = read_digits(bytes, end + 1, 10, dialect);
        token.push('.');
        token.push_str(&fraction);
        end = after;
        notation = Notation::Decimal;
    }

    if token.is_empty() {
        return None;
    }

    if let Some((exponent, after)) = read_exponent(bytes, end, dialect) {
        token.push_str(&exponent);
        end = after;
        notation = Notation::Scientific;
    }

    let (suffix, after) = read_suffix(bytes, end);
    if dialect.bigint && suffix == "n" && notation == Notation::Decimal {
        notation = Notation::BigInt;
    }

    let value = match notation {
        Notation::Octal => from_radix(&token, 8),
        _ => token.parse::<f64>().ok(),
    };
    Some((value, notation, after))
}

/// A leading zero followed only by octal digits. `0` alone is zero, and
/// `08` is not octal in any of these languages.
fn is_legacy_octal(digits: &str) -> bool {
    digits.len() > 1
        && digits.starts_with('0')
        && digits.bytes().all(|byte| (b'0'..=b'7').contains(&byte))
}

/// Digits of one base, with the dialect's separators removed.
///
/// A separator counts only when a digit follows it, which is what leaves
/// the `_f64` of `3.14_f64` to be read as the suffix it is.
fn read_digits(bytes: &[u8], from: usize, radix: u32, dialect: Dialect) -> (String, usize) {
    let mut digits = String::new();
    let mut at = from;

    while at < bytes.len() {
        let byte = bytes[at];
        if is_digit_of(byte, radix) {
            digits.push(char::from(byte));
            at += 1;
            continue;
        }
        let separates = is_separator(byte, dialect)
            && bytes
                .get(at + 1)
                .is_some_and(|next| is_digit_of(*next, radix));
        if !separates {
            break;
        }
        at += 1;
    }
    (digits, at)
}

fn is_digit_of(byte: u8, radix: u32) -> bool {
    char::from(byte).is_digit(radix)
}

fn is_separator(byte: u8, dialect: Dialect) -> bool {
    dialect.separator == Some(byte)
}

/// `e`, an optional sign, and at least one digit. Anything less is not
/// an exponent — the `e` of `1exp` belongs to the suffix.
fn read_exponent(bytes: &[u8], at: usize, dialect: Dialect) -> Option<(String, usize)> {
    if !matches!(bytes.get(at), Some(b'e' | b'E')) {
        return None;
    }
    let signed = matches!(bytes.get(at + 1), Some(b'+' | b'-'));
    let from = if signed { at + 2 } else { at + 1 };
    let (digits, end) = read_digits(bytes, from, 10, dialect);
    if digits.is_empty() {
        return None;
    }
    let sign = if signed {
        char::from(bytes[at + 1]).to_string()
    } else {
        String::new()
    };
    Some((format!("e{sign}{digits}"), end))
}

/// The trailing identifier: `u32`, `L`, `f64`, `n`, `_f32`.
///
/// Consuming it is half the fix — without it the scan resumes inside the
/// suffix and reports the `32` of `10u32`.
fn read_suffix(bytes: &[u8], from: usize) -> (String, usize) {
    let mut at = from;
    while bytes
        .get(at)
        .is_some_and(|byte| is_word(*byte) && *byte < 0x80)
    {
        at += 1;
    }
    (String::from_utf8_lossy(&bytes[from..at]).into_owned(), at)
}

/// A base-prefixed literal is an integer, so it is read as one. Past 128
/// bits there is no correctly-rounded reader here and guessing a double
/// is worse than reporting nothing.
fn from_radix(digits: &str, radix: u32) -> Option<f64> {
    u128::from_str_radix(digits, radix).ok().map(|n| n as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(text: &str, language: &str) -> Vec<f64> {
        extract(text, language)
            .into_iter()
            .map(|literal| literal.value)
            .collect()
    }

    fn notations(text: &str, language: &str) -> Vec<Notation> {
        extract(text, language)
            .into_iter()
            .map(|literal| literal.notation)
            .collect()
    }

    /// The regression this module exists for. Under the text scan these
    /// reported 32, 64, 32 and 64 — numbers no source file contains.
    #[test]
    fn a_type_name_is_not_a_number() {
        for name in [
            "u32", "i64", "f32", "usize", "int64", "sha256", "utf8", "x1",
        ] {
            assert!(values(name, "rust").is_empty(), "{name}");
        }
    }

    #[test]
    fn a_type_suffix_leaves_one_number_behind_it() {
        assert_eq!(values("10u32", "rust"), [10.0]);
        assert_eq!(values("100L", "java"), [100.0]);
        assert_eq!(values("1.5f", "cpp"), [1.5]);
        assert_eq!(values("2.75_f64", "rust"), [2.75]);
        assert_eq!(values("1.5e3f64", "rust"), [1500.0]);
    }

    #[test]
    fn each_base_is_one_number_with_its_own_notation() {
        assert_eq!(values("0xFF", "rust"), [255.0]);
        assert_eq!(notations("0xFF", "rust"), [Notation::Hex]);
        assert_eq!(values("0XFF", "c"), [255.0]);
        assert_eq!(values("0b1010", "rust"), [10.0]);
        assert_eq!(notations("0b1010", "rust"), [Notation::Binary]);
        assert_eq!(values("0o755", "rust"), [493.0]);
        assert_eq!(notations("0o755", "rust"), [Notation::Octal]);
    }

    #[test]
    fn a_separator_does_not_split_a_number() {
        assert_eq!(values("1_000_000", "rust"), [1_000_000.0]);
        assert_eq!(values("1_000_000", "python"), [1_000_000.0]);
        assert_eq!(values("1'000'000", "cpp"), [1_000_000.0]);
        assert_eq!(values("0xFF_FF", "rust"), [65535.0]);
    }

    /// A separator in a language that has none is not one, so `1_000`
    /// there is the number 1 with an identifier stuck to it — and
    /// `1'000` in Python is the number 1 beside a quoted string.
    #[test]
    fn a_separator_belongs_to_the_dialect_that_has_it() {
        assert_eq!(values("1_000", "sql"), [1.0]);
        assert_eq!(values("1'000'", "python"), [1.0, 0.0]);
    }

    /// The value fork. Reading this wrong reports a number the file does
    /// not contain, in whichever direction it is wrong.
    #[test]
    fn a_leading_zero_is_octal_only_where_the_language_says_so() {
        for language in ["c", "cpp", "go", "java"] {
            assert_eq!(values("0755", language), [493.0], "{language}");
            assert_eq!(notations("0755", language), [Notation::Octal], "{language}");
        }
        for language in ["rust", "python", "csharp", "kotlin", "javascript", "sql"] {
            assert_eq!(values("0755", language), [755.0], "{language}");
            assert_eq!(
                notations("0755", language),
                [Notation::Decimal],
                "{language}"
            );
        }
    }

    #[test]
    fn a_leading_zero_that_is_not_octal_stays_decimal() {
        assert_eq!(values("0", "go"), [0.0]);
        assert_eq!(values("08", "go"), [8.0]);
        assert_eq!(values("0.5", "go"), [0.5]);
    }

    #[test]
    fn a_bigint_is_a_bigint_only_in_javascript() {
        assert_eq!(values("123n", "javascript"), [123.0]);
        assert_eq!(notations("123n", "javascript"), [Notation::BigInt]);
        assert_eq!(notations("123n", "typescript"), [Notation::BigInt]);
        assert_eq!(notations("123n", "python"), [Notation::Decimal]);
        // A base still wins: the digits are what was written.
        assert_eq!(notations("0xFFn", "javascript"), [Notation::Hex]);
    }

    #[test]
    fn an_exponent_is_scientific() {
        assert_eq!(values("1.5e3", "python"), [1500.0]);
        assert_eq!(notations("1.5e3", "python"), [Notation::Scientific]);
        assert_eq!(values("1e-7", "python"), [1e-7]);
        assert_eq!(values("1E5", "python"), [100_000.0]);
    }

    /// An `e` with nothing usable after it is a suffix, not an exponent.
    #[test]
    fn an_incomplete_exponent_is_part_of_the_suffix() {
        assert_eq!(values("1exp", "python"), [1.0]);
        assert_eq!(values("1e", "python"), [1.0]);
        assert_eq!(values("1e+", "python"), [1.0]);
    }

    #[test]
    fn a_sign_is_read_where_a_value_cannot_be() {
        assert_eq!(values("x = -1", "rust"), [-1.0]);
        assert_eq!(values("(-0.5)", "rust"), [-0.5]);
        assert_eq!(values("+7", "rust"), [7.0]);
        // A subtraction, not a negative number.
        assert_eq!(values("a-1", "rust"), [1.0]);
        assert_eq!(values("f()-1", "rust"), [1.0]);
        assert_eq!(values("xs[0]-1", "rust"), [0.0, 1.0]);
    }

    /// The text scan reads this as 1.2 and 0.3. A grammar knows better.
    #[test]
    fn a_version_string_is_not_two_numbers() {
        assert_eq!(values("v1.2.3", "python"), Vec::<f64>::new());
        assert_eq!(values("\"1.2.3\"", "python"), [1.2]);
    }

    #[test]
    fn a_field_access_is_not_a_number() {
        assert_eq!(values("t.0", "rust"), Vec::<f64>::new());
        assert_eq!(values("xs[1].0", "rust"), [1.0]);
    }

    #[test]
    fn a_leading_point_is_a_number_where_nothing_precedes_it() {
        assert_eq!(values("x = .5", "python"), [0.5]);
        assert_eq!(values("[.5]", "javascript"), [0.5]);
    }

    /// A range is two numbers, not one fraction between them.
    #[test]
    fn a_range_keeps_both_of_its_bounds() {
        assert_eq!(values("0..10", "rust"), [0.0, 10.0]);
    }

    #[test]
    fn a_run_is_consumed_whole_so_the_scan_cannot_re_enter_it() {
        assert_eq!(values("let m: u32 = 0o755;", "rust"), [493.0]);
        assert_eq!(values("const BIG: usize = 1_000_000;", "rust"), [1e6]);
    }

    #[test]
    fn numbers_come_back_in_document_order() {
        assert_eq!(
            values("a = 1\nb = 0x10\nc = 2.5\n", "python"),
            [1.0, 16.0, 2.5]
        );
    }

    #[test]
    fn a_span_points_at_the_start_of_the_literal() {
        let text = "let mask: u64 = 0xFF;";
        let (literal, offset) = spanned(text, "rust")[0];
        assert_eq!(literal.value, 255.0);
        assert_eq!(&text[offset..offset + 4], "0xFF");
    }

    #[test]
    fn a_signed_span_starts_at_the_sign() {
        let text = "x = -42";
        let (literal, offset) = spanned(text, "python")[0];
        assert_eq!(literal.value, -42.0);
        assert_eq!(&text[offset..], "-42");
    }

    /// An overflowing literal is infinity, and infinity is not a number
    /// this tool emits — but the run is still consumed, so its digits
    /// cannot come back as separate numbers.
    #[test]
    fn an_overflowing_literal_is_consumed_and_not_reported() {
        assert!(values("1e400", "python").is_empty());
        assert!(values(&format!("0x{}", "F".repeat(40)), "rust").is_empty());
    }

    #[test]
    fn a_bare_base_prefix_is_not_a_literal() {
        assert_eq!(values("0x", "rust"), [0.0]);
        assert_eq!(values("0xZZ", "rust"), [0.0]);
    }

    #[test]
    fn text_without_numbers_yields_nothing() {
        assert!(values("fn main() { println!(\"hello\"); }", "rust").is_empty());
    }

    /// A non-ASCII byte is part of a word, so an identifier carrying one
    /// does not shed a number.
    #[test]
    fn a_word_with_a_non_ascii_character_is_still_a_word() {
        assert!(values("café1", "python").is_empty());
    }

    /// An unrecognised key still scans, with no dialect extras. The
    /// router never sends one, and answering rather than panicking keeps
    /// that a routing bug instead of a crash.
    #[test]
    fn an_unknown_language_reads_the_universal_shapes() {
        assert_eq!(values("0xFF 1_000 0755", "wat"), [255.0, 1.0, 755.0]);
    }
}
