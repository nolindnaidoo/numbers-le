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
    /// Whether this file was not read at all — not text, or not
    /// openable.
    ///
    /// Reported rather than swallowed, because a report that quietly
    /// skipped a file would be claiming coverage it does not have. It
    /// does **not** fail the run on its own: every repository has a PNG
    /// and a zip in it, and exiting 2 on those makes the tool unusable
    /// in CI, which is the one place it is most worth running.
    /// `--strict` is there for a pipeline that wants zero tolerance.
    pub(crate) fn was_skipped(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "skipped")
    }

    /// Whether the scan of this file gave up part way. Unlike a skip
    /// this **does** fail the run: reporting no findings when a
    /// detector stopped early would overstate coverage, which is the
    /// one thing an audit tool must never do.
    pub(crate) fn is_incomplete(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == "error")
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct ScanOptions {
    pub(crate) dedupe: bool,
    pub(crate) extract: Options,
    /// A format the caller forced, instead of one inferred per file.
    pub(crate) format: Option<&'static str>,
}

/// What reading one file produced.
///
/// **A binary file is not a report.** It was never a text candidate —
/// every repository holds a PNG — and reporting it as a file that could
/// not be read made `--strict` exit 2 on any tree containing an image,
/// which made `--strict` unusable. It is counted instead, so the reader
/// still knows coverage was narrower than the tree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Scanned {
    Read(Box<FileReport>),
    Binary,
}

impl Scanned {
    pub(crate) fn into_report(self) -> Option<FileReport> {
        match self {
            Self::Read(report) => Some(*report),
            Self::Binary => None,
        }
    }
}

/// Split what a walk produced into the reports and the count of files
/// that were never text. Both surfaces come through here so neither can
/// grow its own idea of what a binary file is.
pub(crate) fn partition(scanned: Vec<Scanned>) -> (Vec<FileReport>, usize) {
    let binary = scanned
        .iter()
        .filter(|one| **one == Scanned::Binary)
        .count();
    let reports = scanned
        .into_iter()
        .filter_map(Scanned::into_report)
        .collect();
    (reports, binary)
}

/// ripgrep's heuristic, and deliberately the same one: a NUL byte in the
/// first 8 KiB means binary. "What this tool opens" and "what ripgrep
/// opens" being the same answer is already the rule `walk.rs` follows.
const BINARY_SNIFF_BYTES: usize = 8192;

fn is_binary(bytes: &[u8]) -> bool {
    bytes
        .iter()
        .take(BINARY_SNIFF_BYTES)
        .any(|byte| *byte == b'\0')
}

