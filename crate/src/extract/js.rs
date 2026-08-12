//! JavaScript's string primitives, where Rust's differ.
//!
//! The extension calls `String.prototype.trim` in the numeric policy and
//! in every extractor that reads an untyped value. That does not mean
//! what `str::trim` means: JavaScript's whitespace set includes U+FEFF,
//! which Unicode's `White_Space` property does not, and excludes U+0085,
//! which it does.
//!
//! **Reachable, not theoretical.** A byte-order mark is what Notepad,
//! Excel and a PowerShell redirect all add, and this crate's coercion
//! rules key off a resolved format: a `format` argument carrying one
//! resolved to `json` on the extension and fell through to the text scan
//! here, so the two servers disagreed about whether a quoted `"42"` was
//! a number. The same character led a CSV cell to being a number on one
//! side and not the other.
//!
//! Defining the set once, and testing both differences from Rust by
//! name, is what keeps a later "simplification" to `str::trim` loud.

/// Every character JavaScript treats as whitespace: `WhiteSpace` plus
/// `LineTerminator` from the language spec.
pub(crate) const JS_WHITESPACE: [char; 25] = [
    '\u{9}',    // tab
    '\u{a}',    // line feed
    '\u{b}',    // vertical tab
    '\u{c}',    // form feed
    '\u{d}',    // carriage return
    '\u{20}',   // space
    '\u{a0}',   // no-break space
    '\u{1680}', // ogham space mark
    '\u{2000}', '\u{2001}', '\u{2002}', '\u{2003}', '\u{2004}', '\u{2005}', '\u{2006}', '\u{2007}',
    '\u{2008}', '\u{2009}', '\u{200a}', '\u{2028}', // line separator
    '\u{2029}', // paragraph separator
    '\u{202f}', '\u{205f}', '\u{3000}', '\u{feff}', // zero-width no-break space
];

pub(crate) fn is_js_whitespace(c: char) -> bool {
    JS_WHITESPACE.contains(&c)
}

pub(crate) fn trim(value: &str) -> &str {
    value.trim_matches(is_js_whitespace)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The two differences from Rust's own notion of whitespace, stated
    /// as tests so a future simplification to `str::trim` fails loudly.
    #[test]
    fn a_byte_order_mark_is_whitespace_here_and_not_in_rust() {
        assert!(is_js_whitespace('\u{feff}'));
        assert!(!'\u{feff}'.is_whitespace());
        assert_eq!(trim("\u{feff}42\u{feff}"), "42");
    }

    #[test]
    fn a_next_line_character_is_whitespace_in_rust_and_not_here() {
        assert!(!is_js_whitespace('\u{85}'));
        assert!('\u{85}'.is_whitespace());
        assert_eq!(trim("\u{85}42"), "\u{85}42");
        assert_eq!(trim("42\u{85}"), "42\u{85}");
    }

    /// Everything else agrees, and it is worth knowing that it does:
    /// this set is only useful if it is Rust's plus one and minus one.
    #[test]
    fn every_other_character_agrees_with_rusts_whitespace() {
        for c in JS_WHITESPACE {
            assert_eq!(
                c.is_whitespace(),
                c != '\u{feff}',
                "{c:?} is in JavaScript's set and Rust disagrees"
            );
        }
        for code in 0u32..=0xffff {
            let Some(c) = char::from_u32(code) else {
                continue;
            };
            if c.is_whitespace() {
                assert_eq!(
                    is_js_whitespace(c),
                    c != '\u{85}',
                    "{c:?} is whitespace in Rust and missing here"
                );
            }
        }
    }

    #[test]
    fn trimming_matches_the_ordinary_cases() {
        assert_eq!(trim("  42 7  "), "42 7");
        assert_eq!(trim(""), "");
        assert_eq!(trim(" \t\n "), "");
        assert_eq!(trim("42"), "42");
    }
}
