//! The terminal surface.
//!
//! stdout is protocol — one JSON report per line, one line per file —
//! whenever something is reading it, and silent when it is a terminal.
//! stderr is always for the human, and is a projection of the same
//! reports rather than parallel prose.

use std::io::{IsTerminal, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use crate::extract::resolve_format;
use crate::scan::{self, FileReport, ScanOptions};
use crate::walk::{self, WalkOptions};

const USAGE: &str = "usage: numbers-le [options] <file|dir>...
       numbers-le [options] --stdin [--format <format>]
       numbers-le mcp
       numbers-le --version | --help

Finds every hardcoded number in a tree and puts it where a person can
check it: JSON, YAML, CSV, TOML, INI and dotenv are parsed, and anything
else falls back to a text scan — so a .ts or .sql file yields its
constants rather than nothing.

Numbers are printed exactly as JavaScript prints them, which is what
keeps this and the editor extension answering the same.

It reports what is there and nothing else. Which numbers matter is yours
to decide.

One JSON report per line on stdout when it is piped or redirected, every
number listed on stderr.

Options:
  --dedupe             collapse repeated values to their first occurrence
  --format <format>    force a format instead of inferring it from the
                       file name; an unknown name falls back rather than
                       failing
  --values             print only the values, one per line, for piping;
                       at a terminal they are listed on stderr instead
  --strict             exit 2 if any file could not be read, rather than
                       reporting it and carrying on
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

A binary file — a NUL byte in its first 8 KiB, ripgrep's own test — is
never a text candidate: it produces no report line, is counted on stderr,
and never fails the run. A file that looked like text and could not be
read is named on stderr, carried in the report, and does not fail the run
by itself; --strict turns that one into a failure.

Exit codes follow grep: 0 numbers found · 1 none found · 2 malformed
question. Finding none is an answer, not an error.";

/// Every flag the parser accepts. Held equal to the flags named in USAGE
/// by a test, and consulted at runtime so the list is what the parser
/// actually honours.
const FLAGS: [&str; 7] = [
    "--strict",
    "--dedupe",
    "--format",
    "--values",
    "--stdin",
    "--hidden",
    "--no-ignore",
];

#[derive(Debug)]
struct Cli {
    /// Fail the run if any file could not be read.
    strict: bool,
    inputs: Vec<PathBuf>,
    stdin: bool,
    /// Print values alone rather than JSON reports. The reviewer's next
    /// step is almost always another tool, and making them run `jq`
    /// first is a tax on the person this was built for.
    values_only: bool,
    scan: ScanOptions,
    walk: WalkOptions,
}

pub(crate) fn run() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if let Some(first) = args.first() {
        match first.as_str() {
            "mcp" => return crate::mcp::serve(),
            "--help" | "-h" => {
                println!("{USAGE}");
                return ExitCode::SUCCESS;
            }
            "--version" | "-V" => {
                println!("numbers-le {}", env!("CARGO_PKG_VERSION"));
                return ExitCode::SUCCESS;
            }
            _ => {}
        }
    }

    match execute(&args) {
        Ok(code) => ExitCode::from(code),
        Err(message) => {
            eprintln!("numbers-le: {message}");
            ExitCode::from(2)
        }
    }
}

fn execute(args: &[String]) -> Result<u8, String> {
    let options = parse(args)?;
    let (reports, binary) = if options.stdin {
        (vec![scan_stdin(&options)?], 0)
    } else {
        let walked = walk::collect(&options.inputs, &options.walk)?;
        let scanned = walked
            .files
            .iter()
            .map(|target| scan::scan_file(target, options.scan))
            .collect();
        let (mut reports, binary) = scan::partition(scanned);
        // A path the walk could not open is a report line, not the end
        // of the run: one locked directory must not take the audit of
        // everything beside it with it, and must not vanish either.
        reports.extend(
            walked
                .unreadable
                .iter()
                .map(|(path, reason)| scan::unreadable(path, reason)),
        );
        (reports, binary)
    };

    let stdout = std::io::stdout();
    let terminal = stdout.is_terminal();
    let mut out = stdout.lock();
    let written = if options.values_only {
        write_values(&mut out, &reports, terminal)
    } else {
        write_reports(&mut out, &reports, terminal)
    };
    written.map_err(|error| format!("could not write the report: {error}"))?;
    drop(out);

    let values_on_stdout = options.values_only && !terminal;
    summarise(
        &mut std::io::stderr().lock(),
        &reports,
        binary,
        values_on_stdout,
    );
    Ok(scan::exit_code(&reports, options.strict))
}

/// A terminal gets nothing here. The stderr listing already shows every
/// number a person reads, and the JSON beside it on the same screen is
/// the same answer a second time in a form nobody reads by eye. Anything
/// that can parse — a pipe, a file, a subprocess — still gets every
/// report, so no script sees a difference.
fn write_reports(
    out: &mut impl Write,
    reports: &[FileReport],
    terminal: bool,
) -> std::io::Result<()> {
    if terminal {
        return Ok(());
    }
    for report in reports {
        let line = serde_json::to_string(report).expect("a report serializes");
        writeln!(out, "{line}")?;
    }
    Ok(())
}

