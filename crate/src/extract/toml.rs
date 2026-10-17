//! TOML, read with `toml`. The extension reads with a transcription of
//! the same crate (`src/parsers/toml/`), so a mixed inline array, an
//! integer past 2^53 and an integer past `i64` are read, or refused, the
//! same way on both sides; `fixtures/documents/mixed-array.toml` pins the
//! first.

use toml::Value as Toml;

use super::policy::{Coercion, Literal, Value, collect};

pub(crate) fn extract(text: &str) -> Vec<Literal> {
    let Ok(parsed) = text.parse::<toml::Table>() else {
        return Vec::new();
    };
    collect(
        &Value::Map(parsed.values().map(convert).collect()),
        Coercion::Typed,
    )
}

fn convert(value: &Toml) -> Value {
    match value {
        Toml::Integer(number) => Value::Number(*number as f64),
        Toml::Float(number) => Value::Number(*number),
        Toml::String(text) => Value::Text(text.clone()),
        Toml::Array(items) => Value::Seq(items.iter().map(convert).collect()),
        Toml::Table(entries) => Value::Map(entries.values().map(convert).collect()),
        // A datetime is a typed value, and the extension skips it
        // explicitly for the same reason.
        Toml::Boolean(_) | Toml::Datetime(_) => Value::Other,
    }
}

pub(crate) fn parse_error(text: &str) -> Option<String> {
    text.parse::<toml::Table>()
        .err()
        .map(|error| format!("Failed to parse TOML: {error}"))
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
    fn integers_and_floats_are_both_numbers() {
        assert_eq!(values("a = 8080\nb = 0.0825"), [8080.0, 0.0825]);
    }

    #[test]
    fn a_quoted_number_is_not_a_number() {
        assert_eq!(values("a = 42\nb = \"42\""), [42.0]);
    }

    /// TOML's own literals, resolved by the parser before the policy.
    #[test]
    fn hex_and_underscored_literals_are_resolved_by_the_parser() {
        assert_eq!(values("a = 0x1A"), [26.0]);
        assert_eq!(values("a = 1_000"), [1000.0]);
    }

    /// A TOML integer is an i64 and a JavaScript number is an f64, so
    /// past 2^53 the value loses precision — the same precision a
    /// JavaScript number loses, which is what makes it the right answer.
    /// The extension used to report nothing here, from a parser that
    /// handed back a `BigInt`; it now reads the same `i64` this does.
    #[test]
    fn an_integer_past_the_safe_range_loses_precision_rather_than_vanishing() {
        use crate::extract::render::js_number;
        assert_eq!(
            js_number(values("a = 9007199254740992")[0]),
            "9007199254740992"
        );
        assert_eq!(
            js_number(values("a = 9007199254740993")[0]),
            "9007199254740992"
        );
    }

    /// TOML integers are 64-bit signed, so one that does not fit is not
    /// a valid document and is refused rather than guessed at.
    /// `@iarna/toml` wraps it to a negative number that is nowhere in
    /// the file; refusing is the answer an audit can act on.
    #[test]
    fn an_integer_too_large_for_toml_is_a_refusal_not_a_wrapped_value() {
        assert!(values("a = 123456789012345680000").is_empty());
        assert!(parse_error("a = 123456789012345680000").is_some());
    }

    #[test]
    fn non_finite_values_are_dropped() {
        assert!(values("a = inf\nb = nan\nc = -inf").is_empty());
    }

    #[test]
    fn a_datetime_is_not_a_number() {
        assert!(values("issued = 1979-05-27").is_empty());
    }

    #[test]
    fn arrays_and_tables_are_followed() {
        assert_eq!(
            values("limits = [1, 2]\n\n[owner]\nage = 30\n"),
            [1.0, 2.0, 30.0]
        );
    }

    /// TOML 1.0 allows an inline array of mixed types, and so this reads it.
    #[test]
    fn a_mixed_inline_array_parses() {
        assert_eq!(values("limits = [1, 2.5]"), [1.0, 2.5]);
        assert!(parse_error("limits = [1, 2.5]").is_none());
    }

    #[test]
    fn a_broken_document_yields_nothing_and_says_why() {
        assert!(values("not = = toml").is_empty());
        assert!(parse_error("not = = toml").is_some());
    }
}
