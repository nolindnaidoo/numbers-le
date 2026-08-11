//! One file end to end — the only path either surface calls.
//!
//! `cli.rs` and `mcp/` both come through here, so a rule can only be
//! written once. `tests/contracts.rs` asserts the two agree.

use std::path::{Path as StdPath, PathBuf};

use serde::Serialize;

use crate::extract::{self, Found, Options, resolve_format};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Diagnostic {
    pub(crate) severity: String,
    pub(crate) code: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub(crate) struct Summary {
    pub(crate) numbers: usize,
    /// How many values could not be located in the source.
    ///
    /// Reported rather than inferred, because it is the number that says
    /// whether the positions in this report can be trusted as a complete
    /// index. A silent zero and a silent forty look identical.
    pub(crate) unlocated: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct FileReport {
    pub(crate) file: String,
    pub(crate) format: String,
    pub(crate) numbers: Vec<Found>,
    pub(crate) diagnostics: Vec<Diagnostic>,
    pub(crate) summary: Summary,
}

impl FileReport {
    /// Whether this file was not examined at all. A parse failure is
    /// **not** one of these: the extension treats a broken document as
    /// yielding nothing and says so, and reporting it as a hard failure
    /// would make one malformed config fail an audit of ten thousand
    /// files.
    pub(crate) fn is_unreadable(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "unreadable")
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct ScanOptions {
    pub(crate) dedupe: bool,
    pub(crate) extract: Options,
    /// A format the caller forced, instead of one inferred per file.
    pub(crate) format: Option<&'static str>,
}

pub(crate) fn scan_file(path: &PathBuf, options: ScanOptions) -> Option<FileReport> {
    let file = path.to_string_lossy().into_owned();
    let format = options.format.unwrap_or_else(|| format_of(path));

    match std::fs::read(path) {
        // A file that is not UTF-8 holds no text to read. Failing on
        // each would make the tool unusable in a repository with images
        // in it.
        Ok(bytes) => String::from_utf8(bytes)
            .ok()
            .map(|content| scan_content(&content, file, format, options)),
        Err(error) => Some(FileReport {
            file,
            format: format.to_string(),
            numbers: Vec::new(),
            diagnostics: vec![Diagnostic {
                severity: "error".to_string(),
                code: "unreadable".to_string(),
                message: format!("could not be read: {error}"),
            }],
            summary: Summary {
                numbers: 0,
                unlocated: 0,
            },
        }),
    }
}

fn format_of(path: &StdPath) -> &'static str {
    resolve_format(None, path.file_name().and_then(|name| name.to_str()))
}

pub(crate) fn scan_content(
    content: &str,
    file: String,
    format: &str,
    options: ScanOptions,
) -> FileReport {
    let mut numbers = extract::extract_located(content, format, options.extract);

    if options.dedupe {
        let mut seen = std::collections::HashSet::new();
        numbers.retain(|found| seen.insert(found.value.clone()));
    }

    let mut diagnostics = Vec::new();
    // A parse failure yields nothing and says why. Said as a warning
    // rather than an error because the extension treats it the same way:
    // the document is unreadable *as that format*, which is a fact about
    // the file, not a failure of the run.
    if let Some(message) = extract::parse_error(content, format) {
        diagnostics.push(Diagnostic {
            severity: "warning".to_string(),
            code: "unparsed".to_string(),
            message,
        });
    }

    let unlocated = numbers
        .iter()
        .filter(|found| found.position.is_none())
        .count();

    FileReport {
        file,
        format: format.to_string(),
        summary: Summary {
            numbers: numbers.len(),
            unlocated,
        },
        numbers,
        diagnostics,
    }
}

/// grep's convention: 0 found, 1 none found, 2 could not answer.
///
/// Finding nothing is an answer here, not an error — a file with no
/// user-facing copy in it is a real result and `if numbers-le src/; then`
/// has to work.
pub(crate) fn exit_code(reports: &[FileReport]) -> u8 {
    if reports.iter().any(FileReport::is_unreadable) {
        return 2;
    }
    u8::from(!reports.iter().any(|report| report.summary.numbers > 0))
}

pub(crate) fn describe(report: &FileReport, found: &Found) -> String {
    match found.position {
        Some(position) => format!(
            "{}:{}:{}  {}",
            report.file, position.line, position.column, found.value
        ),
        None => format!("{}:-  {}", report.file, found.value),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn plain() -> ScanOptions {
        ScanOptions::default()
    }

    fn values(report: &FileReport) -> Vec<&str> {
        report.numbers.iter().map(|f| f.value.as_str()).collect()
    }

    #[test]
    fn a_document_with_numbers_exits_zero() {
        let report = scan_content(r#"{"port":8080}"#, "a.json".into(), "json", plain());
        assert_eq!(values(&report), ["8080"]);
        assert_eq!(exit_code(&[report]), 0);
    }

    #[test]
    fn a_document_with_none_exits_one() {
        let report = scan_content(r#"{"a":"text"}"#, "a.json".into(), "json", plain());
        assert_eq!(report.summary.numbers, 0);
        assert_eq!(exit_code(&[report]), 1);
    }

    #[test]
    fn nothing_to_scan_exits_one() {
        assert_eq!(exit_code(&[]), 1);
    }

    /// A broken document is a fact about that file, not a failed run.
    /// One malformed config must not fail an audit of ten thousand.
    #[test]
    fn a_parse_failure_is_a_warning_not_an_exit_two() {
        let report = scan_content("{not json", "a.json".into(), "json", plain());
        assert_eq!(report.diagnostics.len(), 1);
        assert_eq!(report.diagnostics[0].severity, "warning");
        assert!(!report.is_unreadable());
        assert_eq!(exit_code(&[report]), 1);
    }

    #[test]
    fn an_unreadable_file_ends_the_run_at_two() {
        let tree = TempTree::new("scan-unreadable");
        let report = scan_file(&tree.path().join("gone.json"), plain()).expect("a report");
        assert!(report.is_unreadable());
        assert_eq!(exit_code(&[report]), 2);
    }

    #[test]
    fn a_binary_file_is_skipped_rather_than_failed() {
        let tree = TempTree::new("scan-binary");
        let file = tree.path().join("logo.png");
        std::fs::write(&file, [0x89, 0x50, 0xff, 0xfe]).expect("a file");
        assert!(scan_file(&file, plain()).is_none());
    }

    #[test]
    fn the_format_comes_from_the_file_name() {
        let tree = TempTree::new("scan-format");
        let file = tree.write(
            "config.toml",
            "port = 8080
",
        );
        let report = scan_file(&file, plain()).expect("a report");
        assert_eq!(report.format, "toml");
        assert_eq!(values(&report), ["8080"]);
    }

    /// A source file is not a format this parses, and its constants come
    /// out anyway.
    #[test]
    fn a_source_file_falls_back_to_a_text_scan() {
        let tree = TempTree::new("scan-fallback");
        let file = tree.write(
            "rates.ts",
            "const VAT = 0.2;
",
        );
        let report = scan_file(&file, plain()).expect("a report");
        assert_eq!(report.format, "unknown");
        assert_eq!(values(&report), ["0.2"]);
    }

    #[test]
    fn a_forced_format_overrides_the_file_name() {
        let tree = TempTree::new("scan-forced");
        let file = tree.write(
            "data.json",
            "port = 8080
",
        );
        let report = scan_file(
            &file,
            ScanOptions {
                format: Some("toml"),
                ..plain()
            },
        )
        .expect("a report");
        assert_eq!(report.format, "toml");
        assert_eq!(values(&report), ["8080"]);
    }

    /// The untyped formats read a numeric-looking string as a number and
    /// the typed ones do not. One file each, side by side, because this
    /// is the rule most likely to be "simplified" by someone later.
    #[test]
    fn coercion_follows_the_format_not_the_caller() {
        let typed = scan_content(r#"{"a":"42"}"#, "a.json".into(), "json", plain());
        assert_eq!(typed.summary.numbers, 0);
        let untyped = scan_content("A=42", "a.env".into(), "env", plain());
        assert_eq!(values(&untyped), ["42"]);
    }

    #[test]
    fn dedupe_collapses_repeats_to_the_first() {
        let content = r#"{"a":5,"b":9,"c":5}"#;
        let kept = scan_content(content, "a.json".into(), "json", plain());
        assert_eq!(kept.summary.numbers, 3);

        let deduped = scan_content(
            content,
            "a.json".into(),
            "json",
            ScanOptions {
                dedupe: true,
                ..plain()
            },
        );
        assert_eq!(values(&deduped), ["5", "9"]);
        assert_eq!(
            deduped.numbers[0].position.expect("a position").column,
            6,
            "the first occurrence keeps its own position"
        );
    }

    /// The count that says whether the positions are a complete index. A
    /// hex literal is a number the text scanner cannot see, so it has no
    /// offset to give.
    #[test]
    fn values_the_scanner_cannot_see_are_counted() {
        let report = scan_content(
            "a = 1
b = 0x1A
",
            "a.toml".into(),
            "toml",
            plain(),
        );
        assert_eq!(values(&report), ["1", "26"]);
        assert_eq!(report.summary.unlocated, 1);
        assert!(report.numbers[1].position.is_none());
    }

    /// JSON is placed by its parser, so a value written one way and
    /// printed another is still located.
    #[test]
    fn json_locates_a_value_the_source_spells_differently() {
        let report = scan_content(r#"{"a":1e21}"#, "a.json".into(), "json", plain());
        assert_eq!(values(&report), ["1e+21"]);
        assert_eq!(report.summary.unlocated, 0);
    }

    #[test]
    fn the_human_line_carries_the_position_when_there_is_one() {
        let report = scan_content(r#"{"a":8080}"#, "a.json".into(), "json", plain());
        assert_eq!(describe(&report, &report.numbers[0]), "a.json:1:6  8080");
    }

    #[test]
    fn the_human_line_says_so_when_there_is_no_position() {
        let report = scan_content(
            "a = 0x1A
",
            "a.toml".into(),
            "toml",
            plain(),
        );
        assert!(describe(&report, &report.numbers[0]).starts_with("a.toml:-"));
    }
}
