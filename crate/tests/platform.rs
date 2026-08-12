//! Behaviour that differs by operating system, asserted rather than
//! hoped.
//!
//! Every one of these is a thing that shipped wrong somewhere in this
//! family: a report full of `\` on Windows for a release, a suite that
//! depended on `TZ` and passed only where the environment variable is
//! honoured, a stdin test that raced the refusal it was asserting.
//!
//! Runs on macOS, Windows and Linux. Where a platform cannot express a
//! case it is skipped **by name** on stderr, never passed quietly.

use std::fmt::Write as _;
use std::fs::File;
use std::io::Write as _;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_numbers-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);
const LIMIT: Duration = Duration::from_secs(60);

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "numbers-le-platform-{name}-{}-{unique}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn text(&self) -> String {
        self.root.to_string_lossy().into_owned()
    }

    fn write(&self, relative: &str, contents: &str) -> PathBuf {
        let target = self.root.join(relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).expect("a parent directory");
        }
        std::fs::write(&target, contents).expect("a file");
        target
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

struct Run {
    code: Option<i32>,
    stdout: String,
}

/// Run the binary with the environment named, bounded in time, with
/// output captured to a file rather than a pipe — a report longer than a
/// pipe buffer would otherwise deadlock the parent.
fn execute(args: &[&str], timezone: Option<&str>) -> Run {
    let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
    let capture = std::env::temp_dir().join(format!(
        "numbers-le-platform-capture-{}-{unique}",
        std::process::id()
    ));
    std::fs::create_dir_all(&capture).expect("a capture directory");
    let out = capture.join("stdout");

    let mut command = Command::new(BINARY);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(File::create(&out).expect("a stdout file"))
        .stderr(Stdio::null());
    match timezone {
        Some(zone) => command.env("TZ", zone),
        None => command.env_remove("TZ"),
    };

    let mut child = command.spawn().expect("the binary runs");
    let started = Instant::now();
    let status = loop {
        match child.try_wait().expect("the child can be waited on") {
            Some(status) => break status,
            None if started.elapsed() >= LIMIT => {
                let _ = child.kill();
                let _ = child.wait();
                panic!("the run hung past {LIMIT:?}: {args:?}");
            }
            None => std::thread::sleep(Duration::from_millis(5)),
        }
    };

    let stdout = String::from_utf8_lossy(&std::fs::read(&out).unwrap_or_default()).into_owned();
    let _ = std::fs::remove_dir_all(&capture);
    Run {
        code: status.code(),
        stdout,
    }
}

fn run(args: &[&str]) -> Run {
    execute(args, Some("UTC"))
}

