//! Inputs chosen to break the reader, run against the built binary.
//!
//! **Not a fixture directory.** Windows cannot check in a FIFO, a
//! symlink loop or a mode-000 file, so the tree is built at runtime and
//! every case a platform cannot express says so by name on stderr
//! rather than passing quietly.
//!
//! Every case asserts the same three things: the process does not
//! panic, does not hang, and exits 0, 1 or 2 — never on a signal. Three
//! of the four defects this file exists for were found by hand on a
//! crafted tree: a BOM read as content emptied three crates silently, a
//! PNG made `--strict` exit 2 on every repository holding an image, and
//! a non-UTF-8 file vanished from the report entirely.

use std::fs::File;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_numbers-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Generous enough that a loaded shared runner does not flake, tight
/// enough that a genuine hang is a failure rather than a job timeout
/// with no message.
const LIMIT: Duration = Duration::from_secs(60);

/// A number every content hazard carries, so "the file was read" has an
/// answer rather than an absence.
const VALUE: &str = "1234.5";

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "numbers-le-hazard-{name}-{}-{unique}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn path(&self) -> &Path {
        &self.root
    }

    fn text(&self) -> String {
        self.root.to_string_lossy().into_owned()
    }

    fn mkdir(&self, relative: &str) -> PathBuf {
        let target = self.root.join(relative);
        std::fs::create_dir_all(&target).expect("a directory");
        target
    }

    fn write(&self, relative: &str, contents: &str) -> PathBuf {
        self.write_bytes(relative, contents.as_bytes())
    }

    fn write_bytes(&self, relative: &str, contents: &[u8]) -> PathBuf {
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
    /// `None` when the process died on a signal, which is the failure
    /// this whole file is watching for.
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

/// Run the binary, bounded in time, with both streams captured to files.
///
/// Files rather than pipes on purpose: a report over a hundred thousand
/// lines fills a pipe buffer, and a parent that waits before draining
/// one deadlocks — which would look exactly like the hang this is here
/// to detect.
fn execute(args: &[&str]) -> Run {
    let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
    let capture = std::env::temp_dir().join(format!(
        "numbers-le-capture-{}-{unique}",
        std::process::id()
    ));
    std::fs::create_dir_all(&capture).expect("a capture directory");
    let out = capture.join("stdout");
    let err = capture.join("stderr");

    let mut child = Command::new(BINARY)
        .args(args)
        .stdin(Stdio::null())
        .stdout(File::create(&out).expect("a stdout file"))
        .stderr(File::create(&err).expect("a stderr file"))
        .spawn()
        .expect("the binary runs");

    let started = Instant::now();
    let status = loop {
        match child.try_wait().expect("the child can be waited on") {
            Some(status) => break status,
            None if started.elapsed() >= LIMIT => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = std::fs::remove_dir_all(&capture);
                panic!("the run hung past {LIMIT:?}: {args:?}");
            }
            None => std::thread::sleep(Duration::from_millis(5)),
        }
    };

    let read = |path: &Path| {
        String::from_utf8_lossy(&std::fs::read(path).unwrap_or_default()).into_owned()
    };
    let run = Run {
        code: status.code(),
        stdout: read(&out),
        stderr: read(&err),
    };
    let _ = std::fs::remove_dir_all(&capture);
    run
}

/// The floor every case shares. A signal — `code()` of `None` on Unix —
/// is the SIGABRT class this net exists to catch.
fn assert_answered(run: &Run, case: &str) {
    let code = run
        .code
        .unwrap_or_else(|| panic!("{case}: the process died on a signal, not an exit code"));
    assert!(
        (0..=2).contains(&code),
        "{case}: exit {code} is not one of grep's three\n{}",
        run.stderr
    );
}

fn reports(run: &Run) -> Vec<serde_json::Value> {
    run.stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

/// A named skip. A platform that cannot express a case says so rather
/// than reporting a pass it did not earn.
fn skipped(case: &str, why: &str) {
    eprintln!("SKIPPED {case}: {why}");
}

fn utf16le_with_bom(text: &str) -> Vec<u8> {
    let mut bytes = vec![0xff, 0xfe];
    for unit in text.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }
    bytes
}

