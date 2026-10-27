//! The agent surface: the same extraction over the Model Context
//! Protocol on stdio, so a model can ask for the numbers rather than be
//! handed the files and pattern-match them itself.
//!
//! Three rules the family's MCP surfaces established:
//!
//! - **An empty answer is not an error.** A document with no numbers
//!   comes back as an ordinary result carrying `ok: true` — the scan
//!   ran. Only a malformed question is a protocol error.
//! - **Refusals speak the caller's vocabulary.** An MCP caller has no
//!   command line, so no message here mentions a flag.
//! - **A malformed frame is answered in the npm server's words.** Three
//!   servers ship from this repository, and a client cannot be allowed to
//!   tell them apart by what it sent: the same frame limit, the same
//!   parse errors, the same reading of a null id and of an unknown
//!   method or tool. `scripts/check-cli-pipes.ts` feeds both binaries the
//!   malformed frames and compares the replies.
//!
//! Read-only by construction: nothing on this surface writes, so unlike
//! pixelactions there is no consent gate to design.

pub(crate) mod extract;

use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use serde::Serialize;
use serde_json::value::{RawValue, to_raw_value};
use serde_json::{Value, json};

use crate::extract::{Options, resolve_format};
use crate::scan::{self, ScanOptions};
use crate::walk::{self, WalkOptions};

const PROTOCOL_VERSION: &str = "2025-06-18";

/// The most bytes one frame may hold before it is refused.
///
/// Input with no newline was held whole: a 16 MiB line was read and
/// answered, and a client streaming without one grew the process without
/// bound. The same figure and message as the npm server's, so a caller
/// diffing the two finds nothing.
pub(crate) const MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;

/// JSON-RPC error codes, from the spec.
const PARSE_ERROR: i64 = -32700;
const INVALID_PARAMS: i64 = -32602;
const METHOD_NOT_FOUND: i64 = -32601;

/// One JSON-RPC reply, serialized through serde rather than assembled
/// as a `Value`.
///
/// **That is not a style choice.** A number's JSON *token* is the
/// contract this server shares with the npm one, and
/// `serde_json::to_value` re-parses a raw token with `serde_json`'s own
/// float reader — the reader `json.rs` documents as not correctly
/// rounded. Routing a reply through a `Value` tree turned
/// `123456789012345680000` into a different double *and* a different
/// token, on the one surface where the two servers must agree byte for
/// byte. A `RawValue` reaches stdout intact only if nothing on the way
/// there parses it.
#[derive(Serialize)]
struct Response<'a> {
    jsonrpc: &'a str,
    id: &'a Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<&'a RawValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<Failure>,
}

#[derive(Serialize)]
struct Failure {
    code: i64,
    message: String,
}

/// A `Value` with no raw tokens in it, wrapped for the reply.
fn raw(value: &Value) -> Box<RawValue> {
    to_raw_value(value).expect("a value serializes")
}

/// Why a tool did not answer.
///
/// An argument that does not fit the tool's schema is a protocol error,
/// `-32602`, in the words the npm server and the extension's use: a host
/// counts it against the sender, and the schema is what the agent read
/// before sending. A tool that fails on what it was given at run time,
/// a path that is not there, is a result carrying `isError`, so a model
/// reads the reason and reacts rather than concluding the server is
/// broken.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Refusal {
    InvalidParams(String),
    Failure(String),
}

impl Refusal {
    #[cfg(test)]
    pub(crate) fn message(&self) -> &str {
        match self {
            Self::InvalidParams(message) | Self::Failure(message) => message,
        }
    }
}

/// `additionalProperties: false`, enforced: an argument the schema does
/// not declare is refused by name, the names sorted as serde sorts keys.
pub(crate) fn refuse_unknown(arguments: &Value, known: &[&str]) -> Result<(), Refusal> {
    let Some(object) = arguments.as_object() else {
        return Ok(());
    };
    let unknown: Vec<&str> = object
        .keys()
        .map(String::as_str)
        .filter(|key| !known.contains(key))
        .collect();
    match unknown.as_slice() {
        [] => Ok(()),
        [one] => Err(Refusal::InvalidParams(format!("unknown argument: {one}"))),
        many => Err(Refusal::InvalidParams(format!(
            "unknown arguments: {}",
            many.join(", ")
        ))),
    }
}

/// An optional argument that must be a string when present.
pub(crate) fn optional_str<'a>(
    arguments: &'a Value,
    name: &str,
) -> Result<Option<&'a str>, Refusal> {
    match arguments.get(name) {
        None => Ok(None),
        Some(value) => value
            .as_str()
            .map(Some)
            .ok_or_else(|| Refusal::InvalidParams(format!("{name} must be a string"))),
    }
}