/// Silent at a terminal for the same reason as the reports, which is
/// why [`summarise`] lists the values itself when this stays quiet.
fn write_values(
    out: &mut impl Write,
    reports: &[FileReport],
    terminal: bool,
) -> std::io::Result<()> {
    if terminal {
        return Ok(());
    }
    for report in reports {
        for found in &report.numbers {
            writeln!(out, "{}", found.value)?;
        }
    }
    Ok(())
}

fn scan_stdin(options: &Cli) -> Result<FileReport, String> {
    let mut content = String::new();
    std::io::stdin()
        .read_to_string(&mut content)
        .map_err(|error| format!("could not read stdin: {error}"))?;
    // No filename to infer from, so an unnamed format falls back — which
    // is the same answer a source file gets and needs no special case.
    let format = options
        .scan
        .format
        .unwrap_or(crate::extract::FALLBACK_FORMAT);
    Ok(scan::scan_content(
        &content,
        "<stdin>".to_string(),
        format,
        options.scan,
    ))
}

fn parse(args: &[String]) -> Result<Cli, String> {
    let mut options = Cli {
        inputs: Vec::new(),
        stdin: false,
        strict: false,
        values_only: false,
        scan: ScanOptions::default(),
        walk: WalkOptions::default(),
    };

    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        // Strict parsing, never a silent default: a typo'd `--dedup`
        // that quietly did nothing would produce a report the caller
        // believed was deduplicated.
        if arg.starts_with('-') && !FLAGS.contains(&arg.as_str()) {
            return Err(format!("{arg} is not an option. Try --help."));
        }

        match arg.as_str() {
            "--dedupe" => options.scan.dedupe = true,
            "--values" => options.values_only = true,
            "--stdin" => options.stdin = true,
            "--strict" => options.strict = true,
            "--hidden" => options.walk.hidden = true,
            "--no-ignore" => options.walk.respect_ignore = false,
            // An unknown format falls back rather than failing, which is
            // the extension's behaviour and the reason this tool can be
            // pointed at a repository nobody has described to it. The
            // flag still takes a value, so a missing one is a refusal.
            "--format" => {
                let value = rest
                    .next()
                    .ok_or_else(|| "--format needs a format".to_string())?;
                options.scan.format = Some(resolve_format(Some(value), None));
            }
            path => options.inputs.push(PathBuf::from(path)),
        }
    }

    if options.stdin && !options.inputs.is_empty() {
        return Err("reading from stdin takes no file arguments".to_string());
    }
    if !options.stdin && options.inputs.is_empty() {
        return Err("name a file or a directory to read. Try --help.".to_string());
    }
    Ok(options)
}

/// The human half. Every line restates something already on stdout —
/// except the binary count, which is the one thing stdout cannot carry
/// because those files produce no report line at all.
///
/// `values_on_stdout` is true only when `--values` is actually printing
/// them. At a terminal stdout is silent, so the numbers are listed here
/// or a `--values` run would show nothing but a count.
fn summarise(
    stderr: &mut impl Write,
    reports: &[FileReport],
    binary: usize,
    values_on_stdout: bool,
) {
    let mut numbers = 0;
    let mut unlocated = 0;

    for report in reports {
        for diagnostic in &report.diagnostics {
            let _ = writeln!(stderr, "{}: {}", report.file, diagnostic.message);
        }
        // With --values the values are already on stdout; repeating them
        // here would double every line a reviewer is piping.
        if !values_on_stdout {
            for found in &report.numbers {
                let _ = writeln!(stderr, "{}", scan::describe(report, found));
            }
        }
        numbers += report.summary.numbers;
        unlocated += report.summary.unlocated;
    }

    let _ = writeln!(
        stderr,
        "{} in {}",
        plural(numbers, "number", "numbers"),
        plural(reports.len(), "file", "files")
    );
    if binary > 0 {
        // Not a report line, but not a silence either: a reader has to
        // know the scan covered fewer files than the tree holds.
        let _ = writeln!(
            stderr,
            "{} skipped",
            plural(binary, "binary file", "binary files")
        );
    }
    if unlocated > 0 {
        // Said plainly: a reader treating this report as a complete
        // index of where each number lives needs to know how much of it
        // is not an index.
        let _ = writeln!(
            stderr,
            "{} could not be located in the source",
            plural(unlocated, "value", "values")
        );
    }
}

