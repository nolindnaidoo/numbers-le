//! Turning what the caller named into the list of files to read.
//!
//! Directories are walked with ripgrep's `ignore`, so "what this tool
//! reads" and "what ripgrep reads" are the same answer — which is the
//! answer a person auditing a repository already has in their head. A
//! file named explicitly is always read, ignore rules included: you
//! asked for it.
//!
//! There is no format filter, and here that is the point rather than a
//! precaution. A file this does not recognise falls through to a text
//! scan, so a `.ts` or a `.sql` full of hardcoded constants is read by
//! the walk rather than skipped by it.
//!
//! What the ignore rules keep out is deliberately not counted. On a
//! checkout with dependencies installed the number is around thirty
//! thousand and every one of them is `node_modules`, so a line reporting
//! it reads as a shortfall when the walk did exactly what it was asked.
//! `--no-ignore` is how you widen it.
//!
//! Each crate in this family stands on its own: no shared crate, no
//! published core, and nothing holding this file equal to the similar
//! ones in the sibling repos. Where they agree it is because the same
//! answer was right twice; where they diverge that is the point.

use std::path::{Path as StdPath, PathBuf};

#[derive(Debug, Clone)]
pub(crate) struct WalkOptions {
    pub(crate) hidden: bool,
    pub(crate) respect_ignore: bool,
}

/// What a walk reached, and what it could not.
///
/// **An entry the walk cannot read is carried, not fatal.** Aborting on
/// one made a single locked directory hide the whole tree: the run
/// exited 2 and wrote no reports at all, so an audit of ten thousand
/// files answered nothing because one of them was unreadable. Exit 2
/// means the *question* was malformed — a path that does not exist, an
/// unknown flag — never a file the filesystem refused.
#[derive(Debug, Default)]
pub(crate) struct Walked {
    pub(crate) files: Vec<PathBuf>,
    /// Each path the walk could not read, with the reason, in path
    /// order. Both surfaces turn these into `skipped` reports: named on
    /// stderr, carried in the JSON, failing `--strict`, never silent.
    pub(crate) unreadable: Vec<(PathBuf, String)>,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self {
            hidden: false,
            respect_ignore: true,
        }
    }
}

/// Collect every file to read, in a stable order.
///
/// The sort is not cosmetic: `ignore` makes no ordering guarantee, and a
/// report whose lines move between two runs over an unchanged tree
/// cannot be diffed — which is most of what a report in CI is for, and
/// all of what "what changed since last release" is for.
pub(crate) fn collect(inputs: &[PathBuf], options: &WalkOptions) -> Result<Walked, String> {
    let mut walked = Walked::default();

    for input in inputs {
        // A path the caller *named* and that is not there is a malformed
        // question, and stays a refusal. What the walk finds underneath
        // one is a fact about the tree.
        let metadata =
            std::fs::metadata(input).map_err(|error| format!("{}: {error}", input.display()))?;

        if metadata.is_file() {
            walked.files.push(input.clone());
            continue;
        }

        let found = walk_directory(input, options);
        walked.files.extend(found.files);
        walked.unreadable.extend(found.unreadable);
    }

    walked.files.sort();
    walked.files.dedup();
    walked.unreadable.sort();
    walked.unreadable.dedup();
    Ok(walked)
}

fn walk_directory(root: &StdPath, options: &WalkOptions) -> Walked {
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(!options.hidden)
        .git_ignore(options.respect_ignore)
        .git_global(options.respect_ignore)
        .git_exclude(options.respect_ignore)
        .ignore(options.respect_ignore)
        .parents(options.respect_ignore)
        // Never followed. A link out of the tree would have this reading
        // files the caller did not point it at, and reporting their
        // paths as though they were part of the audit.
        .follow_links(false);

    let mut walked = Walked::default();
    for entry in builder.build() {
        match entry {
            Ok(entry) if entry.file_type().is_some_and(|kind| kind.is_file()) => {
                walked.files.push(entry.into_path());
            }
            Ok(_) => {}
            Err(error) => walked.unreadable.push(refusal(&error, root)),
        }
    }
    walked
}

