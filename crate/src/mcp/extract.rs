//! `extract_numbers` — the tool **both** servers offer.
//!
//! The npm server (`src/mcp/tools.ts`) and this one are meant to be the
//! same tool, not two similar ones: same schema, same envelope,
//! byte-identical output. `fixtures/mcp-extract-numbers.json` runs against
//! both, so changing one without the other fails a build.
//!
//! It touches no filesystem. An agent already has file-read tools;
//! duplicating them here would add a path-traversal surface for no
//! capability. The tool that needs a filesystem is `numbers_le_scan`.

use serde::Serialize;
use serde_json::value::RawValue;
use serde_json::{Value, json};

use super::Envelope;
use crate::extract::{self, Notation, Options, SUPPORTED_FORMATS, resolve_format};

const DEFAULT_MAX_RESULTS: usize = 500;
const MAX_MAX_RESULTS: usize = 5000;

pub(crate) fn definition() -> Value {
    json!({
        "name": "extract_numbers",
        "description": "Extract every numeric value from a document. Parses JSON, YAML, CSV, \
                        TOML, INI and dotenv, and reads numeric literals in Python, Rust, Go, \
                        Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL and shell — \
                        including hex, binary, octal, digit separators and type suffixes. \
                        Anything else is scanned as plain text, so a format is optional. \
                        Returns each number with the notation it was written in, in document \
                        order, not its position.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": { "type": "string", "description": "The document text to scan." },
                "format": {
                    "type": "string",
                    "enum": SUPPORTED_FORMATS,
                    "description": "Document format. Optional — an unrecognised or absent \
                                    format scans the text directly.",
                },
                "filename": {
                    "type": "string",
                    "description": "Filename used to infer the format when `format` is absent, \
                                    e.g. \"config.toml\".",
                },
                "dedupe": {
                    "type": "boolean",
                    "default": false,
                    "description": "Collapse repeated values to their first occurrence.",
                },
                "maxResults": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_MAX_RESULTS,
                    "default": DEFAULT_MAX_RESULTS,
                    "description": format!(
                        "Cap on returned values (default {DEFAULT_MAX_RESULTS}). meta.truncated \
                         reports whether any were dropped."
                    ),
                },
            },
            "required": ["content"],
            "additionalProperties": false,
        },
    })
}

/// One finding, with the number as the **token this crate rendered**.
///
/// `Box<RawValue>` rather than a JSON number, and it must stay one all
/// the way to stdout: `1e+21` and `1e21` are the same double and
/// different bytes, and only one of them is what the npm server writes.
/// Anything that turns this into a `serde_json::Value` re-parses it with
/// `serde_json`'s float reader, which `json.rs` documents as not
/// correctly rounded — that is how `123456789012345680000` came back
/// from this tool as a different number.
#[derive(Serialize)]
pub(crate) struct Finding {
    value: Box<RawValue>,
    notation: Notation,
}

#[derive(Serialize)]
pub(crate) struct Extracted {
    numbers: Vec<Finding>,
    #[serde(rename = "fileType")]
    file_type: &'static str,
}

pub(crate) fn run(arguments: &Value) -> Result<Envelope<Extracted>, String> {
    let content = arguments
        .get("content")
        .and_then(Value::as_str)
        .ok_or_else(|| "content is required and must be a string".to_string())?;
    let max_results = read_max_results(arguments)?;

    // Never a refusal. An agent that knows nothing about a document
    // still gets its quoted numbers, which is the whole reason a format
    // is optional here where it is required in the sibling tools.
    let format = resolve_format(
        arguments.get("format").and_then(Value::as_str),
        arguments.get("filename").and_then(Value::as_str),
    );

    // Emitted as raw JSON tokens, not as serde numbers. A number's
    // token is the contract here: JavaScript writes 1e+21 where
    // serde_json writes 1e21 — the same double, different bytes, and
    // only one of them is what the other server writes.
    // A parse failure is an unsuccessful envelope with the reason in
    // it, matching the npm server. The *message* cannot match — it comes
    // from whichever parser refused — so the corpus compares these
    // structurally rather than by text.
    let diagnostics: Vec<Value> = extract::parse_error(content, format)
        .map(|message| json!({ "severity": "error", "code": "parse-error", "message": message }))
        .into_iter()
        .collect();

    let mut values: Vec<Finding> = extract::extract(content, format, Options)
        .into_iter()
        .map(|number| Finding {
            value: RawValue::from_string(number.value).expect("a rendered number is valid JSON"),
            notation: number.notation,
        })
        .collect();

    // Deduplication is by value, never by notation: `0xFF` and `255` are
    // one number written twice, and a caller asking for the distinct
    // numbers in a file means the distinct numbers.
    if arguments.get("dedupe").and_then(Value::as_bool) == Some(true) {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        values.retain(|finding| seen.insert(finding.value.get().to_string()));
    }

    // The `truncated` flag matters more than the cap: a silently
    // incomplete answer is wrong in the most expensive way, and this is
    // a tool whose whole job is completeness.
    let truncated = values.len() > max_results;
    values.truncate(max_results);

    let count = values.len();
    Ok(super::envelope(
        "extract_numbers",
        Extracted {
            numbers: values,
            file_type: format,
        },
        count,
        diagnostics,
        truncated,
    ))
}

