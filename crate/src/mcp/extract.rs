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

use serde_json::{Value, json};

use crate::extract::{self, Options, SUPPORTED_FORMATS, resolve_format};

const DEFAULT_MAX_RESULTS: usize = 500;
const MAX_MAX_RESULTS: usize = 5000;

pub(crate) fn definition() -> Value {
    json!({
        "name": "extract_numbers",
        "description": "Extract every string value from a document. Parses JSON, YAML, CSV, \
                        TOML, INI and dotenv; for any other format it falls back to quoted \
                        numbers — single, double or backtick — so a format is optional but \
                        unquoted prose yields nothing. Returns the values themselves, in \
                        document order, not their positions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": { "type": "string", "description": "The document text to scan." },
                "format": {
                    "type": "string",
                    "enum": SUPPORTED_FORMATS,
                    "description": "Document format. Optional — an unrecognised or absent \
                                    format falls back to extracting quoted numbers.",
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

pub(crate) fn run(arguments: &Value) -> Result<Value, String> {
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

    let mut values: Vec<Value> = extract::extract(content, format, Options)
        .into_iter()
        .map(|printed| {
            serde_json::value::RawValue::from_string(printed)
                .map(|raw| serde_json::to_value(raw).expect("a raw token serializes"))
                .expect("a rendered number is valid JSON")
        })
        .collect();

    if arguments.get("dedupe").and_then(Value::as_bool) == Some(true) {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        values.retain(|value| seen.insert(value.to_string()));
    }

    // The `truncated` flag matters more than the cap: a silently
    // incomplete answer is wrong in the most expensive way, and this is
    // a tool whose whole job is completeness.
    let truncated = values.len() > max_results;
    values.truncate(max_results);

    let count = values.len();
    Ok(super::envelope(
        "extract_numbers",
        &json!({ "numbers": values, "fileType": format }),
        count,
        &diagnostics,
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
                let ours = run(&arguments).expect("a result");
                if case.file.as_deref() == Some("mixed-array.toml") {
                    assert_eq!(ours["ok"], true, "this parser reads TOML 1.0");
                    assert_eq!(ours["data"]["numbers"], json!([1, 2.5]));
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
                        run(&arguments).expect_err(&case.name),
                        expected,
                        "{}",
                        case.name
                    );
                }
                (Some(expected), None) => {
                    assert_eq!(
                        run(&arguments).expect(&case.name),
                        expected,
                        "{}",
                        case.name
                    );
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

    /// The contract two servers hold: numbers as JSON numbers, in
    /// document order, and no positions.
    #[test]
    fn the_shared_tool_returns_bare_numbers() {
        let result =
            run(&json!({ "content": r#"{"a":8080}"#, "format": "json" })).expect("a result");
        assert!(result["data"]["numbers"][0].is_number());
        assert_eq!(result["data"]["numbers"][0], 8080);
    }

    /// The reason the tokens are emitted raw. `serde_json` would print
    /// this double as `1e21`, and the other server writes `1e+21`.
    #[test]
    fn a_number_keeps_the_token_javascript_would_write() {
        let result = run(&json!({ "content": r#"{"a":1e21,"b":1e-7}"#, "format": "json" }))
            .expect("a result");
        let text = serde_json::to_string(&result["data"]["numbers"]).expect("serializes");
        assert_eq!(text, "[1e+21,1e-7]");
    }

    /// An unresolved format is a text scan, never a refusal.
    #[test]
    fn an_unknown_format_falls_back_rather_than_failing() {
        let result =
            run(&json!({ "content": "rate 0.0825", "format": "nonsense" })).expect("a result");
        assert_eq!(result["data"]["fileType"], FALLBACK_FORMAT);
        assert_eq!(result["data"]["numbers"][0], 0.0825);
    }

    /// A document that neither parser reads comes back unsuccessful,
    /// with the reason. The message is this parser's own — that much
    /// cannot be shared — but the shape is.
    #[test]
    fn a_broken_document_is_an_unsuccessful_envelope() {
        let result = run(&json!({ "content": "{not json", "format": "json" })).expect("a result");
        assert_eq!(result["ok"], false);
        assert_eq!(result["diagnostics"][0]["code"], "parse-error");
        assert_eq!(result["data"]["numbers"], json!([]));
    }

    #[test]
    fn a_fractional_cap_is_refused() {
        let error = run(&json!({ "content": "x", "maxResults": 1.5 })).expect_err("a refusal");
        assert_eq!(error, "maxResults must be a positive integer");
    }
}