fn reports(run: &Run) -> Vec<serde_json::Value> {
    run.stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

fn skipped(case: &str, why: &str) {
    eprintln!("SKIPPED {case}: {why}");
}

/// A tree with a nested directory, so a separator has somewhere to show
/// up.
fn nested(name: &str) -> Tree {
    let tree = Tree::new(name);
    tree.write("rates.env", "VAT=0.2\n");
    tree.write("src/deep/pricing.ts", "const MARKUP = 1.15;\n");
    tree.write("config/app.toml", "port = 8080\n");
    tree
}

/// **Every path in the report uses `/`, on every platform.** envsync-le
/// shipped `\` on Windows for a release, which made every path in a
/// Windows report differ from the same path in a Linux one for no reason
/// a reader could see. A report is diffed against one produced somewhere
/// else; that is most of what a report in CI is for.
///
/// On Unix this passes by construction. It is the Windows leg that is
/// the check, which is why the job runs on all three.
#[test]
fn every_path_in_the_report_is_separated_by_forward_slashes() {
    let tree = nested("separators");
    let outcome = run(&[&tree.text()]);
    assert_eq!(outcome.code, Some(0));
    let scanned = reports(&outcome);
    assert_eq!(scanned.len(), 3, "the whole tree was walked");
    for report in &scanned {
        let file = report["file"].as_str().expect("a file name");
        assert!(
            !file.contains('\\'),
            "a backslash in a reported path: {file}"
        );
        assert!(
            file.contains('/'),
            "a nested path lost its separators: {file}"
        );
    }
}

/// **`TZ` independence.** Windows ignores the environment variable, so a
/// suite that depends on it passes on two platforms and fails on the
/// third — or worse, passes everywhere and is measuring nothing. This
/// tool reads no clock at all, and that is asserted rather than assumed.
///
/// The job runs the whole suite twice for the same reason; this is the
/// case that names what identical means.
#[test]
fn the_answer_does_not_depend_on_the_timezone() {
    let tree = nested("timezone");
    let with = execute(&[&tree.text()], Some("UTC"));
    let without = execute(&[&tree.text()], None);
    let elsewhere = execute(&[&tree.text()], Some("Pacific/Kiritimati"));
    assert_eq!(with.stdout, without.stdout, "TZ=UTC against no TZ");
    assert_eq!(with.stdout, elsewhere.stdout, "TZ=UTC against TZ=+14");
    assert_eq!(with.code, without.code);
}

/// **Case-insensitive filesystems.** `README.md` and `readme.md` are one
/// file on macOS and Windows and two on Linux. Either answer is right;
/// reporting one file twice is not.
#[test]
fn a_file_is_never_reported_twice_on_a_case_insensitive_filesystem() {
    let tree = Tree::new("case");
    tree.write("README.md", "rate 0.2\n");
    tree.write("readme.md", "rate 0.3\n");

    let outcome = run(&[&tree.text()]);
    let named: Vec<String> = reports(&outcome)
        .iter()
        .filter_map(|report| report["file"].as_str())
        .map(str::to_string)
        .collect();

    let insensitive = named.len() == 1;
    if insensitive {
        eprintln!("case-insensitive filesystem: the two names are one file");
    }
    let mut unique = named.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(
        unique.len(),
        named.len(),
        "a file was reported twice: {named:?}"
    );
    assert!(
        named.len() <= 2,
        "more report lines than files written: {named:?}"
    );
}

/// **Reserved Windows filenames.** `CON`, `PRN`, `AUX`, `NUL` and `COM1`
/// cannot be created there. The assertion is that the walk survives
/// whatever the filesystem allowed — not that the files exist, which is
/// the mistake that makes this test red on one platform and vacuous on
/// the others.
#[test]
fn the_walk_survives_the_reserved_windows_filenames() {
    let tree = Tree::new("reserved");
    tree.write("ordinary.env", "VAT=0.2\n");

    let mut made = Vec::new();
    for reserved in ["CON", "PRN", "AUX", "NUL", "COM1"] {
        let target = tree.root.join(reserved);
        match std::fs::write(&target, "A=1\n") {
            Ok(()) => made.push(reserved),
            Err(_) => skipped(
                &format!("a file named {reserved}"),
                "this filesystem reserves the name",
            ),
        }
    }

    let outcome = run(&[&tree.text()]);
    let code = outcome.code.expect("an exit code, not a signal");
    assert!((0..=2).contains(&code), "exit {code}");
    let named: Vec<String> = reports(&outcome)
        .iter()
        .filter_map(|report| report["file"].as_str())
        .map(|file| file.rsplit('/').next().unwrap_or(file).to_string())
        .collect();
    assert!(
        named.iter().any(|file| file == "ordinary.env"),
        "the reserved names took the rest of the tree with them: {named:?}\n\
         created: {made:?}"
    );
}

/// **stdin closed early.** The child refuses its arguments and exits
/// before reading a byte, so the write races the refusal — on a good day
/// it succeeds, on a bad one it is a broken pipe. **Assert the exit
/// code, never the write.** That race cost a red CI once.
#[test]
fn a_child_that_refuses_before_reading_stdin_still_exits_two() {
    let mut child = Command::new(BINARY)
        // --stdin takes no file arguments: refused by the parser, before
        // anything reads a byte.
        .args(["--stdin", "unexpected.json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("the binary runs");

    // Deliberately unchecked: a broken pipe here means the child refused
    // faster than this loop wrote, which is the behaviour under test.
    let _ = child
        .stdin
        .as_mut()
        .expect("stdin")
        .write_all(&vec![b'1'; 1 << 20]);
    drop(child.stdin.take());

    let status = child.wait().expect("the child finishes");
    assert_eq!(status.code(), Some(2));
}

/// A document arriving on stdin is read whole, on every platform —
/// including the one where a pipe is not a file descriptor.
#[test]
fn a_document_on_stdin_is_read_whole() {
    let mut child = Command::new(BINARY)
        .args(["--stdin", "--format", "csv", "--values"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("the binary runs");
    let mut document = String::new();
    for row in 0..10_000 {
        let _ = writeln!(document, "row{row},{row}");
    }
    child
        .stdin
        .as_mut()
        .expect("stdin")
        .write_all(document.as_bytes())
        .expect("the child is still reading");
    drop(child.stdin.take());

    let output = child.wait_with_output().expect("the child finishes");
    assert_eq!(output.status.code(), Some(0));
    let written = String::from_utf8_lossy(&output.stdout);
    assert_eq!(
        written.lines().count(),
        10_000,
        "a document arriving in pieces was read short"
    );
}
