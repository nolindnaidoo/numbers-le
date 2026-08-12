//! Which extractor reads a document.
//!
//! **An unresolved format is not an error.** Every other crate in this
//! family refuses a name it does not recognise; this one falls through
//! to a plain-text scan, because that is what the extension does and
//! because it is the case that matters most. A Markdown file is not a
//! format this parses, and its numbers are still numbers a reviewer came
//! for.
//!
//! The twelve source languages are here for the opposite reason: a `.rs`
//! file *was* a text scan, and a text scan reads `u32` as the number 32.
//! They resolve to their own names rather than to one `source` key
//! because a dialect changes an answer — `0755` is 493 in Go and 755 in
//! Rust — and because the name is user-visible as `fileType` in every
//! MCP reply.

/// Every name a caller might send, mapped to the extractor key it means.
/// Ported from the extension's `ALIASES` rather than re-derived: two
/// frontends disagreeing about whether `conf` is INI is two frontends
/// reading the same file differently.
///
/// Both a VS Code `languageId` and a file extension appear here, because
/// the extension resolves by the first and this crate by the second.
const ALIASES: [(&str, &str); 43] = [
    ("json", "json"),
    ("jsonc", "json"),
    ("yaml", "yaml"),
    ("yml", "yaml"),
    ("csv", "csv"),
    ("tsv", "csv"),
    ("toml", "toml"),
    ("ini", "ini"),
    ("cfg", "ini"),
    ("conf", "ini"),
    ("env", "env"),
    ("dotenv", "env"),
    ("python", "python"),
    ("py", "python"),
    ("rust", "rust"),
    ("rs", "rust"),
    ("go", "go"),
    ("java", "java"),
    ("kotlin", "kotlin"),
    ("kt", "kotlin"),
    ("kts", "kotlin"),
    ("csharp", "csharp"),
    ("cs", "csharp"),
    ("cpp", "cpp"),
    ("cc", "cpp"),
    ("cxx", "cpp"),
    ("hpp", "cpp"),
    ("hh", "cpp"),
    ("c", "c"),
    ("h", "c"),
    ("javascript", "javascript"),
    ("js", "javascript"),
    ("mjs", "javascript"),
    ("cjs", "javascript"),
    ("javascriptreact", "javascript"),
    ("jsx", "javascript"),
    ("typescript", "typescript"),
    ("ts", "typescript"),
    ("typescriptreact", "typescript"),
    ("tsx", "typescript"),
    ("sql", "sql"),
    ("shellscript", "shellscript"),
    ("sh", "shellscript"),
];