/// Every content hazard, each holding a value the crate should find.
fn content_hazards() -> Vec<(&'static str, Vec<u8>)> {
    let with_nul = {
        let mut bytes = format!("rate {VALUE}\n").into_bytes();
        bytes.insert(2, 0);
        bytes
    };
    vec![
        (
            "a utf-8 byte-order mark",
            format!("\u{feff}rate {VALUE}\n").into_bytes(),
        ),
        (
            "crlf line endings",
            format!("rate {VALUE}\r\nand more\r\n").into_bytes(),
        ),
        (
            "a lone carriage return",
            format!("rate {VALUE}\rand more\r").into_bytes(),
        ),
        ("no trailing newline", format!("rate {VALUE}").into_bytes()),
        ("an empty file", Vec::new()),
        ("a file of only whitespace", b"   \t\n \n\t".to_vec()),
        ("a nul byte mid-file", with_nul),
        ("invalid utf-8", vec![b'r', b'a', b't', b'e', 0xff, 0xfe]),
        (
            "utf-16le with a bom",
            utf16le_with_bom(&format!("rate {VALUE}\n")),
        ),
        (
            "a four-byte emoji before the value",
            format!("\u{1f3af} {VALUE}\n").into_bytes(),
        ),
        (
            "a line one megabyte long",
            format!("{} rate {VALUE}\n", "a".repeat(1_000_000)).into_bytes(),
        ),
        (
            "a hundred thousand lines",
            format!("{}rate {VALUE}\n", "filler\n".repeat(100_000)).into_bytes(),
        ),
    ]
}

#[test]
fn every_content_hazard_is_answered_rather_than_survived() {
    for (case, bytes) in content_hazards() {
        let tree = Tree::new("content");
        let file = tree.write_bytes("case.txt", &bytes);
        let outcome = execute(&[&file.to_string_lossy()]);
        assert_answered(&outcome, case);
        // Whatever it decided, it decided it in JSON Lines and nothing
        // else — a stray human message on stdout fails to parse.
        let _ = reports(&outcome);
    }
}

/// The defect that silently emptied three crates in this family: three
/// invisible bytes at the head of a file read as content.
#[test]
fn a_byte_order_mark_does_not_move_the_reported_column() {
    let tree = Tree::new("bom");
    let plain = tree.write("plain.txt", &format!("rate {VALUE}\n"));
    let marked = tree.write("marked.txt", &format!("\u{feff}rate {VALUE}\n"));

    let column = |path: &PathBuf| -> serde_json::Value {
        let outcome = execute(&[&path.to_string_lossy()]);
        assert_answered(&outcome, "a byte-order mark");
        reports(&outcome)[0]["numbers"][0]["column"].clone()
    };
    assert_eq!(column(&plain), 6);
    assert_eq!(column(&marked), column(&plain));
}

/// A multi-byte character before the value is where a byte column and an
/// editor's column part company, and where slicing one byte at a time
/// aborts.
#[test]
fn an_emoji_before_the_value_does_not_move_it_by_bytes() {
    let tree = Tree::new("emoji");
    let file = tree.write("case.txt", &format!("\u{1f3af} {VALUE}\n"));
    let outcome = execute(&[&file.to_string_lossy()]);
    assert_answered(&outcome, "an emoji before the value");
    let found = &reports(&outcome)[0]["numbers"][0];
    assert_eq!(found["value"], VALUE);
    // The target is two UTF-16 units, then a space: the value starts at
    // column 4, not at byte 6.
    assert_eq!(found["column"], 4);
}

