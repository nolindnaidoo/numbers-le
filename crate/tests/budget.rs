//! A wall-clock ceiling on a fixed tree, and a linearity check beside
//! it.
//!
//! secrets-le was fifty times slower than its siblings for a release and
//! nobody noticed, because nothing measured it. A ceiling this generous
//! catches an order of magnitude and nothing finer — which is the only
//! thing worth catching on a shared runner.
//!
//! **The tree is generated from a seed, not checked in.** 500 files of
//! source and config is a megabyte of fixtures nobody would ever read,
//! and the shape is what matters rather than the bytes. The seed is
//! fixed and printed, so a slow run is reproducible.
//!
//! Gated behind `NUMBERS_LE_BUDGET` because it is a timing test: it has
//! no business running on a laptop mid-edit, and a skipped run says so
//! rather than passing.
//!
//! ## The measurement
//!
//! Taken 2026-08-12 on an Apple M4 laptop (macOS 25.4, `cargo test
//! --release`), warm page cache, best of two runs over the tree this
//! file generates:
//!
//! ```text
//! one tree  (500 files):  21 ms
//! four      (2000 files): 75 ms   — 3.7x, against a 6x allowance
//! ```
//!
//! The ceiling is 10x the first of those: 210 ms. It is a bound on an
//! order of magnitude, not a benchmark, and a GitHub runner is slower
//! than this laptop — if it lands near the line, re-measure there and
//! say so in this note rather than quietly raising the number.
//!
//! The measurement **dropped** this release rather than rose: a source
//! file now goes to the literal reader instead of the text scan, so a
//! scan reports the numbers a file holds instead of the far larger
//! count of runs a shredded literal produced.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_numbers-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// 10x the local measurement recorded in the module note.
const CEILING: Duration = Duration::from_millis(210);

/// Four times the tree must not take more than six times as long.
/// Anything quadratic blows through this; ordinary variance does not.
const LINEARITY: f64 = 6.0;

/// Printed on every run, so a failure names the tree that was slow.
const SEED: u64 = 20_260_812;

const FILES_PER_COPY: usize = 500;

fn enabled(name: &str) -> bool {
    if std::env::var_os("NUMBERS_LE_BUDGET").is_some() {
        return true;
    }
    eprintln!("SKIPPED {name}: set NUMBERS_LE_BUDGET to run it");
    false
}

/// A tiny xorshift, so the tree is the same tree on every machine and
/// every run without a dependency to get there.
struct Seeded(u64);

impl Seeded {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn pick<'a, T>(&mut self, from: &'a [T]) -> &'a T {
        let index = usize::try_from(self.next() % from.len() as u64).expect("an index");
        &from[index]
    }
}

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "numbers-le-budget-{name}-{}-{unique}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self { root }
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// The shapes a real checkout is made of: source in several dialects,
/// config in several formats, and prose. Extensions, not contents, are
/// what decide which extractor does the work.
const SHAPES: [(&str, &str); 8] = [
    (
        "rs",
        "const MASK: u64 = 0x{HEX};\nconst BUDGET: usize = 1_000_{N};\nlet rate = {F};\n",
    ),
    (
        "ts",
        "export const RATE = {F};\nexport const TOTAL = {N}n;\nconst mask = 0x{HEX};\n",
    ),
    (
        "go",
        "const Mode = 0755\nconst Budget = 1_000_{N}\nvar rate = {F}\n",
    ),
    (
        "py",
        "RATE = {F}\nMASK = 0x{HEX}\nBUDGET = 1_000_{N}\nDTYPE = \"float32\"\n",
    ),
    (
        "json",
        "{{\"rate\": {F}, \"port\": {N}, \"quoted\": \"{N}\"}}\n",
    ),
    ("toml", "rate = {F}\nport = {N}\nlimits = [1, 2]\n"),
    ("env", "RATE={F}\nPORT={N}\nNAME=standard\n"),
    ("md", "The rate is {F} over {N} units, released v1.2.3.\n"),
];

/// Build one copy of the tree: `FILES_PER_COPY` files under `prefix`,
/// spread over directories so the walk has something to walk.
fn populate(root: &Path, prefix: &str, seeded: &mut Seeded) {
    for index in 0..FILES_PER_COPY {
        let (extension, template) = *seeded.pick(&SHAPES);
        let body = template
            .replace("{HEX}", &format!("{:X}", seeded.next() % 0xffff))
            .replace("{N}", &(seeded.next() % 100_000).to_string())
            .replace("{F}", &format!("0.{:04}", seeded.next() % 10_000));
        let mut content = String::with_capacity(body.len() * 12);
        for _ in 0..12 {
            let _ = write!(content, "{body}");
        }
        let directory = root.join(format!("{prefix}/pkg{}", index % 25));
        std::fs::create_dir_all(&directory).expect("a directory");
        std::fs::write(directory.join(format!("file{index}.{extension}")), &content)
            .expect("a file");
    }
}

/// Time one scan of a tree, asserting it answered rather than refused.
fn scan(root: &Path) -> Duration {
    let started = Instant::now();
    let output = Command::new(BINARY)
        .arg(root)
        // The report itself is not what is being measured, and writing a
        // megabyte of JSON to a captured pipe would measure the harness.
        .arg("--values")
        .output()
        .expect("the binary runs");
    let elapsed = started.elapsed();
    assert_eq!(
        output.status.code(),
        Some(0),
        "the scan did not finish: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        output.stdout.len() > 1000,
        "the scan reported almost nothing, so it measured almost nothing"
    );
    elapsed
}

/// Warm the page cache and the process, so the ceiling measures the
/// scan rather than the first read of a freshly written tree.
fn timed(root: &Path) -> Duration {
    let _ = scan(root);
    let a = scan(root);
    let b = scan(root);
    a.min(b)
}

#[test]
fn a_five_hundred_file_tree_scans_inside_its_budget() {
    if !enabled("a_five_hundred_file_tree_scans_inside_its_budget") {
        return;
    }
    let tree = Tree::new("ceiling");
    let mut seeded = Seeded(SEED);
    populate(&tree.root, "one", &mut seeded);

    let elapsed = timed(&tree.root);
    println!("budget: {FILES_PER_COPY} files scanned in {elapsed:?} (seed {SEED})");
    assert!(
        elapsed <= CEILING,
        "seed {SEED}: {FILES_PER_COPY} files took {elapsed:?}, over the {CEILING:?} ceiling — \
         10x the recorded local measurement, so this is an order of magnitude, not variance"
    );
}

/// The quadratic class, caught directly. Four times the work must not
/// take more than six times as long; a position lookup that rescans from
/// the top of the document takes sixteen.
#[test]
fn four_times_the_tree_does_not_take_sixteen_times_as_long() {
    if !enabled("four_times_the_tree_does_not_take_sixteen_times_as_long") {
        return;
    }
    let small = Tree::new("linear-one");
    let large = Tree::new("linear-four");
    let mut seeded = Seeded(SEED);
    populate(&small.root, "one", &mut seeded);
    for copy in 0..4 {
        let mut same = Seeded(SEED);
        populate(&large.root, &format!("copy{copy}"), &mut same);
    }

    let one = timed(&small.root);
    let four = timed(&large.root);
    let ratio = four.as_secs_f64() / one.as_secs_f64().max(0.000_001);
    println!("budget: one tree {one:?}, four trees {four:?}, ratio {ratio:.2}x (seed {SEED})");
    assert!(
        ratio <= LINEARITY,
        "seed {SEED}: four times the tree took {ratio:.2}x as long ({one:?} then {four:?}), \
         over the {LINEARITY}x allowance — that is the shape of something quadratic"
    );
}
