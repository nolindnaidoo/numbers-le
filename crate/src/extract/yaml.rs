//! YAML, read with `saphyr` where the extension reads with `js-yaml`.
//!
//! `0x1A` is worth knowing about: **the parser resolves it to 26 before
//! the numeric policy ever sees it**, so a hex literal is a number here
//! and rejected in INI, where the same text arrives as a string. Both
//! frontends inherit that from their parsers and the corpus pins it.

use saphyr::{LoadableYamlNode, Scalar, Yaml};

use super::policy::{Coercion, Literal, Value, collect};

pub(crate) fn extract(text: &str) -> Vec<Literal> {
    let Ok(documents) = Yaml::load_from_str(text) else {
        return Vec::new();
    };
    collect(
        &Value::Seq(documents.iter().map(convert).collect()),
        Coercion::Typed,
    )
}

fn convert(node: &Yaml<'_>) -> Value {
    match node {
        Yaml::Value(scalar) => match scalar {
            Scalar::Integer(number) => Value::Number(*number as f64),
            Scalar::FloatingPoint(number) => Value::Number(number.into_inner()),
            Scalar::String(text) => Value::Text(text.to_string()),
            // `.inf` and `.nan` are real YAML scalars and not numbers
            // this tool emits; the policy would drop them anyway, and
            // dropping them here says so nearer the parser.
            _ => Value::Other,
        },
        Yaml::Sequence(items) => Value::Seq(items.iter().map(convert).collect()),
        Yaml::Mapping(entries) => Value::Map(entries.values().map(convert).collect()),
        _ => Value::Other,
    }
}

pub(crate) fn parse_error(text: &str) -> Option<String> {
    Yaml::load_from_str(text)
        .err()
        .map(|error| format!("Failed to parse YAML: {error}"))
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
        assert_eq!(values("a: 8080\nb: 0.0825"), [8080.0, 0.0825]);
    }

    /// YAML has types, so a quoted number is data.
    #[test]
    fn a_quoted_number_is_not_a_number() {
        assert_eq!(values("a: 42\nb: \"42\""), [42.0]);
    }

    /// The parser resolves this before the policy sees it, which is why
    /// the same text is a number here and not in INI.
    #[test]
    fn a_hex_literal_is_resolved_by_the_parser() {
        assert_eq!(values("a: 0x1A"), [26.0]);
    }

    /// Not a YAML 1.2 number, so it stays a string and the strict test
    /// rejects it.
    #[test]
    fn an_underscored_literal_is_not_a_number() {
        assert!(values("a: 1_000").is_empty());
    }

    #[test]
    fn non_finite_scalars_are_dropped() {
        assert!(values("a: .inf\nb: .nan\nc: -.inf").is_empty());
    }

    #[test]
    fn sequences_and_nesting_are_followed() {
        assert_eq!(
            values("list:\n  - 1\n  - 2.5\nmap:\n  x: 3"),
            [1.0, 2.5, 3.0]
        );
    }

    #[test]
    fn every_document_in_the_file_is_read() {
        assert_eq!(values("a: 1\n---\nb: 2\n"), [1.0, 2.0]);
    }

    #[test]
    fn a_broken_document_yields_nothing_and_says_why() {
        assert!(values("a: [unterminated").is_empty());
        assert!(parse_error("a: [unterminated").is_some());
        assert!(parse_error("a: 1").is_none());
    }
}