/// The three-way split `--strict` rests on, asserted on one tree: a
/// binary file is not a report, a text file that could not be decoded
/// is, and only the second one fails `--strict`.
#[test]
fn a_binary_file_is_not_a_report_and_an_undecodable_text_file_is() {
    let tree = Tree::new("strict");
    tree.write("rates.env", "VAT=0.2\n");
    tree.write_bytes("logo.png", &[0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]);
    tree.write_bytes("wide.txt", &utf16le_with_bom("rate 1\n"));

    let clean = execute(&[&tree.text()]);
    assert_answered(&clean, "a binary file beside a text one");
    let named: Vec<String> = reports(&clean)
        .iter()
        .filter_map(|report| report["file"].as_str())
        .map(|file| file.rsplit('/').next().unwrap_or(file).to_string())
        .collect();
    assert_eq!(
        named,
        ["rates.env"],
        "a binary file produces no report line"
    );
    assert_eq!(clean.code, Some(0));
    assert_eq!(
        execute(&["--strict", &tree.text()]).code,
        Some(0),
        "a binary file never fails --strict"
    );

    // Invalid UTF-8 with no NUL byte: it looked like text and was not.
    tree.write_bytes("notes.txt", &[0x68, 0x69, 0xff, 0xfe]);
    let broken = execute(&[&tree.text()]);
    assert_answered(&broken, "an undecodable text file");
    assert_eq!(broken.code, Some(0), "on its own it does not fail the run");
    let skipped = reports(&broken)
        .into_iter()
        .find(|report| {
            report["file"]
                .as_str()
                .is_some_and(|file| file.ends_with("notes.txt"))
        })
        .expect("the undecodable file is named rather than dropped");
    assert_eq!(skipped["diagnostics"][0]["code"], "skipped");
    assert_eq!(execute(&["--strict", &tree.text()]).code, Some(2));
}

/// The distinction the exit codes exist to make. 2 means the *question*
/// was malformed; a file the filesystem refused is a fact about the
/// tree, and one of those must never end an audit of everything beside
/// it.
#[test]
fn exit_two_is_for_a_malformed_question_and_nothing_else() {
    let tree = Tree::new("questions");
    tree.write("rates.env", "VAT=0.2\n");

    for malformed in [
        vec!["--nonsense", &tree.text()],
        vec!["--format"],
        vec![&tree.text(), "--stdin"],
        vec!["/no/such/place-xyz"],
    ] {
        let outcome = execute(&malformed);
        assert_eq!(outcome.code, Some(2), "{malformed:?}\n{}", outcome.stderr);
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let locked = tree.mkdir("locked");
        tree.write("locked/inner.env", "A=1\n");
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000))
            .expect("a locked directory");
        let refused = std::fs::read_dir(&locked).is_err();
        let over = execute(&[&tree.text()]);
        let strict = execute(&["--strict", &tree.text()]);
        let _ = std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755));

        if refused {
            assert_eq!(
                over.code,
                Some(0),
                "a locked directory is not a malformed question\n{}",
                over.stderr
            );
            assert!(
                reports(&over)
                    .iter()
                    .any(|report| report["diagnostics"][0]["code"] == "skipped"),
                "and it is named rather than dropped from the report"
            );
            assert_eq!(strict.code, Some(2), "--strict is how you refuse it");
        } else {
            skipped(
                "a locked directory is not a malformed question",
                "this user reads a mode-000 directory",
            );
        }
    }
    #[cfg(not(unix))]
    skipped(
        "a locked directory is not a malformed question",
        "Windows has no mode-000 an unprivileged test can set",
    );
}

