//! TOML, read with `toml` where the extension reads with `@iarna/toml`.
//!
//! **The two follow different TOML versions and the corpus says so.**
//! `@iarna/toml` implements 0.5, where an inline array must hold one
//! type; the `toml` crate implements 1.0, where `[1, 2.5]` is fine. A
//! document with a mixed array is a parse failure there and eight
//! numbers here, and `fixtures/documents/mixed-array.toml` pins it
//! rather than letting it surface as a mystery.

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
    /// past 2^53 both frontends lose the same precision. Matching that
    /// is the point; avoiding it would be the divergence.
    #[test]
    fn an_integer_past_the_safe_range_loses_precision_the_same_way() {
        use crate::extract::render::js_number;
        assert_eq!(
            js_number(values("a = 9007199254740993")[0]),
            "9007199254740992"
        );
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

    /// The version divergence, asserted rather than assumed. The `toml`
    /// crate is 1.0 and reads this; `@iarna/toml` is 0.5 and refuses it.
    #[test]
    fn a_mixed_inline_array_parses_here_and_not_in_the_extension() {
        assert_eq!(values("limits = [1, 2.5]"), [1.0, 2.5]);
        assert!(parse_error("limits = [1, 2.5]").is_none());
    }

    #[test]
    fn a_broken_document_yields_nothing_and_says_why() {
        assert!(values("not = = toml").is_empty());
        assert!(parse_error("not = = toml").is_some());
    }
}
