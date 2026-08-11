//! Numbers in free-form text, for a format nothing here parses.
//!
//! **It has no grammar, and that shows.** `v1.2.3` reads as `1.2` and
//! `0.3`, because a scan with no parser cannot know a version string is
//! one token. That is what the extension does and it is why the fallback
//! is used only when the format is unknown — the honest answer for an
//! unknown format is "here is every numeric-looking run", not a guess at
//! which of them were meant.

use std::sync::LazyLock;

use regex::Regex;

/// The extension's `TEXT_NUMBER_RE`: optional sign, digits, optional
/// point, optional exponent.
static TEXT_NUMBER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")
        .expect("a constant pattern compiles")
});

pub(crate) fn extract(text: &str) -> Vec<f64> {
    spanned(text).into_iter().map(|(value, _)| value).collect()
}

/// The numbers, each with the byte offset of the run that produced it.
/// A scan already knows where it matched, so the fallback places its
/// values for free.
pub(crate) fn spanned(text: &str) -> Vec<(f64, usize)> {
    TEXT_NUMBER
        .find_iter(text)
        .filter_map(|found| {
            found
                .as_str()
                .parse::<f64>()
                .ok()
                .filter(|value| value.is_finite())
                .map(|value| (value, found.start()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_numbers_are_found() {
        assert_eq!(extract("rate 0.0825 on 1000 units"), [0.0825, 1000.0]);
    }

    #[test]
    fn signs_and_exponents_are_read() {
        assert_eq!(extract("offset -7e2 and +3"), [-700.0, 3.0]);
    }

    /// Ported behaviour, not an oversight. Written down because it is
    /// the first thing anyone will report as a bug.
    #[test]
    fn a_version_string_has_no_grammar_to_protect_it() {
        assert_eq!(extract("v1.2.3"), [1.2, 0.3]);
        assert_eq!(extract("3.16.15"), [3.16, 0.15]);
    }

    #[test]
    fn text_without_numbers_yields_nothing() {
        assert!(extract("no numbers on this line at all").is_empty());
    }

    #[test]
    fn a_span_points_at_the_run() {
        let text = "rate 0.0825 here";
        let (value, offset) = spanned(text)[0];
        assert_eq!(value, 0.0825);
        assert_eq!(&text[offset..offset + 6], "0.0825");
    }

    /// An overflowing literal is infinity, and infinity is not a number
    /// this tool emits.
    #[test]
    fn an_overflowing_run_is_dropped() {
        assert!(extract("1e400").is_empty());
    }
}
