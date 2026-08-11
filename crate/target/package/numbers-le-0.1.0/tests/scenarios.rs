//! The tier that needs a document far larger than any editor opens.
//!
//! Gated behind `NUMBERS_LE_SCENARIOS` and run by CI. Nothing here
//! substitutes for the unit tests, which run everywhere on every push.
//!
//! **A skipped scenario is never reported as a pass.**

use std::fmt::Write as _;
use std::io::Write as _;

fn enabled(name: &str) -> bool {
    if std::env::var_os("NUMBERS_LE_SCENARIOS").is_some() {
        return true;
    }
    eprintln!("SKIPPED {name}: set NUMBERS_LE_SCENARIOS to run it");
    false
}

fn scan(content: &str, format: &str) -> serde_json::Value {
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_numbers-le"))
        .args(["--stdin", "--format", format])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            child
                .stdin
                .as_mut()
                .expect("stdin")
                .write_all(content.as_bytes())?;
            child.wait_with_output()
        })
        .expect("the binary runs");
    serde_json::from_slice(&output.stdout).expect("stdout carries JSON")
}

/// Locating is the operation that can go quadratic here: every value
/// searches forward through the document's numeric runs, and a shared
/// cursor is what keeps that linear. A spreadsheet export is the real
/// shape and it is all numbers.
#[test]
fn a_document_of_nothing_but_numbers_completes() {
    if !enabled("a_document_of_nothing_but_numbers_completes") {
        return;
    }
    let mut content = String::new();
    for row in 0..50_000 {
        let _ = writeln!(content, "{row},{}.5,{}", row * 2, row * 3);
    }
    let report = scan(&content, "csv");
    assert_eq!(report["summary"]["numbers"], 150_000);
    assert_eq!(
        report["summary"]["unlocated"], 0,
        "every run is spelled in the source"
    );
}

/// A minified bundle is one very long line. Column lookup counts UTF-16
/// units from the line start, which is what turns quadratic when the
/// line never ends.
#[test]
fn a_single_long_line_completes() {
    if !enabled("a_single_long_line_completes") {
        return;
    }
    let mut content = String::new();
    for index in 0..50_000 {
        let _ = write!(content, "const v{index}={index}.25; ");
    }
    let report = scan(&content, "typescript");
    assert_eq!(report["summary"]["numbers"], 100_000);
}

/// The values a search cannot place. Every one of them walks the whole
/// remaining run list before giving up, which is the worst case the
/// forward cursor has.
#[test]
fn a_document_of_unlocatable_values_completes() {
    if !enabled("a_document_of_unlocatable_values_completes") {
        return;
    }
    // Keys deliberately carry no digits. With `k26` among them the
    // value 26 finds *that* run and reports a position pointing at a key
    // — see `locate.rs`, "a run is not always the value's source".
    let mut content = String::new();
    for index in 0..20_000 {
        let name: String = format!("{index:b}")
            .chars()
            .map(|c| if c == '0' { 'a' } else { 'b' })
            .collect();
        let _ = writeln!(content, "k{name} = 0x1A");
    }
    let report = scan(&content, "toml");
    assert_eq!(report["summary"]["numbers"], 20_000);
    assert_eq!(
        report["summary"]["unlocated"], 20_000,
        "a hex literal is a number the scanner cannot see"
    );
}