/// An optional argument that must be a boolean when present; absent is false.
pub(crate) fn optional_bool(arguments: &Value, name: &str) -> Result<bool, Refusal> {
    match arguments.get(name) {
        None => Ok(false),
        Some(value) => value
            .as_bool()
            .ok_or_else(|| Refusal::InvalidParams(format!("{name} must be a boolean"))),
    }
}

pub(crate) fn serve() -> ExitCode {
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    serve_streams(stdin.lock(), stdout.lock())
}

/// The stdio loop over any pair of streams, so a test can drive it with
/// bytes.
///
/// Reads newline-delimited JSON. A line that is not UTF-8 is read with
/// replacement characters, as the npm server's decoder reads it. A line
/// that is not JSON, or not a request, is answered with a parse error in
/// the npm server's words rather than dropped, so a client that sent one
/// learns what happened; before, the line vanished without a word.
pub(crate) fn serve_streams(mut input: impl BufRead, mut output: impl Write) -> ExitCode {
    let mut frame: Vec<u8> = Vec::new();
    // Set once a frame has passed the limit: the rest of that line is
    // dropped as it arrives, so the oversized message is never held.
    let mut discarding = false;
    loop {
        let (consumed, complete) = {
            let Ok(chunk) = input.fill_buf() else {
                return ExitCode::from(2);
            };
            if chunk.is_empty() {
                break;
            }
            let newline = chunk.iter().position(|&byte| byte == b'\n');
            if !discarding {
                frame.extend_from_slice(&chunk[..newline.unwrap_or(chunk.len())]);
            }
            (newline.map_or(chunk.len(), |at| at + 1), newline.is_some())
        };
        input.consume(consumed);
        if discarding {
            discarding = !complete;
            continue;
        }
        if !complete {
            if frame.len() > MAX_FRAME_BYTES {
                frame = Vec::new();
                discarding = true;
                if emit(&mut output, &frame_refusal()).is_err() {
                    return ExitCode::from(2);
                }
            }
            continue;
        }
        let line = std::mem::take(&mut frame);
        if line.len() > MAX_FRAME_BYTES {
            // The newline arrived in the chunk that took the frame over the
            // limit, so the check above never saw it. The limit is on the
            // line, not on when its end happened to arrive.
            if emit(&mut output, &frame_refusal()).is_err() {
                return ExitCode::from(2);
            }
            continue;
        }
        let Some(response) = respond_to_line(&line) else {
            continue;
        };
        if emit(&mut output, &response).is_err() {
            return ExitCode::from(2);
        }
    }
    // A partial frame at close was never a request; the npm server drops
    // it the same way.
    ExitCode::SUCCESS
}

/// One line in, at most one reply out: the same refusals, in the same
/// words, as the npm server's loop.
fn respond_to_line(line: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(line);
    let text = text.trim();
    if text.is_empty() {
        return None;
    }
    let Ok(request) = serde_json::from_str::<Value>(text) else {
        return Some(parse_error("Invalid JSON"));
    };
    if !is_request(&request) {
        return Some(parse_error("Not a JSON-RPC 2.0 request"));
    }
    handle(&request)
}

fn emit(output: &mut impl Write, message: &str) -> std::io::Result<()> {
    writeln!(output, "{message}")?;
    output.flush()
}

fn is_request(value: &Value) -> bool {
    value.get("jsonrpc").and_then(Value::as_str) == Some("2.0")
        && value.get("method").is_some_and(Value::is_string)
}

fn frame_refusal() -> String {
    parse_error(&format!(
        "Message exceeds the {MAX_FRAME_BYTES} byte frame limit"
    ))
}

/// A refusal with no id to answer against, in the field order the
/// npm server writes it.
fn parse_error(message: &str) -> String {
    let response = Response {
        jsonrpc: "2.0",
        id: &Value::Null,
        result: None,
        error: Some(Failure {
            code: PARSE_ERROR,
            message: message.to_string(),
        }),
    };
    serde_json::to_string(&response).expect("a response serializes")
}

fn handle(request: &Value) -> Option<String> {
    let method = request.get("method")?.as_str()?;
    // A notification carries no id, or a null one, and takes no reply; the
    // npm server reads both the same way, and this answered the null one.
    let id = request.get("id").filter(|id| !id.is_null())?;

    let result = match method {
        "initialize" => Ok(raw(&json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "numbers-le", "version": env!("CARGO_PKG_VERSION") },
        }))),
        "tools/list" => Ok(raw(&json!({ "tools": tool_definitions() }))),
        "tools/call" => call_tool(request.get("params")),
        "ping" => Ok(raw(&json!({}))),
        other => Err((METHOD_NOT_FOUND, format!("Unknown method: {other}"))),
    };

    let (ok, failed) = match result {
        Ok(result) => (Some(result), None),
        Err((code, message)) => (None, Some(Failure { code, message })),
    };
    let response = Response {
        jsonrpc: "2.0",
        id,
        result: ok.as_deref(),
        error: failed,
    };
    Some(serde_json::to_string(&response).expect("a response serializes"))
}