pub(crate) fn scan_file(path: &PathBuf, options: ScanOptions) -> Scanned {
    let file = path.to_string_lossy().into_owned();
    let format = options.format.unwrap_or_else(|| format_of(path));

    match std::fs::read(path) {
        // Never a text candidate, so never a report. Counted, never
        // silent.
        Ok(bytes) if is_binary(&bytes) => Scanned::Binary,
        Ok(bytes) => Scanned::Read(Box::new(match String::from_utf8(bytes) {
            Ok(content) => scan_content(without_bom(&content), file, format, options),
            // Named rather than dropped. A file that looked like text and
            // was not is a file the reader would otherwise believe was
            // covered.
            Err(_) => skipped(file, format, "not UTF-8 text"),
        })),
        Err(error) => Scanned::Read(Box::new(skipped(file, format, &error.to_string()))),
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
pub(crate) fn exit_code(reports: &[FileReport], strict: bool) -> u8 {
    // A scan that gave up part way always fails: it would otherwise
    // report "nothing found" for a file it never finished reading.
    if reports.iter().any(FileReport::is_incomplete) {
        return 2;
    }
    if strict && reports.iter().any(FileReport::was_skipped) {
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

    /// The report for a file that was read at all. A binary file has
    /// none, and every test that wants one says so by calling this.
    fn read(path: &PathBuf, options: ScanOptions) -> FileReport {
        scan_file(path, options)
            .into_report()
            .expect("the file was a text candidate")
    }

    fn values(report: &FileReport) -> Vec<&str> {
        report.numbers.iter().map(|f| f.value.as_str()).collect()
    }

    #[test]
    fn a_document_with_numbers_exits_zero() {
        let report = scan_content(r#"{"port":8080}"#, "a.json".into(), "json", plain());
        assert_eq!(values(&report), ["8080"]);
        assert_eq!(exit_code(&[report], false), 0);
    }

    #[test]
    fn a_document_with_none_exits_one() {
        let report = scan_content(r#"{"a":"text"}"#, "a.json".into(), "json", plain());
        assert_eq!(report.summary.numbers, 0);
        assert_eq!(exit_code(&[report], false), 1);
    }

    #[test]
    fn nothing_to_scan_exits_one() {
        assert_eq!(exit_code(&[], false), 1);
    }

    /// A broken document is a fact about that file, not a failed run.
    /// One malformed config must not fail an audit of ten thousand.
    #[test]
    fn a_parse_failure_is_a_warning_not_an_exit_two() {
        let report = scan_content("{not json", "a.json".into(), "json", plain());
        assert_eq!(report.diagnostics.len(), 1);
        assert_eq!(report.diagnostics[0].severity, "warning");
        assert!(!report.was_skipped());
        assert_eq!(exit_code(&[report], false), 1);
    }

    /// Changed deliberately: a file that could not be read is reported
    /// and does not fail the run, because every repository has one and
    /// exiting 2 on it meant the tool never got run in CI at all.
    #[test]
    fn an_unreadable_file_is_reported_and_does_not_end_the_run() {
        let tree = TempTree::new("scan-unreadable");
        let report = read(&tree.path().join("gone.json"), plain());
        assert!(report.was_skipped());
        assert_eq!(report.diagnostics[0].severity, "warning");
        assert_eq!(exit_code(std::slice::from_ref(&report), false), 1);
        assert_eq!(exit_code(&[report], true), 2, "--strict is opt-in");
    }

    /// Changed deliberately: a binary file used to be carried as a
    /// `skipped` report, which meant `--strict` exited 2 on any
    /// repository holding an image — and every repository holds one.
    /// It is now not a report at all, and is counted instead.
    #[test]
    fn a_binary_file_is_not_a_report() {
        let tree = TempTree::new("scan-binary");
        let file = tree.write_bytes("logo.png", &[0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]);
        assert_eq!(scan_file(&file, plain()), Scanned::Binary);
    }

    /// The distinction the whole split exists for: a file that *is* text
    /// and could not be read keeps its named diagnostic and keeps
    /// failing `--strict`. A PNG beside it does neither.
    #[test]
    fn a_text_file_that_cannot_be_read_still_fails_strict_and_a_binary_one_does_not() {
        let tree = TempTree::new("scan-strict");
        let binary = tree.write_bytes("logo.png", &[0x89, 0x50, 0x00, 0xff]);
        // Invalid UTF-8 with no NUL byte: it looked like text and was not.
        let broken = tree.write_bytes("notes.txt", &[0x68, 0x69, 0xff, 0xfe]);
        let good = tree.write("rates.env", "VAT=0.2\n");

        let (reports, binaries) = partition(vec![
            scan_file(&binary, plain()),
            scan_file(&broken, plain()),
            scan_file(&good, plain()),
        ]);
        assert_eq!(binaries, 1);
        assert_eq!(reports.len(), 2, "the PNG produced no report line");

        let named: Vec<&str> = reports.iter().map(|r| r.file.as_str()).collect();
        assert!(named.iter().any(|file| file.ends_with("notes.txt")));
        assert!(named.iter().any(|file| file.ends_with("rates.env")));
        assert_eq!(reports[0].diagnostics[0].message, "not UTF-8 text");

        assert_eq!(exit_code(&reports, false), 0, "the .env file has a number");
        assert_eq!(exit_code(&reports, true), 2, "the unreadable text file");
        let binary_only = partition(vec![scan_file(&binary, plain())]).0;
        assert_eq!(
            exit_code(&binary_only, true),
            1,
            "a binary file never fails --strict"
        );
    }

    /// ripgrep's own test, and the reason it is that one: a NUL byte
    /// after the first 8 KiB belongs to a file this already read as
    /// text, and re-classifying it late would drop findings already
    /// reported above it.
    #[test]
    fn binary_is_a_nul_byte_in_the_first_8_kib() {
        let tree = TempTree::new("scan-sniff");
        let mut late = vec![b'1'; BINARY_SNIFF_BYTES + 16];
        late[BINARY_SNIFF_BYTES + 8] = 0;
        let file = tree.write_bytes("late.txt", &late);
        assert_ne!(scan_file(&file, plain()), Scanned::Binary);
    }

    #[test]
    fn the_format_comes_from_the_file_name() {
        let tree = TempTree::new("scan-format");
        let file = tree.write(
            "config.toml",
            "port = 8080
",
        );
        let report = read(&file, plain());
        assert_eq!(report.format, "toml");
        assert_eq!(values(&report), ["8080"]);
    }

    /// Changed deliberately in 0.2.0: a `.ts` file used to land in the
    /// text scan, which read `u32` as the number 32 and split `0o755`
    /// into two. It now has an extractor that knows what a literal is.
    #[test]
    fn a_source_file_is_read_by_its_language() {
        let tree = TempTree::new("scan-source");
        let file = tree.write(
            "rates.ts",
            "const VAT: number = 0.2;
",
        );
        let report = read(&file, plain());
        assert_eq!(report.format, "typescript");
        assert_eq!(values(&report), ["0.2"]);
    }

    /// Prose still goes to the text scan, which has no grammar and says
    /// so — `v1.2.3` there is two numbers.
    #[test]
    fn prose_falls_back_to_a_text_scan() {
        let tree = TempTree::new("scan-fallback");
        let file = tree.write(
            "NOTES.md",
            "Released v1.2.3 at a rate of 0.2.
",
        );
        let report = read(&file, plain());
        assert_eq!(report.format, "unknown");
        assert_eq!(values(&report), ["1.2", "0.3", "0.2"]);
    }

    #[test]
    fn a_forced_format_overrides_the_file_name() {
        let tree = TempTree::new("scan-forced");
        let file = tree.write(
            "data.json",
            "port = 8080
",
        );
        let report = read(
            &file,
            ScanOptions {
                format: Some("toml"),
                ..plain()
            },
        );
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

/// The report for a file that was not read: named, warned about, and
/// not a failure by itself.
fn skipped(file: String, format: &'static str, reason: &str) -> FileReport {
    FileReport {
        file,
        format: format.to_string(),
        numbers: Vec::new(),
        diagnostics: vec![Diagnostic {
            severity: "warning".to_string(),
            code: "skipped".to_string(),
            message: reason.to_string(),
        }],
        summary: Summary {
            numbers: 0,
            unlocated: 0,
        },
    }
}

/// Drop a leading byte-order mark.
///
/// No editor shows it and VS Code strips it before the extension ever
/// sees a document, so without this the two frontends read the same file
/// differently the moment anything on Windows saves it — Notepad, Excel,
/// a PowerShell redirect. Three invisible bytes shift every column on
/// the first line, and in a structured format they can lose the
/// document entirely.
pub(crate) fn without_bom(content: &str) -> &str {
    content.strip_prefix('\u{feff}').unwrap_or(content)
}

#[cfg(test)]
mod hazards {
    use super::*;

    /// Three invisible bytes that Notepad, Excel and a PowerShell
    /// redirect all add, and that VS Code strips before the extension
    /// ever sees a document — so without this the two frontends read
    /// the same file differently.
    #[test]
    fn a_byte_order_mark_is_not_part_of_the_document() {
        assert_eq!(without_bom("\u{feff}abc"), "abc");
        assert_eq!(without_bom("abc"), "abc");
        // Only a leading one: elsewhere it is a zero-width no-break
        // space and belongs to the text.
        assert_eq!(without_bom("a\u{feff}b"), "a\u{feff}b");
    }
}