fn plural(count: usize, one: &str, many: &str) -> String {
    format!("{count} {}", if count == 1 { one } else { many })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::SUPPORTED_FORMATS;

    fn sample_reports() -> Vec<FileReport> {
        let options = parse(&["x".into()]).expect("a valid command line");
        vec![scan::scan_content(
            r#"{"rate":42}"#,
            "a.json".into(),
            "json",
            options.scan,
        )]
    }

    #[test]
    fn a_pipe_gets_one_report_per_line() {
        let reports = sample_reports();
        let mut out = Vec::new();
        write_reports(&mut out, &reports, false).expect("a write");
        let text = String::from_utf8(out).expect("utf-8");
        assert_eq!(text.lines().count(), reports.len());
        assert!(text.starts_with('{'), "{text}");
    }

    #[test]
    fn a_terminal_gets_no_json() {
        let reports = sample_reports();
        let mut out = Vec::new();
        write_reports(&mut out, &reports, true).expect("a write");
        assert_eq!(String::from_utf8(out).expect("utf-8"), "");
    }

    #[test]
    fn a_pipe_gets_the_values_and_a_terminal_none() {
        let reports = sample_reports();
        let mut piped = Vec::new();
        write_values(&mut piped, &reports, false).expect("a write");
        assert_eq!(String::from_utf8(piped).expect("utf-8"), "42\n");
        let mut shown = Vec::new();
        write_values(&mut shown, &reports, true).expect("a write");
        assert_eq!(String::from_utf8(shown).expect("utf-8"), "");
    }

    /// With stdout silent at a terminal, a `--values` run would show a
    /// bare count if stderr did not carry the numbers.
    #[test]
    fn stderr_lists_the_numbers_unless_values_are_on_stdout() {
        let reports = sample_reports();
        let mut listed = Vec::new();
        summarise(&mut listed, &reports, 0, false);
        let text = String::from_utf8(listed).expect("utf-8");
        assert!(text.starts_with("a.json:"), "{text}");
        assert!(text.contains("  42\n"), "{text}");
        assert!(text.ends_with("1 number in 1 file\n"), "{text}");

        let mut quiet = Vec::new();
        summarise(&mut quiet, &reports, 0, true);
        assert_eq!(
            String::from_utf8(quiet).expect("utf-8"),
            "1 number in 1 file\n"
        );
    }

    #[test]
    fn every_documented_flag_is_parsed_and_the_reverse() {
        let mut documented: Vec<&str> = USAGE
            .split_whitespace()
            .filter(|word| word.starts_with("--"))
            .map(|word| word.trim_end_matches([',', '.', ':', ';']))
            .filter(|word| !matches!(*word, "--version" | "--help"))
            .collect();
        documented.sort_unstable();
        documented.dedup();

        let mut implemented = FLAGS.to_vec();
        implemented.sort_unstable();
        assert_eq!(documented, implemented);
    }

    #[test]
    fn the_parser_accepts_every_flag_it_lists() {
        for flag in FLAGS {
            let args: Vec<String> = match flag {
                "--format" => vec![flag.into(), "json".into(), "x".into()],
                "--stdin" => vec![flag.into()],
                _ => vec![flag.into(), "x".into()],
            };
            assert!(parse(&args).is_ok(), "{flag}");
        }
    }

    #[test]
    fn an_unknown_flag_is_refused_rather_than_ignored() {
        let error = parse(&["--dedup".into(), "x".into()]).expect_err("a refusal");
        assert!(error.contains("--dedup"), "{error}");
    }

    /// The one place this crate is deliberately lenient, and it is the
    /// extension's leniency: a format nobody recognises is the text
    /// scan, not a refusal.
    #[test]
    fn an_unknown_format_falls_back_rather_than_being_refused() {
        let options =
            parse(&["--format".into(), "handwriting".into(), "x".into()]).expect("accepted");
        assert_eq!(options.scan.format, Some(crate::extract::FALLBACK_FORMAT));
    }

    #[test]
    fn every_offered_format_is_accepted_by_name() {
        for format in SUPPORTED_FORMATS {
            let options = parse(&["--format".into(), format.into(), "x".into()]).expect(format);
            assert_eq!(options.scan.format, Some(format));
        }
    }

    #[test]
    fn a_format_flag_with_no_value_is_refused() {
        assert!(parse(&["--format".into()]).is_err());
    }

    /// There is no verdict, so there is no flag that would produce one.
    /// If this ever needs changing, the tool has grown an opinion about
    /// which numbers matter.
    #[test]
    fn no_flag_asks_for_a_judgment() {
        for attempt in [
            "--user-facing",
            "--spellcheck",
            "--min-length",
            "--lang",
            "--fix",
        ] {
            assert!(
                parse(&[attempt.into(), "x".into()]).is_err(),
                "{attempt} was accepted"
            );
        }
        for word in ["magic", "round", "convert", "score"] {
            assert!(!USAGE.contains(word), "the usage text offers {word}");
        }
    }

    #[test]
    fn naming_nothing_is_refused() {
        assert!(parse(&[]).is_err());
    }

    #[test]
    fn stdin_and_file_arguments_together_are_refused() {
        assert!(parse(&["--stdin".into(), "x".into()]).is_err());
    }

    #[test]
    fn the_usage_text_states_greps_convention() {
        assert!(USAGE.contains("grep"));
        for code in ["0", "1", "2"] {
            assert!(USAGE.contains(code), "exit code {code} is undocumented");
        }
    }
}
