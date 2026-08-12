//! Does this crate open what it claims to open?
//!
//! One file per extension the alias table names, plus a dozen it has
//! never heard of, in one tree, read by the built binary. Every one of
//! them must produce a report line — the alias table's because they are
//! advertised, and the unknown ones because "an unrecognised format is a
//! text scan, not a refusal" is the property the audit story rests on.
//!
//! This is the test that makes "opens 21 of 88" visible without anyone
//! counting by hand. It is also where a format offered in the tool
//! schema with no corpus document fails: a format nothing in
//! `fixtures/` exercises is a format whose parity with the extension
//! nobody is checking.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

const BINARY: &str = env!("CARGO_BIN_EXE_numbers-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Every alias `extract/format.rs` maps, as the file extension a caller
/// would actually have. Held equal to that table by
/// `the_alias_table_and_this_matrix_name_the_same_extensions`, so a new
/// alias cannot arrive without a file here to prove it opens.
const ALIASES: [&str; 43] = [
    "json",
    "jsonc",
    "yaml",
    "yml",
    "csv",
    "tsv",
    "toml",
    "ini",
    "cfg",
    "conf",
    "env",
    "dotenv",
    "python",
    "py",
    "rust",
    "rs",
    "go",
    "java",
    "kotlin",
    "kt",
    "kts",
    "csharp",
    "cs",
    "cpp",
    "cc",
    "cxx",
    "hpp",
    "hh",
    "c",
    "h",
    "javascript",
    "js",
    "mjs",
    "cjs",
    "javascriptreact",
    "jsx",
    "typescript",
    "ts",
    "typescriptreact",
    "tsx",
    "sql",
    "shellscript",
    "sh",
];

/// A dozen extensions the crate has never heard of. Each one must still
/// be read — as a text scan — because a reviewer points this at a
/// repository nobody has described to it.
const UNKNOWN: [&str; 12] = [
    "md",
    "txt",
    "log",
    "rst",
    "adoc",
    "properties",
    "gradle",
    "bat",
    "ps1",
    "swift",
    "rb",
    "lua",
];

/// The formats the tool schema offers. A format advertised here has to
/// resolve, has to open, and has to have a corpus document.
const SUPPORTED: [&str; 18] = [
    "json",
    "yaml",
    "csv",
    "toml",
    "ini",
    "env",
    "python",
    "rust",
    "go",
    "java",
    "kotlin",
    "csharp",
    "cpp",
    "c",
    "javascript",
    "typescript",
    "sql",
    "shellscript",
];

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "numbers-le-matrix-{name}-{}-{unique}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn write(&self, relative: &str, contents: &str) {
        std::fs::write(self.root.join(relative), contents).expect("a file");
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// A document that is valid in every one of these formats at once and
/// holds exactly one number.
///
/// `# rate 8080` is a comment in INI, `.env`, TOML, YAML and every
/// source language that reads `#`; in the ones that do not it is text
/// the literal reader walks anyway, and in CSV and the text scan it is a
/// row and a line. What matters is that no format can refuse it, so a
/// missing report line means the file was not opened rather than that
/// its content was wrong.
const DOCUMENT: &str = "# rate 8080\n";

fn reports(root: &Path) -> Vec<serde_json::Value> {
    let output = Command::new(BINARY)
        .arg(root)
        .output()
        .expect("the binary runs");
    assert!(
        matches!(output.status.code(), Some(0 | 1)),
        "the walk did not finish: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

fn basename(report: &serde_json::Value) -> String {
    let file = report["file"].as_str().unwrap_or_default();
    file.rsplit('/').next().unwrap_or(file).to_string()
}

/// One file per extension, in one tree, in one run. A format the walk
/// skips is a failure, and so is one it opens and then reports nothing
/// for.
#[test]
fn every_extension_the_crate_names_produces_a_report_line() {
    let tree = Tree::new("aliases");
    let mut expected: Vec<String> = Vec::new();
    for extension in ALIASES.into_iter().chain(UNKNOWN) {
        let name = format!("case.{extension}");
        tree.write(&name, DOCUMENT);
        expected.push(name);
    }
    expected.sort();

    let scanned = reports(&tree.root);
    let mut named: Vec<String> = scanned.iter().map(basename).collect();
    named.sort();

    let missing: Vec<&String> = expected.iter().filter(|one| !named.contains(one)).collect();
    assert!(
        missing.is_empty(),
        "{} of {} files produced no report line: {missing:?}",
        missing.len(),
        expected.len()
    );
    assert_eq!(named, expected, "the walk reported a file nobody wrote");

    // A report line is not the same as a file that was read: a `skipped`
    // diagnostic is a line too. None of these is unreadable.
    for report in &scanned {
        let diagnostics = report["diagnostics"].as_array().expect("diagnostics");
        assert!(
            diagnostics.iter().all(|one| one["code"] != "skipped"),
            "{} was reported as unread",
            basename(report)
        );
    }
}

/// The formats the schema offers, each forced by name onto the same
/// document. An offered format that resolves to the text scan is a
/// format that is advertised and not implemented.
#[test]
fn every_offered_format_reads_a_document_forced_onto_it() {
    let tree = Tree::new("forced");
    tree.write("case.txt", DOCUMENT);
    let path = tree.root.join("case.txt");

    for format in SUPPORTED {
        let output = Command::new(BINARY)
            .args(["--format", format])
            .arg(&path)
            .output()
            .expect("the binary runs");
        let line = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or_default()
            .to_string();
        let report: serde_json::Value =
            serde_json::from_str(&line).unwrap_or_else(|_| panic!("{format}: no report line"));
        assert_eq!(
            report["format"], format,
            "{format} was offered and resolved to something else"
        );
    }
}

/// **A format in the tool schema with no corpus document is a failure.**
/// The corpus is the contract with the extension; a format nothing in
/// `fixtures/documents/` exercises is a format whose parity nobody is
/// checking, however green the build is.
#[test]
fn every_offered_format_has_a_corpus_document() {
    let corpus: serde_json::Value =
        serde_json::from_str(include_str!("../fixtures/extraction.json"))
            .expect("the corpus is valid JSON");
    let documents = corpus["documents"].as_array().expect("documents");
    let covered: Vec<&str> = documents
        .iter()
        .filter_map(|case| case["fileType"].as_str())
        .collect();

    let missing: Vec<&str> = SUPPORTED
        .into_iter()
        .chain(["unknown"])
        .filter(|format| !covered.contains(format))
        .collect();
    assert!(
        missing.is_empty(),
        "offered with no corpus document, so nothing checks their parity: {missing:?}"
    );
}
