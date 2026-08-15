//! JSON, read with `jsonc-parser` where the extension reads with
//! `JSON.parse`. Every loosening is off, so a file this reads is a file
//! `JSON.parse` reads.
//!
//! **Numbers are parsed from their source text with `str::parse`, not
//! handed over by a JSON library.** `serde_json`'s float parsing is not
//! correctly rounded for every token: it reads `123456789012345680000`
//! as a double one ULP below the one Rust's own `str::parse` and
//! JavaScript both produce. One ULP is invisible until it is printed,
//! and printing is this tool's whole output. `corpus.rs` keeps a live
//! test on that discrepancy so this note stops being needed the day it
//! is fixed upstream.

use jsonc_parser::ast::{Object, Value as Node};
use jsonc_parser::{CollectOptions, ParseOptions, parse_to_ast};

use super::policy::{Coercion, Literal, Value, collect};

fn options(comments: bool) -> ParseOptions {
    ParseOptions {
        allow_comments: comments,
        allow_loose_object_property_names: false,
        allow_trailing_commas: comments,
        allow_missing_commas: false,
        allow_single_quoted_strings: false,
        allow_hexadecimal_numbers: false,
        allow_unary_plus_numbers: false,
    }
}

pub(crate) fn extract(text: &str, comments: bool) -> Vec<Literal> {
    collect(
        &parsed(text, comments).unwrap_or(Value::Other),
        Coercion::Typed,
    )
}

/// The numbers, each with the byte offset of the token that produced it.
///
/// The AST carries a range for every literal, so JSON needs no search to
/// place a value — which matters more here than in a string extractor,
/// because a number's source text and its printed form are often
/// different: `1e21` is written one way and reported another.
pub(crate) fn extract_spanned(text: &str, comments: bool) -> Vec<(Literal, usize)> {
    let Ok(result) = parse_to_ast(text, &CollectOptions::default(), &options(comments)) else {
        return Vec::new();
    };
    let Some(root) = result.value else {
        return Vec::new();
    };
    let mut out = Vec::new();
    visit_spanned(&root, &mut out);
    out
}

fn visit_spanned(node: &Node, out: &mut Vec<(Literal, usize)>) {
    match node {
        Node::NumberLit(literal) => {
            if let Ok(value) = literal.value.parse::<f64>()
                && value.is_finite()
            {
                out.push((Literal::decimal(value), literal.range.start));
            }
        }
        Node::Array(array) => {
            for element in &array.elements {
                visit_spanned(element, out);
            }
        }
        Node::Object(object) => {
            for property in &object.properties {
                visit_spanned(&property.value, out);
            }
        }
        // A quoted number in JSON is data, not a number.
        _ => {}
    }
}

fn parsed(text: &str, comments: bool) -> Option<Value> {
    let result = parse_to_ast(text, &CollectOptions::default(), &options(comments)).ok()?;
    result.value.as_ref().map(convert)
}

fn convert(node: &Node) -> Value {
    match node {
        // The source text, parsed here rather than by the library — see
        // the module note.
        Node::NumberLit(literal) => literal
            .value
            .parse::<f64>()
            .map_or(Value::Other, Value::Number),
        Node::StringLit(literal) => Value::Text(literal.value.to_string()),
        Node::Array(array) => Value::Seq(array.elements.iter().map(convert).collect()),
        Node::Object(object) => convert_object(object),
        _ => Value::Other,
    }
}

/// Property values only. Dropping the name here is what makes "keys are
/// never extracted" true for every format at once.
fn convert_object(object: &Object) -> Value {
    Value::Map(
        object
            .properties
            .iter()
            .map(|p| convert(&p.value))
            .collect(),
    )
}

pub(crate) fn parse_error(text: &str, comments: bool) -> Option<String> {
    match parse_to_ast(text, &CollectOptions::default(), &options(comments)) {
        Err(error) => Some(format!("Failed to parse JSON: {error}")),
        // jsonc-parser reads an empty document as a successful parse of
        // nothing; `JSON.parse("")` throws. An empty file is a parse
        // failure in the extension and has to be one here too.
        Ok(result) if result.value.is_none() => {
            Some("Failed to parse JSON: unexpected end of input".to_string())
        }
        Ok(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::render::js_number;

    fn values(text: &str) -> Vec<f64> {
        extract(text, false)
            .into_iter()
            .map(|literal| literal.value)
            .collect()
    }

    #[test]
    fn numbers_are_extracted_and_keys_are_not() {
        assert_eq!(values(r#"{"port":8080}"#), [8080.0]);
    }

    /// JSON has types, so a quoted number is data.
    #[test]
    fn a_quoted_number_is_not_a_number() {
        assert_eq!(values(r#"{"a":42,"b":"42"}"#), [42.0]);
    }

    #[test]
    fn nesting_is_followed_in_document_order() {
        assert_eq!(
            values(r#"{"a":1,"b":{"c":2,"d":[3,4]}}"#),
            [1.0, 2.0, 3.0, 4.0]
        );
    }

    #[test]
    fn booleans_and_null_are_not_numbers() {
        assert_eq!(values(r#"{"a":true,"b":null,"c":1}"#), [1.0]);
    }

    /// The reason this parses number text itself. `serde_json` reads this
    /// token as a different double, and the difference only shows when
    /// it is printed.
    #[test]
    fn a_large_integer_keeps_the_double_javascript_would_give_it() {
        let extracted = values(r#"{"a":123456789012345680000}"#);
        assert_eq!(js_number(extracted[0]), "123456789012345680000");
    }

    #[test]
    fn a_span_points_at_the_token() {
        let document = r#"{"a":8080}"#;
        let (literal, offset) = extract_spanned(document, false)[0];
        assert_eq!(literal.value, 8080.0);
        assert_eq!(&document[offset..offset + 4], "8080");
    }

    #[test]
    fn the_spanned_walk_yields_the_same_numbers_in_the_same_order() {
        let document = r#"{"a":1,"b":{"c":2,"d":[3,4]}}"#;
        let spanned: Vec<f64> = extract_spanned(document, false)
            .into_iter()
            .map(|(literal, _)| literal.value)
            .collect();
        assert_eq!(spanned, values(document));
    }

    #[test]
    fn a_broken_document_yields_nothing_and_says_why() {
        assert!(values("{not json").is_empty());
        assert!(parse_error("{not json", false).is_some());
        assert!(parse_error(r#"{"a":1}"#, false).is_none());
    }

    /// `JSON.parse("")` throws and jsonc-parser shrugs, so an empty
    /// document is a failure here by hand.
    #[test]
    fn an_empty_document_is_a_parse_failure() {
        assert!(parse_error("", false).is_some());
        assert!(parse_error("   \n ", false).is_some());
        assert!(parse_error("{}", false).is_none());
    }

    #[test]
    fn the_loosenings_are_off() {
        assert!(parse_error(r#"{"a":1,}"#, false).is_some());
        assert!(parse_error(r#"{"a":0x1A}"#, false).is_some());
    }
}