/// The formats a caller can name, for the tool schema's enum. Held equal
/// to the alias table by a test, so a format can never be offered and
/// then not resolve.
pub(crate) const SUPPORTED_FORMATS: [&str; 18] = [
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

/// The keys `source.rs` reads. Everything else is a parser or the
/// plain-text scan.
const SOURCE_FORMATS: [&str; 12] = [
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

/// Whether a resolved key is a source language.
pub(crate) fn is_source(format: &str) -> bool {
    SOURCE_FORMATS.contains(&format)
}

/// What the engine uses when it recognises nothing.
///
/// **`unknown`, not `fallback`.** The extension names it that and the
/// name is user-visible: it is the `fileType` every MCP answer carries,
/// so the two servers would disagree on a field that is right there in
/// the response. The corpus caught it on the first run.
pub(crate) const FALLBACK_FORMAT: &str = "unknown";

fn normalise(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .trim_start_matches('.')
        .to_string()
}

/// The extractor key for an already-canonical format name, or
/// `fallback`. Used on the hot path, where the caller has resolved once.
pub(crate) fn canonical(format: &str) -> &'static str {
    ALIASES
        .iter()
        .find(|(alias, _)| *alias == format)
        .map_or(FALLBACK_FORMAT, |(_, key)| *key)
}

/// Resolve an extractor key from an explicit format, else from a
/// filename, else `fallback`.
///
/// A caller who knows nothing about a document still gets its strings —
/// which is the difference between a tool a reviewer can point at a
/// repository and one they have to describe it to first.
pub(crate) fn resolve_format(format: Option<&str>, filename: Option<&str>) -> &'static str {
    if let Some(name) = format {
        let direct = canonical(&normalise(name));
        if direct != FALLBACK_FORMAT {
            return direct;
        }
    }

    let Some(filename) = filename else {
        return FALLBACK_FORMAT;
    };

    // A dotfile like `.env` has no extension to split on; its whole name
    // is the type.
    let whole = canonical(&normalise(filename));
    if whole != FALLBACK_FORMAT {
        return whole;
    }

    filename
        .rsplit_once('.')
        .map_or(FALLBACK_FORMAT, |(_, extension)| {
            canonical(&normalise(extension))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_offered_format_resolves_to_itself() {
        for format in SUPPORTED_FORMATS {
            assert_eq!(resolve_format(Some(format), None), format, "{format}");
        }
    }

    #[test]
    fn the_extensions_aliases_are_honoured() {
        for (alias, expected) in [
            ("jsonc", "json"),
            ("yml", "yaml"),
            ("tsv", "csv"),
            ("cfg", "ini"),
            ("conf", "ini"),
            ("dotenv", "env"),
        ] {
            assert_eq!(resolve_format(Some(alias), None), expected, "{alias}");
        }
    }

    #[test]
    fn a_name_is_normalised_before_it_is_matched() {
        assert_eq!(resolve_format(Some("  JSON "), None), "json");
        assert_eq!(resolve_format(Some(".toml"), None), "toml");
    }

    #[test]
    fn a_filename_supplies_the_format_when_none_is_named() {
        assert_eq!(resolve_format(None, Some("config.toml")), "toml");
        assert_eq!(resolve_format(None, Some("data.CSV")), "csv");
    }

    /// A dotfile is its own extension.
    #[test]
    fn a_dotfile_resolves_by_its_whole_name() {
        assert_eq!(resolve_format(None, Some(".env")), "env");
        assert_eq!(resolve_format(None, Some("env")), "env");
    }

    /// The property the audit story rests on. Not a refusal, not an
    /// empty result — the plain-text scan, which is what reads a
    /// Markdown file or a log.
    #[test]
    fn anything_unrecognised_falls_back() {
        for name in ["markdown", "dockerfile", "", "wat"] {
            assert_eq!(resolve_format(Some(name), None), FALLBACK_FORMAT, "{name}");
        }
        assert_eq!(resolve_format(None, Some("README.md")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, Some("Makefile")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, None), FALLBACK_FORMAT);
    }

    /// Changed deliberately in 0.2.0: a source file used to land in the
    /// text scan, which read `u32` as the number 32.
    #[test]
    fn a_source_language_resolves_to_its_own_extractor() {
        for (name, expected) in [
            ("main.rs", "rust"),
            ("app.py", "python"),
            ("main.go", "go"),
            ("Widget.tsx", "typescript"),
            ("index.mjs", "javascript"),
            ("Main.java", "java"),
            ("query.sql", "sql"),
            ("deploy.sh", "shellscript"),
            ("engine.hpp", "cpp"),
            ("port.h", "c"),
        ] {
            assert_eq!(resolve_format(None, Some(name)), expected, "{name}");
        }
        assert_eq!(resolve_format(Some("typescriptreact"), None), "typescript");
    }

    /// Every source key routes to `source.rs`, and nothing else does.
    #[test]
    fn the_source_list_matches_the_formats_that_are_source_languages() {
        for format in SOURCE_FORMATS {
            assert!(is_source(format), "{format}");
            assert!(
                SUPPORTED_FORMATS.contains(&format),
                "{format} is a source key but is not offered"
            );
        }
        for format in ["json", "yaml", "csv", "toml", "ini", "env", FALLBACK_FORMAT] {
            assert!(!is_source(format), "{format}");
        }
    }

    /// An explicit format that resolves to nothing still lets the
    /// filename answer, rather than the bad name poisoning the lookup.
    #[test]
    fn an_unresolved_format_defers_to_the_filename() {
        assert_eq!(resolve_format(Some("nonsense"), Some("a.toml")), "toml");
    }

    #[test]
    fn the_offered_list_matches_the_alias_table() {
        for format in SUPPORTED_FORMATS {
            assert!(
                ALIASES.iter().any(|(_, key)| *key == format),
                "{format} is offered but no alias produces it"
            );
        }
        for (_, key) in ALIASES {
            assert!(
                SUPPORTED_FORMATS.contains(&key),
                "{key} is produced but not offered"
            );
        }
    }
}