fn tool_definitions() -> Value {
    json!([
        extract::definition(),
        {
            "name": "numbers_le_scan",
            "description": "Extract every number from files or directories, with the file \
                            it came from and, where it can be located, its line and column. \
                            Reads the filesystem; never writes to it, and never judges a \
                            number.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "a file or directory to read" },
                    "paths": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "several files or directories, instead of `path`",
                    },
                    "format": {
                        "type": "string",
                        "description": "Force a format for every file instead of inferring one \
                                        per file name. An unrecognised name falls back to the \
                                        text scan, named `unknown`.",
                    },
                    "dedupe": {
                        "type": "boolean",
                        "default": false,
                        "description": "Collapse repeated values to their first occurrence.",
                    },
                    "hidden": {
                        "type": "boolean",
                        "default": false,
                        "description": "Walk hidden files and directories too.",
                    },
                    "ignored": {
                        "type": "boolean",
                        "default": false,
                        "description": "Walk files excluded by .gitignore too.",
                    },
                },
                "additionalProperties": false,
            },
        },
    ])
}

/// Protocol failures (no tool named, an unknown tool, an argument that
/// does not fit the schema) are JSON-RPC errors; a tool that fails on
/// what it was given at run time returns a result carrying `isError`, so
/// a model reads the reason and reacts rather than concluding the server
/// is broken. Same rule, same words, as the npm server.
fn call_tool(params: Option<&Value>) -> Result<Box<RawValue>, (i64, String)> {
    let no_name = || {
        (
            INVALID_PARAMS,
            "tools/call requires a string `name`".to_string(),
        )
    };
    let params = params.ok_or_else(no_name)?;
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(no_name)?;
    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));

    match name {
        "extract_numbers" => answer(extract::run(&arguments)),
        "numbers_le_scan" => answer(scan_tool(&arguments)),
        other => Err((INVALID_PARAMS, format!("Unknown tool: {other}"))),
    }
}

fn answer<D: Serialize>(
    outcome: Result<Envelope<D>, Refusal>,
) -> Result<Box<RawValue>, (i64, String)> {
    match outcome {
        Ok(result) => Ok(tool_result(&result)),
        Err(Refusal::InvalidParams(message)) => Err((INVALID_PARAMS, message)),
        Err(Refusal::Failure(message)) => Ok(tool_failure(&message)),
    }
}

fn scan_tool(arguments: &Value) -> Result<Envelope<Value>, Refusal> {
    refuse_unknown(
        arguments,
        &["path", "paths", "format", "dedupe", "hidden", "ignored"],
    )?;
    let inputs = requested_paths(arguments)?;
    // Read as the schema types them. A `hidden: "yes"` was read as false
    // and a `format: 7` as absent, silences the schema never allowed.
    let walk_options = WalkOptions {
        hidden: optional_bool(arguments, "hidden")?,
        respect_ignore: !optional_bool(arguments, "ignored")?,
    };
    let options = ScanOptions {
        dedupe: optional_bool(arguments, "dedupe")?,
        extract: Options,
        format: optional_str(arguments, "format")?.map(|name| resolve_format(Some(name), None)),
    };

    // A path that is not there is a fact about the filesystem, not the
    // schema: a tool failure the model reads, not a protocol error.
    let walked = walk::collect(&inputs, &walk_options).map_err(Refusal::Failure)?;
    let scanned = walked
        .files
        .iter()
        .map(|target| scan::scan_file(target, options))
        .collect();
    // A binary file was never a text candidate, so it gets no report —
    // but the count is carried, because an agent reading `reports` as
    // the whole tree would otherwise be wrong about coverage.
    let (mut read, binary) = scan::partition(scanned);
    // Same rule as the CLI, and through the same helper: a path the walk
    // could not open is named rather than dropped or fatal.
    read.extend(
        walked
            .unreadable
            .iter()
            .map(|(path, reason)| scan::unreadable(path, reason)),
    );
    let reports: Vec<Value> = read
        .iter()
        .map(|report| serde_json::to_value(report).expect("a report serializes"))
        .collect();

    let numbers: u64 = reports
        .iter()
        .map(|report| report["summary"]["numbers"].as_u64().unwrap_or(0))
        .sum();
    let unlocated: u64 = reports
        .iter()
        .map(|report| report["summary"]["unlocated"].as_u64().unwrap_or(0))
        .sum();

    // A file the scan could not read is a `skipped` report, a warning:
    // named here as well, because an agent reads this list for whether
    // the tree was covered. A filter on a severity no report carries
    // left it empty for a locked file.
    let mut diagnostics: Vec<Value> = reports
        .iter()
        .filter(|report| {
            report["diagnostics"]
                .as_array()
                .is_some_and(|list| list.iter().any(|d| d["code"] == "skipped"))
        })
        .map(|report| {
            warning(
                "unreadable",
                &format!(
                    "{} could not be read, so this scan does not cover it",
                    report["file"].as_str().unwrap_or("a file")
                ),
            )
        })
        .collect();
    if unlocated > 0 {
        // A model treating these positions as a complete index needs to
        // know how much of it is not one.
        diagnostics.push(warning(
            "unlocated",
            &format!("{unlocated} values could not be located in their source"),
        ));
    }

    let count = reports.len();
    Ok(envelope(
        "numbers_le_scan",
        json!({
            "reports": reports,
            "numbers": numbers,
            "binaryFiles": binary,
            "symbolicLinks": walked.symlinks,
        }),
        count,
        diagnostics,
        false,
    ))
}