/// The path the walk could not read, and why, in the reader's terms.
///
/// `ignore`'s own message repeats the path inside the reason; the io
/// error alone is what a report line wants beside the name it already
/// carries.
fn refusal(error: &ignore::Error, root: &StdPath) -> (PathBuf, String) {
    let path = match error {
        ignore::Error::WithPath { path, .. } => path.clone(),
        ignore::Error::Loop { child, .. } => child.clone(),
        // Nothing else the walker produces names a path; the root is
        // then the most specific thing that can honestly be reported.
        _ => root.to_path_buf(),
    };
    let reason = error
        .io_error()
        .map_or_else(|| error.to_string(), std::string::ToString::to_string);
    (path, reason)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn names(walked: &Walked) -> Vec<String> {
        walked
            .files
            .iter()
            .map(|path| {
                path.file_name()
                    .expect("a file name")
                    .to_string_lossy()
                    .into_owned()
            })
            .collect()
    }

    #[test]
    fn a_named_file_is_the_whole_walk() {
        let tree = TempTree::new("walk-one");
        let file = tree.write("a.json", "{}");
        assert_eq!(
            names(&collect(&[file], &WalkOptions::default()).expect("walks")),
            ["a.json"]
        );
    }

    #[test]
    fn a_directory_is_walked_in_a_stable_order() {
        let tree = TempTree::new("walk-order");
        for name in ["z.json", "a.json", "m.json"] {
            tree.write(name, "{}");
        }
        let first = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        let again = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert_eq!(names(&first), ["a.json", "m.json", "z.json"]);
        assert_eq!(first.files, again.files);
    }

    /// Every text file, whatever its extension. A hardcoded constant is
    /// as likely to sit in a `.sql` or a `.ts` as in a config.
    #[test]
    fn files_of_every_extension_are_walked() {
        let tree = TempTree::new("walk-any");
        for name in ["a.json", "b.ts", "c.py", "Makefile"] {
            tree.write(name, "x");
        }
        let walked = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert_eq!(walked.files.len(), 4);
    }

    #[test]
    fn ignored_files_are_skipped() {
        let tree = TempTree::new("walk-ignore");
        tree.mkdir(".git");
        tree.write(".gitignore", "ignored.ts\n");
        tree.write("ignored.ts", "const a = 1;");
        tree.write("kept.ts", "const b = 2;");

        let walked = collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert!(names(&walked).contains(&"kept.ts".to_string()));
        assert!(!names(&walked).contains(&"ignored.ts".to_string()));
    }

    #[test]
    fn ignored_files_are_read_on_request() {
        let tree = TempTree::new("walk-noignore");
        tree.mkdir(".git");
        tree.write(".gitignore", "ignored.ts\n");
        tree.write("ignored.ts", "const a = 1;");

        let walked = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                respect_ignore: false,
                ..WalkOptions::default()
            },
        )
        .expect("walks");
        assert!(names(&walked).contains(&"ignored.ts".to_string()));
    }

    #[test]
    fn hidden_files_are_read_on_request() {
        let tree = TempTree::new("walk-hidden");
        tree.write(".hidden.json", "{}");
        let default =
            collect(&[tree.path().to_path_buf()], &WalkOptions::default()).expect("walks");
        assert!(default.files.is_empty());

        let all = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                hidden: true,
                ..WalkOptions::default()
            },
        )
        .expect("walks");
        assert_eq!(names(&all), [".hidden.json"]);
    }

    /// Intent beats configuration: naming a file is asking for it.
    #[test]
    fn an_explicitly_named_file_beats_the_ignore_rules() {
        let tree = TempTree::new("walk-explicit");
        tree.mkdir(".git");
        tree.write(".gitignore", ".hidden.json\n");
        let file = tree.write(".hidden.json", "{}");
        let walked = collect(&[file], &WalkOptions::default()).expect("walks");
        assert_eq!(names(&walked), [".hidden.json"]);
    }

    #[test]
    fn a_missing_input_is_refused_by_name() {
        let tree = TempTree::new("walk-missing");
        let error =
            collect(&[tree.path().join("nope")], &WalkOptions::default()).expect_err("a refusal");
        assert!(error.contains("nope"), "{error}");
    }

    #[test]
    fn the_same_file_named_twice_is_read_once() {
        let tree = TempTree::new("walk-dedupe");
        let file = tree.write("a.json", "{}");
        let walked = collect(&[file.clone(), file], &WalkOptions::default()).expect("walks");
        assert_eq!(walked.files.len(), 1);
    }

    /// The regression the `hazards` job exists to keep out. A directory
    /// the filesystem refuses used to abort the whole walk: exit 2, no
    /// reports at all, so an audit of ten thousand files answered
    /// nothing because one of them was locked.
    ///
    /// Unix only: Windows has no equivalent of mode 000 that a test can
    /// set without a privileged operation, and the walk's error path is
    /// the same code either way.
    #[cfg(unix)]
    #[test]
    fn a_directory_the_filesystem_refuses_is_carried_not_fatal() {
        use std::os::unix::fs::PermissionsExt;

        let tree = TempTree::new("walk-refused");
        tree.write("kept.json", "{\"a\":1}");
        let locked = tree.mkdir("locked");
        tree.write("locked/inner.json", "{\"b\":2}");
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000))
            .expect("a locked directory");

        // Root reads a mode-000 directory regardless, so there would be
        // nothing to refuse and nothing to assert.
        let refused = std::fs::read_dir(&locked).is_err();
        let walked = collect(&[tree.path().to_path_buf()], &WalkOptions::default());
        let _ = std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755));

        let walked = walked.expect("an unreadable entry is not a refusal of the whole walk");
        assert!(
            names(&walked).contains(&"kept.json".to_string()),
            "the rest of the tree is still walked"
        );
        if !refused {
            eprintln!(
                "SKIPPED a_directory_the_filesystem_refuses_is_carried_not_fatal: \
                 this user reads a mode-000 directory"
            );
            return;
        }
        assert_eq!(walked.unreadable.len(), 1, "{:?}", walked.unreadable);
        assert_eq!(walked.unreadable[0].0, locked);
    }
}