/// Clamp quietly, reject loudly — the npm server's asymmetry.
fn read_max_results(arguments: &Value) -> Result<usize, String> {
    let Some(raw) = arguments.get("maxResults") else {
        return Ok(DEFAULT_MAX_RESULTS);
    };
    let invalid = "maxResults must be a positive integer".to_string();
    let value = raw.as_u64().ok_or(invalid.clone())?;
    if value < 1 {
        return Err(invalid);
    }
    Ok(usize::try_from(value)
        .unwrap_or(MAX_MAX_RESULTS)
        .min(MAX_MAX_RESULTS))
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;
    use crate::extract::FALLBACK_FORMAT;
    use crate::extract::corpus::document;

    const CASES: &str = include_str!("../../fixtures/mcp-extract-numbers.json");

    /// The envelope as text — what the server actually writes. Every
    /// number in it is the token this crate rendered.
    fn text(arguments: &Value) -> String {
        serde_json::to_string(&run(arguments).expect("a result")).expect("an envelope serializes")
    }

    /// The envelope parsed back, for the assertions that index into it.
    ///
    /// Parsing is lossy for a number past the double's shortest
    /// round-trip — that is the whole reason the server never parses one
    /// — so a test that cares about the token asserts on `text` instead.
    fn answer(arguments: &Value) -> Value {
        serde_json::from_str(&text(arguments)).expect("an envelope is JSON")
    }

    #[derive(Debug, Deserialize)]
    struct Case {
        name: String,
        file: Option<String>,
        content: Option<String>,
        arguments: Value,
        expected: Option<Value>,
        #[serde(rename = "expectedError")]
        expected_error: Option<String>,
    }

    #[test]
    fn every_shared_case_answers_identically() {
        let cases: Vec<Case> = serde_json::from_str(CASES).expect("the corpus is valid JSON");
        assert!(!cases.is_empty(), "the corpus is empty");

        for case in cases {
            let mut arguments = case.arguments.clone();
            let content = case
                .file
                .as_deref()
                .map(document)
                .map(str::to_string)
                .or(case.content);
            if let Some(content) = content {
                arguments["content"] = json!(content);
            }

            // A refused document is compared by shape, not by text. The
            // message comes from whichever parser did the refusing —
            // `@iarna/toml` and the `toml` crate word it differently, and
            // neither is wrong — so what has to match is that both
            // refused, both reported it, and both returned nothing.
            //
            // One case is a refusal *only* on the extension's side:
            // `@iarna/toml` is TOML 0.5 and rejects a mixed inline array
            // where the `toml` crate reads it. That divergence is in
            // SPEC.md and pinned in toml.rs.
            if case
                .expected
                .as_ref()
                .is_some_and(|expected| expected["ok"] == false)
            {
                let ours = answer(&arguments);
                if case.file.as_deref() == Some("mixed-array.toml") {
                    assert_eq!(ours["ok"], true, "this parser reads TOML 1.0");
                    assert_eq!(
                        ours["data"]["numbers"],
                        json!([
                            { "value": 1, "notation": "decimal" },
                            { "value": 2.5, "notation": "decimal" },
                        ])
                    );
                } else {
                    assert_eq!(ours["ok"], false, "{}", case.name);
                    assert_eq!(
                        ours["diagnostics"][0]["code"], "parse-error",
                        "{}",
                        case.name
                    );
                    assert_eq!(ours["data"]["numbers"], json!([]), "{}", case.name);
                }
                continue;
            }

            match (case.expected, case.expected_error) {
                (_, Some(expected)) => {
                    assert_eq!(
                        run(&arguments).err().expect(&case.name),
                        expected,
                        "{}",
                        case.name
                    );
                }
                (Some(expected), None) => {
                    assert_eq!(answer(&arguments), expected, "{}", case.name);
                }
                (None, None) => panic!("{} pins neither a result nor an error", case.name),
            }
        }
    }

    #[test]
    fn the_tool_name_is_pinned() {
        assert_eq!(definition()["name"], "extract_numbers");
    }

    #[test]
    fn the_advertised_enum_matches_the_formats_that_resolve() {
        let definition = definition();
        let advertised: Vec<String> = definition["inputSchema"]["properties"]["format"]["enum"]
            .as_array()
            .expect("an enum")
            .iter()
            .filter_map(|value| value.as_str().map(str::to_string))
            .collect();
        assert_eq!(advertised, SUPPORTED_FORMATS);
    }

    /// The contract two servers hold: each number a JSON number with the
    /// notation it was written in, in document order, and no positions.
    ///
    /// **Changed in 0.2.0**: `numbers` used to be a bare array of JSON
    /// numbers. It moved because this was the one crate in the family
    /// whose findings carried no kind, and a reader cannot tell `0x1A`
    /// from `26` without one — which got worse the moment the source
    /// extractor started reporting hex at all.
    #[test]
    fn the_shared_tool_returns_a_number_and_its_notation() {
        let result = answer(&json!({ "content": r#"{"a":8080}"#, "format": "json" }));
        assert!(result["data"]["numbers"][0]["value"].is_number());
        assert_eq!(result["data"]["numbers"][0]["value"], 8080);
        assert_eq!(result["data"]["numbers"][0]["notation"], "decimal");
        assert!(
            result["data"]["numbers"][0].get("line").is_none(),
            "the shared tool never carries positions"
        );
    }

    /// The reason the tokens are emitted raw. `serde_json` would print
    /// this double as `1e21`, and the other server writes `1e+21`.
    ///
    /// Key order is the serializer's — `serde_json` sorts and JavaScript
    /// keeps insertion order — and it is not what the two servers are
    /// held to. The *number token* is.
    #[test]
    fn a_number_keeps_the_token_javascript_would_write() {
        let written = text(&json!({ "content": r#"{"a":1e21,"b":1e-7}"#, "format": "json" }));
        assert!(
            written.contains(r#"{"value":1e+21,"notation":"decimal"}"#),
            "{written}"
        );
        assert!(
            written.contains(r#"{"value":1e-7,"notation":"decimal"}"#),
            "{written}"
        );
    }

    /// The regression the `differential` job found. The envelope used to
    /// be assembled as a `serde_json::Value`, and putting a raw token
    /// into one re-parses it with `serde_json`'s float reader — the
    /// reader `json.rs` documents as not correctly rounded. This tool
    /// answered `1.2345678901234567e+20` where the npm server answered
    /// `123456789012345680000`: a different token *and* a different
    /// double, on the one surface the two servers must share.
    #[test]
    fn a_large_integer_keeps_the_double_and_the_token_the_other_server_writes() {
        for format in ["env", "ini", "csv", "json", "unknown", "rust"] {
            let content = match format {
                "env" => "RATE=123456789012345680000".to_string(),
                "ini" => "[s]\nrate = 123456789012345680000".to_string(),
                "csv" => "a,123456789012345680000".to_string(),
                "json" => r#"{"a":123456789012345680000}"#.to_string(),
                "rust" => "let a = 123456789012345680000;".to_string(),
                _ => "rate 123456789012345680000".to_string(),
            };
            let written = text(&json!({ "content": content, "format": format }));
            assert!(
                written.contains(r#""value":123456789012345680000"#),
                "{format}: {written}"
            );
        }
    }

    /// An unresolved format is a text scan, never a refusal.
    #[test]
    fn an_unknown_format_falls_back_rather_than_failing() {
        let result = answer(&json!({ "content": "rate 0.0825", "format": "nonsense" }));
        assert_eq!(result["data"]["fileType"], FALLBACK_FORMAT);
        assert_eq!(result["data"]["numbers"][0]["value"], 0.0825);
    }

    /// A source language is routed by name, and its literals come back
    /// whole. Under the text scan `u32` was the number 32.
    #[test]
    fn a_source_language_is_routed_by_name() {
        let result = answer(&json!({
            "content": "const MODE: u32 = 0o755;",
            "format": "rust",
        }));
        assert_eq!(result["data"]["fileType"], "rust");
        assert_eq!(
            result["data"]["numbers"],
            json!([{ "value": 493, "notation": "octal" }])
        );
    }

    /// A document that neither parser reads comes back unsuccessful,
    /// with the reason. The message is this parser's own — that much
    /// cannot be shared — but the shape is.
    #[test]
    fn a_broken_document_is_an_unsuccessful_envelope() {
        let result = answer(&json!({ "content": "{not json", "format": "json" }));
        assert_eq!(result["ok"], false);
        assert_eq!(result["diagnostics"][0]["code"], "parse-error");
        assert_eq!(result["data"]["numbers"], json!([]));
    }

    #[test]
    fn a_fractional_cap_is_refused() {
        let error = run(&json!({ "content": "x", "maxResults": 1.5 }))
            .err()
            .expect("a refusal");
        assert_eq!(error, "maxResults must be a positive integer");
    }
}