fn requested_paths(arguments: &Value) -> Result<Vec<PathBuf>, Refusal> {
    let invalid = |message: &str| Refusal::InvalidParams(message.to_string());
    if let Some(path) = arguments.get("path") {
        let path = path
            .as_str()
            .ok_or_else(|| invalid("path must be a string"))?;
        return Ok(vec![PathBuf::from(path)]);
    }
    if let Some(items) = arguments.get("paths").and_then(Value::as_array) {
        // An entry that is not a string is named rather than dropped:
        // `["dir", 7]` was answered for `dir` alone and the 7 vanished
        // without a word.
        let mut paths = Vec::with_capacity(items.len());
        for (index, item) in items.iter().enumerate() {
            let Some(path) = item.as_str() else {
                return Err(invalid(&format!("entry {index} of paths is not a string")));
            };
            paths.push(PathBuf::from(path));
        }
        if paths.is_empty() {
            return Err(invalid("the list of paths was empty"));
        }
        return Ok(paths);
    }
    Err(invalid("no file or directory was supplied to read"))
}

/// The one result shape every tool returns, matching the npm server's
/// envelope field for field: `{ ok, data, diagnostics, meta }`.
///
/// **`ok` reports whether the check ran, not whether the answer is
/// yes.** A file full of broken paths is the answer, not a failure to
/// produce one — conflating the two would have a model report a broken
/// tool when what it actually learned is that the paths are wrong.
///
/// Generic over its data so a tool whose data holds pre-rendered number
/// tokens keeps them: `Value` cannot carry a raw token, and putting one
/// in re-parses it.
#[derive(Serialize)]
pub(crate) struct Envelope<D: Serialize> {
    ok: bool,
    data: D,
    diagnostics: Vec<Value>,
    meta: Meta,
}

#[derive(Serialize)]
struct Meta {
    tool: &'static str,
    count: usize,
    truncated: bool,
}

pub(crate) fn envelope<D: Serialize>(
    tool: &'static str,
    data: D,
    count: usize,
    diagnostics: Vec<Value>,
    truncated: bool,
) -> Envelope<D> {
    let ok = !diagnostics
        .iter()
        .any(|diagnostic| diagnostic["severity"].as_str() == Some("error"));
    Envelope {
        ok,
        data,
        diagnostics,
        meta: Meta {
            tool,
            count,
            truncated,
        },
    }
}

/// An MCP tool result: the envelope as text (what a model reads) and
/// the same envelope structured. Identical to what the npm server
/// emits, so a caller diffing the two servers finds nothing.
///
/// Both halves are serialized from the envelope itself rather than from
/// a `Value` of it, so a number token survives into both.
#[derive(Serialize)]
struct ToolResult<'a, D: Serialize> {
    content: [Text; 1],
    #[serde(rename = "structuredContent")]
    structured_content: &'a Envelope<D>,
    #[serde(rename = "isError")]
    is_error: bool,
}

#[derive(Serialize)]
struct Text {
    #[serde(rename = "type")]
    kind: &'static str,
    text: String,
}

fn tool_result<D: Serialize>(envelope: &Envelope<D>) -> Box<RawValue> {
    let text = serde_json::to_string_pretty(envelope).expect("an envelope serializes");
    to_raw_value(&ToolResult {
        content: [Text { kind: "text", text }],
        structured_content: envelope,
        is_error: false,
    })
    .expect("a tool result serializes")
}

fn warning(code: &str, message: &str) -> Value {
    json!({ "severity": "warning", "code": code, "message": message })
}