/// Every filesystem hazard in one tree, walked in one run. The walk has
/// to survive all of them **and still report the ordinary file beside
/// them** — a tree that answers nothing is the failure this catches.
#[test]
fn the_walk_survives_a_tree_of_filesystem_hazards() {
    let tree = Tree::new("filesystem");
    tree.write("ordinary.env", "VAT=0.2\n");
    tree.write("with spaces.env", "A=1\n");
    tree.write("\u{e9}t\u{e9}.env", "B=2\n");
    tree.write("\u{1f3af}.env", "C=3\n");
    // A directory wearing a file's extension. The walk must descend into
    // it rather than try to read it.
    tree.mkdir("x.json");
    tree.write("x.json/inner.env", "D=4\n");

    let target = tree.write("target.env", "E=5\n");
    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        symlink(&target, tree.path().join("link.env")).expect("a symlink");
        symlink(tree.path().join("gone.env"), tree.path().join("broken.env"))
            .expect("a broken symlink");
        symlink(tree.path(), tree.path().join("loop")).expect("a symlink loop");

        let fifo = tree.path().join("pipe.env");
        let made = Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .is_ok_and(|status| status.success());
        if !made {
            skipped("a fifo", "mkfifo is not on this machine");
        }
    }
    #[cfg(windows)]
    {
        // Creating a symlink on Windows needs Developer Mode or an
        // elevated shell; where it is not available the case is skipped
        // by name rather than asserted into a false pass.
        let made = std::os::windows::fs::symlink_file(&target, tree.path().join("link.env"));
        if made.is_err() {
            skipped("a symlink", "this Windows session may not create one");
        }
        skipped("a fifo", "Windows has no filesystem FIFO");
    }
    let _ = &target;

    // A path over 260 characters, which is where Windows differs: the
    // long-path limit is per component and per path, and a walk that
    // trips on it must still answer for everything else.
    let deep = tree.mkdir(&"deeply/".repeat(40));
    let long = deep.join("a.env");
    if std::fs::write(&long, "F=6\n").is_err() {
        skipped(
            "a path over 260 characters",
            "this filesystem refused to create one",
        );
    }

    let outcome = execute(&[&tree.text()]);
    assert_answered(&outcome, "a tree of filesystem hazards");
    let named: Vec<String> = reports(&outcome)
        .iter()
        .filter_map(|report| report["file"].as_str())
        .map(|file| file.rsplit('/').next().unwrap_or(file).to_string())
        .collect();
    assert!(
        named.iter().any(|file| file == "ordinary.env"),
        "the walk answered for none of the tree: {named:?}\n{}",
        outcome.stderr
    );
    for expected in ["with spaces.env", "\u{e9}t\u{e9}.env", "\u{1f3af}.env"] {
        assert!(named.iter().any(|file| file == expected), "{named:?}");
    }
}

/// A symlink loop, on its own, with nothing else in the tree to hide a
/// hang behind. `follow_links(false)` is what makes this terminate, and
/// nothing else asserts it.
#[cfg(unix)]
#[test]
fn a_symlink_loop_terminates() {
    let tree = Tree::new("loop");
    tree.write("a.env", "A=1\n");
    let inner = tree.mkdir("inner");
    std::os::unix::fs::symlink(tree.path(), inner.join("up")).expect("a symlink loop");
    let outcome = execute(&[&tree.text()]);
    assert_answered(&outcome, "a symlink loop");
}

/// A file the filesystem refuses to open, beside one it does not.
#[cfg(unix)]
#[test]
fn a_permission_denied_file_is_named_and_does_not_end_the_run() {
    use std::os::unix::fs::PermissionsExt;

    let tree = Tree::new("denied");
    tree.write("open.env", "A=1\n");
    let closed = tree.write("closed.env", "B=2\n");
    std::fs::set_permissions(&closed, std::fs::Permissions::from_mode(0o000))
        .expect("an unreadable file");

    if std::fs::read(&closed).is_ok() {
        skipped(
            "a permission-denied file",
            "this user reads a mode-000 file",
        );
        return;
    }

    let outcome = execute(&[&tree.text()]);
    assert_answered(&outcome, "a permission-denied file");
    assert_eq!(outcome.code, Some(0), "{}", outcome.stderr);
    let denied = reports(&outcome)
        .into_iter()
        .find(|report| {
            report["file"]
                .as_str()
                .is_some_and(|file| file.ends_with("closed.env"))
        })
        .expect("the unreadable file is named rather than dropped");
    assert_eq!(denied["diagnostics"][0]["code"], "skipped");
    assert_eq!(execute(&["--strict", &tree.text()]).code, Some(2));
}