/// The tool could not run on what it was given at run time. `isError` so
/// a model reads the message and corrects itself.
fn tool_failure(message: &str) -> Box<RawValue> {
    raw(&json!({
        "content": [{ "type": "text", "text": message }],
        "isError": true,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn request(method: &str, params: &Value) -> Value {
        json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })
    }

    /// The reply, parsed. The server answers with text rather than a
    /// `Value` so a number token reaches stdout intact; a test that
    /// wants to index into it parses it back.
    fn reply(request: &Value) -> Value {
        serde_json::from_str(&handle(request).expect("a reply")).expect("a reply is JSON")
    }

    fn call(name: &str, arguments: &Value) -> Value {
        reply(&request(
            "tools/call",
            &json!({ "name": name, "arguments": arguments }),
        ))
    }

    #[test]
    fn initialize_answers_with_the_protocol_version() {
        let response = reply(&request("initialize", &json!({})));
        assert_eq!(response["result"]["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(response["result"]["serverInfo"]["name"], "numbers-le");
    }

    #[test]
    fn tools_list_offers_both_tools() {
        let response = reply(&request("tools/list", &json!({})));
        let tools = response["result"]["tools"].as_array().expect("tools");
        let names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();
        assert_eq!(names, ["extract_numbers", "numbers_le_scan"]);
    }

    #[test]
    fn a_notification_gets_no_reply() {
        let notification = json!({ "jsonrpc": "2.0", "method": "initialized" });
        assert!(handle(&notification).is_none());
        let null_id = json!({ "jsonrpc": "2.0", "id": null, "method": "ping" });
        assert!(handle(&null_id).is_none(), "a null id is a notification");
    }

    fn parsed(text: &str) -> Value {
        serde_json::from_str(text).expect("a reply is JSON")
    }

    /// The loop, driven with bytes in the 8 KiB chunks stdin arrives in,
    /// with what it wrote and how it ended.
    fn drive(input: &[u8]) -> (String, Vec<Value>) {
        let mut written = Vec::new();
        let reader = std::io::BufReader::with_capacity(8192, std::io::Cursor::new(input.to_vec()));
        let code = serve_streams(reader, &mut written);
        let replies = String::from_utf8(written)
            .expect("replies are UTF-8")
            .lines()
            .map(parsed)
            .collect();
        (format!("{code:?}"), replies)
    }

    const PING: &[u8] = b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}\n";

    /// A line of invalid bytes was dropped without a word; it is a parse
    /// error now, and the ping after it is still answered.
    #[test]
    fn an_invalid_utf8_line_is_a_parse_error_and_the_server_reads_on() {
        let (code, replies) = drive(&[b"\xff\xfe\n".as_slice(), PING].concat());
        assert_eq!(code, format!("{:?}", ExitCode::SUCCESS));
        assert_eq!(replies[0], parsed(&parse_error("Invalid JSON")));
        assert_eq!(replies[1]["id"], 1);
    }

    /// Inside a string the npm server's decoder replaces the byte and the
    /// request succeeds; this reads it the same way, where it dropped it.
    #[test]
    fn an_invalid_byte_inside_a_string_is_replaced_as_the_npm_server_reads_it() {
        let request = [
            br#"{"jsonrpc":"2.0","id":2,"method":"ping","x":"caf"#.as_slice(),
            b"\xe9",
            br#""}"#,
            b"\n",
        ]
        .concat();
        let (_, replies) = drive(&request);
        assert_eq!(replies[0]["id"], 2);
        assert_eq!(replies[0]["result"], json!({}));
    }

    /// A frame that is not JSON used to be dropped without a word.
    #[test]
    fn a_line_that_is_not_json_is_answered_with_a_parse_error() {
        let (_, replies) = drive(&[b"not json at all\n".as_slice(), PING].concat());
        assert_eq!(replies[0], parsed(&parse_error("Invalid JSON")));
        assert_eq!(replies[1]["id"], 1);
    }

    /// A request without a method was dropped, and one without `jsonrpc`
    /// or with another version was answered; the npm server refuses all
    /// three the same way. A byte order mark is not whitespace to either
    /// parser, so a frame led by one is not JSON.
    #[test]
    fn a_line_that_is_not_a_request_is_answered_with_a_parse_error() {
        for line in [
            br#"{"id":1}"#.as_slice(),
            br#"{"id":1,"method":"ping"}"#,
            br#"{"jsonrpc":"1.0","id":1,"method":"ping"}"#,
            br#"{"jsonrpc":"2.0","id":1,"method":7}"#,
            b"[1,2,3]",
            b"5",
        ] {
            let (_, replies) = drive(&[line, b"\n"].concat());
            assert_eq!(
                replies[0],
                parsed(&parse_error("Not a JSON-RPC 2.0 request")),
                "{line:?}"
            );
        }
        let (_, replies) = drive(&[b"\xef\xbb\xbf".as_slice(), PING].concat());
        assert_eq!(replies[0], parsed(&parse_error("Invalid JSON")));
    }

    /// Input with no newline was held whole. Past the limit the frame is
    /// refused in the npm server's words, the rest of the line is dropped
    /// as it arrives, and the next line is served.
    #[test]
    fn a_frame_over_the_limit_is_refused_and_the_next_line_served() {
        // One byte over, with the newline in the chunk that takes the frame
        // over the limit; and far over, with the newline many chunks later.
        for over in [1, 100_000] {
            let mut input = vec![b'x'; MAX_FRAME_BYTES + over];
            input.extend_from_slice(b"\n");
            input.extend_from_slice(PING);
            let (code, replies) = drive(&input);
            assert_eq!(code, format!("{:?}", ExitCode::SUCCESS));
            assert_eq!(replies[0], parsed(&frame_refusal()), "{over} over");
            assert_eq!(replies[1]["id"], 1, "{over} over");
            assert_eq!(replies.len(), 2, "{over} over");
        }
    }

    /// Exactly at the limit is served; the limit is a ceiling, not a size.
    #[test]
    fn a_frame_at_the_limit_is_served() {
        let mut input = br#"{"jsonrpc":"2.0","id":1,"method":"ping","params":{"pad":""#.to_vec();
        let padding = MAX_FRAME_BYTES - input.len() - 3;
        input.extend(std::iter::repeat_n(b'x', padding));
        input.extend_from_slice(b"\"}}\n");
        assert_eq!(
            input.len(),
            MAX_FRAME_BYTES + 1,
            "the line plus its newline"
        );
        let (_, replies) = drive(&input);
        assert_eq!(replies[0]["id"], 1);
    }

    /// A last line with no newline was answered; it is a partial frame at
    /// close, which the npm server drops too.
    #[test]
    fn blank_lines_and_a_partial_frame_at_close_are_ignored() {
        let (code, replies) = drive(
            &[
                b"\n\r\n \t\n".as_slice(),
                PING,
                b"{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"ping\"}",
            ]
            .concat(),
        );
        assert_eq!(code, format!("{:?}", ExitCode::SUCCESS));
        assert_eq!(replies.len(), 1);
        assert_eq!(replies[0]["id"], 1);
    }

    /// The refusals a client can provoke read the same from every server
    /// this repository ships.
    #[test]
    fn protocol_refusals_use_the_npm_servers_words() {
        let response = reply(&request("does/not/exist", &json!({})));
        assert_eq!(
            response["error"]["message"],
            "Unknown method: does/not/exist"
        );
        let response = call("numbers_le_translate", &json!({}));
        assert_eq!(
            response["error"]["message"],
            "Unknown tool: numbers_le_translate"
        );
        for params in [json!({}), json!([1]), json!({ "name": 3 })] {
            let response = reply(&request("tools/call", &params));
            assert_eq!(
                response["error"]["message"], "tools/call requires a string `name`",
                "{params}"
            );
        }
        let response = reply(&json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call" }));
        assert_eq!(
            response["error"]["message"],
            "tools/call requires a string `name`"
        );
        let initialized =
            json!({ "jsonrpc": "2.0", "id": 1, "method": "notifications/initialized" });
        assert_eq!(
            reply(&initialized)["error"]["code"],
            METHOD_NOT_FOUND,
            "a notification sent with an id is a method this server does not implement"
        );
    }

    /// The handshake answers with this server's own revision and bare tool
    /// support, as the extension's server answers, whatever the client asked.
    #[test]
    fn initialize_does_not_echo_the_clients_version() {
        let asked = request("initialize", &json!({ "protocolVersion": "1999-01-01" }));
        let response = reply(&asked);
        assert_eq!(response["result"]["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(response["result"]["capabilities"], json!({ "tools": {} }));
    }

    #[test]
    fn an_unknown_method_is_a_protocol_error() {
        let response = reply(&request("does/not/exist", &json!({})));
        assert_eq!(response["error"]["code"], METHOD_NOT_FOUND);
    }

    #[test]
    fn an_unknown_tool_is_a_protocol_error() {
        let response = call("numbers_le_translate", &json!({}));
        assert_eq!(response["error"]["code"], INVALID_PARAMS);
    }

    /// An argument that does not fit the schema is a protocol error, in
    /// the npm server's words; it was an `isError` result, and a wrong
    /// type on an optional argument was a silence.
    #[test]
    fn an_argument_that_does_not_fit_the_schema_is_a_protocol_error() {
        for (tool, arguments, message) in [
            (
                "numbers_le_scan",
                json!({}),
                "no file or directory was supplied to read",
            ),
            (
                "numbers_le_scan",
                json!({ "path": ".", "hidden": "yes" }),
                "hidden must be a boolean",
            ),
            (
                "numbers_le_scan",
                json!({ "path": ".", "format": 7 }),
                "format must be a string",
            ),
            (
                "numbers_le_scan",
                json!({ "path": ".", "bogus": 1 }),
                "unknown argument: bogus",
            ),
            (
                "extract_numbers",
                json!({}),
                "content is required and must be a string",
            ),
            (
                "extract_numbers",
                json!({ "content": "1", "format": 7 }),
                "format must be a string",
            ),
            (
                "extract_numbers",
                json!({ "content": "1", "dedupe": "yes" }),
                "dedupe must be a boolean",
            ),
            (
                "extract_numbers",
                json!({ "content": "1", "extra": true, "another": 1 }),
                "unknown arguments: another, extra",
            ),
        ] {
            let response = call(tool, &arguments);
            assert!(
                response.get("result").is_none(),
                "{tool} {arguments}: {response}"
            );
            assert_eq!(
                response["error"]["code"], INVALID_PARAMS,
                "{tool} {arguments}"
            );
            assert_eq!(response["error"]["message"], message, "{tool} {arguments}");
        }
    }

    /// A path that is not there is a fact about the filesystem, not the
    /// schema: the tool fails on what it was given, and a model reads why.
    #[test]
    fn a_path_that_is_not_there_is_a_tool_failure_not_a_protocol_error() {
        let response = call("numbers_le_scan", &json!({ "path": "/no/such/place-xyz" }));
        assert!(response.get("error").is_none(), "{response}");
        assert_eq!(response["result"]["isError"], true);
        assert!(
            response["result"]["content"][0]["text"]
                .as_str()
                .expect("a message")
                .starts_with("/no/such/place-xyz: ")
        );
    }

    /// `["dir", 7]` was answered for `dir` alone and the 7 dropped without
    /// a word, on this server and the npm one alike. An entry that is not
    /// a string is named, in both servers' words.
    #[test]
    fn a_path_entry_that_is_not_a_string_is_named_not_dropped() {
        for (arguments, message) in [
            (
                json!({ "paths": ["a", 7] }),
                "entry 1 of paths is not a string",
            ),
            (
                json!({ "paths": [null] }),
                "entry 0 of paths is not a string",
            ),
            (json!({ "path": 7 }), "path must be a string"),
            (json!({ "paths": [] }), "the list of paths was empty"),
        ] {
            let response = call("numbers_le_scan", &arguments);
            assert_eq!(response["error"]["code"], INVALID_PARAMS, "{arguments}");
            assert_eq!(response["error"]["message"], message, "{arguments}");
        }
    }

    #[test]
    fn the_shared_tool_is_offered_and_answers() {
        let response = call(
            "extract_numbers",
            &json!({ "content": r#"{"a":8080}"#, "format": "json" }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["meta"]["tool"], "extract_numbers");
        assert_eq!(envelope["data"]["numbers"][0]["value"], 8080);
        assert_eq!(envelope["data"]["numbers"][0]["notation"], "decimal");
        assert_eq!(envelope["ok"], true);
        assert_eq!(response["result"]["isError"], false);
    }

    /// The shared tool reaches no filesystem — the property that lets an
    /// agent call it anywhere, and it must not regress.
    #[test]
    fn the_shared_tool_needs_no_filesystem() {
        let response = call(
            "extract_numbers",
            &json!({ "content": "const port = 8080;" }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["data"]["numbers"][0]["value"], 8080);
        assert!(envelope["data"].get("exists").is_none());
    }

    /// An unresolved format is a text scan, not a refusal.
    #[test]
    fn an_unknown_format_falls_back_rather_than_failing() {
        let response = call(
            "extract_numbers",
            &json!({ "content": "rate 0.0825", "format": "handwriting" }),
        );
        assert_eq!(response["result"]["isError"], false);
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["data"]["fileType"], "unknown");
        assert_eq!(envelope["data"]["numbers"][0]["value"], 0.0825);
    }

    /// An empty answer is the scan running and finding nothing.
    #[test]
    fn a_document_with_no_numbers_is_an_ordinary_result() {
        let response = call("extract_numbers", &json!({ "content": "no digits here" }));
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(response["result"]["isError"], false);
        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["meta"]["count"], 0);
    }

    #[test]
    fn the_scan_tool_reports_what_it_found() {
        let tree = TempTree::new("mcp-scan");
        tree.write("config.toml", "port = 8080\n");
        let response = call(
            "numbers_le_scan",
            &json!({ "path": tree.path().to_string_lossy() }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(response["result"]["isError"], false);
        assert_eq!(envelope["ok"], true);
        assert_eq!(envelope["data"]["numbers"], 1);
    }

    /// The scan tool carries positions — it read the file, so it knows.
    #[test]
    fn the_scan_tool_carries_positions() {
        let tree = TempTree::new("mcp-positions");
        tree.write("a.json", "{\"a\":8080}\n");
        let response = call(
            "numbers_le_scan",
            &json!({ "path": tree.path().to_string_lossy() }),
        );
        let found = &response["result"]["structuredContent"]["data"]["reports"][0]["numbers"][0];
        assert_eq!(found["value"], "8080");
        assert_eq!(found["line"], 1);
    }

    /// The envelope's `diagnostics` said nothing about a file the scan
    /// could not read: the filter looked for a severity no report carries,
    /// so an agent reading `ok: true` and `diagnostics: []` was told the
    /// tree was covered when a file in it was not.
    #[cfg(unix)]
    #[test]
    fn the_scan_tool_names_an_unreadable_file_in_its_diagnostics() {
        use std::os::unix::fs::PermissionsExt;

        let tree = TempTree::new("mcp-unreadable");
        tree.write("open.env", "A=1\n");
        let closed = tree.write("closed.env", "B=2\n");
        std::fs::set_permissions(&closed, std::fs::Permissions::from_mode(0o000))
            .expect("an unreadable file");
        if std::fs::read(&closed).is_ok() {
            eprintln!(
                "SKIPPED the_scan_tool_names_an_unreadable_file: this user reads a mode-000 file"
            );
            return;
        }
        let response = call(
            "numbers_le_scan",
            &json!({ "path": tree.path().to_string_lossy() }),
        );
        let _ = std::fs::set_permissions(&closed, std::fs::Permissions::from_mode(0o600));
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(
            envelope["ok"], true,
            "a skipped file is a warning, not a failed scan"
        );
        assert_eq!(envelope["diagnostics"][0]["code"], "unreadable");
        assert!(
            envelope["diagnostics"][0]["message"]
                .as_str()
                .is_some_and(|text| text
                    .ends_with("closed.env could not be read, so this scan does not cover it")),
            "{envelope}"
        );
    }

    /// The envelope carries the binary count for the same reason; a link
    /// the walk did not follow was not counted anywhere.
    #[cfg(unix)]
    #[test]
    fn the_scan_tool_counts_a_symbolic_link_it_did_not_follow() {
        let tree = TempTree::new("mcp-symlink");
        let target = tree.write("a.json", "{\"a\":1}\n");
        std::os::unix::fs::symlink(&target, tree.path().join("link.json")).expect("a symlink");
        let response = call(
            "numbers_le_scan",
            &json!({ "path": tree.path().to_string_lossy() }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["data"]["symbolicLinks"], 1);
        assert_eq!(
            envelope["data"]["reports"].as_array().map(Vec::len),
            Some(1)
        );
    }

    #[test]
    fn the_scan_tool_dedupes_on_request() {
        let tree = TempTree::new("mcp-dedupe");
        tree.write("a.json", "{\"a\":5,\"b\":5}\n");
        let path = tree.path().to_string_lossy().to_string();
        let kept = call("numbers_le_scan", &json!({ "path": path }));
        assert_eq!(kept["result"]["structuredContent"]["data"]["numbers"], 2);
        let deduped = call("numbers_le_scan", &json!({ "path": path, "dedupe": true }));
        assert_eq!(deduped["result"]["structuredContent"]["data"]["numbers"], 1);
    }

    /// Refusals speak the caller's vocabulary: an MCP caller has no
    /// command line, so no message may name a flag.
    #[test]
    fn no_message_mentions_a_command_line_flag() {
        let definitions = serde_json::to_string(&tool_definitions()).expect("serializes");
        assert!(!definitions.contains("--"), "{definitions}");

        let tree = TempTree::new("mcp-vocabulary");
        tree.write("a.json", "{\"a\":1}\n");
        for arguments in [
            json!({}),
            json!({ "paths": [] }),
            json!({ "path": "/no/such/place-xyz" }),
            json!({ "path": tree.path().to_string_lossy(), "magic": true }),
        ] {
            let rendered =
                serde_json::to_string(&call("numbers_le_scan", &arguments)).expect("serializes");
            assert!(!rendered.contains("--"), "{rendered}");
        }
    }

    /// Every tool returns the same envelope, so a caller writes one
    /// reader for all of them and for both servers.
    #[test]
    fn every_tool_returns_the_same_envelope_shape() {
        let tree = TempTree::new("mcp-envelope");
        tree.write("a.md", "x");
        let results = [
            call(
                "extract_numbers",
                &json!({ "content": "x", "format": "markdown" }),
            ),
            call(
                "numbers_le_scan",
                &json!({ "path": tree.path().to_string_lossy() }),
            ),
        ];
        for result in results {
            let envelope = &result["result"]["structuredContent"];
            assert!(envelope["ok"].is_boolean(), "{envelope}");
            assert!(!envelope["data"].is_null(), "{envelope}");
            assert!(envelope["diagnostics"].is_array(), "{envelope}");
            assert!(envelope["meta"]["tool"].is_string(), "{envelope}");
            assert!(envelope["meta"]["count"].is_number(), "{envelope}");
            assert!(envelope["meta"]["truncated"].is_boolean(), "{envelope}");
        }
    }
}
