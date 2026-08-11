//! Printing a number the way JavaScript prints it.
//!
//! **This is the contract, not a detail.** Everything this tool outputs
//! is a number rendered as text, and JavaScript and Rust render the same
//! IEEE-754 double differently:
//!
//! | value | JavaScript | Rust `{}` |
//! |---|---|---|
//! | `1e21` | `1e+21` | `1000000000000000000000` |
//! | `1e-7` | `1e-7` | `0.0000001` |
//! | `-0` | `0` | `-0` |
//!
//! So this implements ECMAScript's `Number::toString` (§6.1.6.1.20)
//! rather than reaching for `{}`: shortest round-trip digits, decimal
//! notation while the exponent stays in range, exponential with an
//! explicit sign outside it. The corpus pins both boundaries.
//!
//! Rust's `{}` already gives the *shortest round-trip* digits, which is
//! the hard half and the half both languages agree on. What is left is
//! deciding the notation and reshaping the digits, and that is all this
//! module does.

/// Render `value` as JavaScript's `String(value)` would.
///
/// Non-finite values never reach here — the numeric policy rejects them
/// before extraction — but a total function is easier to reason about
/// than one with a precondition, so they are spelled out.
pub(crate) fn js_number(value: f64) -> String {
    if value.is_nan() {
        return "NaN".to_string();
    }
    if value.is_infinite() {
        return if value < 0.0 { "-Infinity" } else { "Infinity" }.to_string();
    }
    // `-0` prints as `0` in JavaScript, and Rust's `{}` keeps the sign.
    // A minus in front of a zero in an audit is a reader's wasted minute.
    if value == 0.0 {
        return "0".to_string();
    }

    let (digits, exponent) = shortest_digits(value);
    let sign = if value < 0.0 { "-" } else { "" };
    format!("{sign}{}", place(&digits, exponent))
}

/// The shortest round-trip decimal digits, and the power of ten the
/// first digit sits at.
///
/// `1234.5` gives `("12345", 4)`: four digits before the point.
/// ECMAScript calls this `k` digits with exponent `n`, and every branch
/// below is written in those terms so it can be read against the spec.
fn shortest_digits(value: f64) -> (String, i32) {
    // `{:e}` gives shortest round-trip digits in the form `d.dddde±dd`,
    // which is exactly the decomposition needed and saves reimplementing
    // Grisu or Ryū.
    let formatted = format!("{:e}", value.abs());
    let (mantissa, exponent) = formatted
        .split_once('e')
        .expect("Rust's {:e} always writes an exponent");
    let exponent: i32 = exponent.parse().expect("a decimal exponent");
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let digits = digits.trim_end_matches('0');
    let digits = if digits.is_empty() { "0" } else { digits };
    // `n` in the spec: the position of the decimal point relative to the
    // first digit, so `1.5e0` has one digit before the point.
    (digits.to_string(), exponent + 1)
}

/// Place the decimal point, choosing notation the way the spec does.
fn place(digits: &str, n: i32) -> String {
    let k = i32::try_from(digits.len()).expect("a double has at most 17 digits");

    // 21 and -6 are the spec's own boundaries, and they are why `1e20`
    // prints in full and `1e21` does not.
    if (k..=21).contains(&n) {
        // All digits before the point, then zeros out to it.
        let zeros = "0".repeat(usize::try_from(n - k).expect("n >= k in this branch"));
        return format!("{digits}{zeros}");
    }
    if (1..=21).contains(&n) {
        // The point falls inside the digits.
        let (before, after) = digits.split_at(usize::try_from(n).expect("n >= 1 here"));
        return format!("{before}.{after}");
    }
    if (-5..1).contains(&n) {
        // Leading `0.` and then the zeros the exponent asks for.
        let zeros = "0".repeat(usize::try_from(-n).expect("n <= 0 in this branch"));
        return format!("0.{zeros}{digits}");
    }

    // Exponential. The sign is always written, which is the difference
    // from Rust's `{:e}` and from most other languages.
    let sign = if n > 0 { "+" } else { "-" };
    let magnitude = (n - 1).abs();
    if k == 1 {
        return format!("{digits}e{sign}{magnitude}");
    }
    let (first, rest) = digits.split_at(1);
    format!("{first}.{rest}e{sign}{magnitude}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_numbers_print_without_a_point() {
        assert_eq!(js_number(1.0), "1");
        assert_eq!(js_number(100.0), "100");
        assert_eq!(js_number(8080.0), "8080");
        assert_eq!(js_number(-325.0), "-325");
    }

    #[test]
    fn fractions_keep_their_digits() {
        assert_eq!(js_number(1.5), "1.5");
        assert_eq!(js_number(0.1), "0.1");
        assert_eq!(js_number(0.0825), "0.0825");
        assert_eq!(js_number(2.5), "2.5");
    }

    /// Negative zero is a real double and a distraction in a report.
    #[test]
    fn negative_zero_prints_as_zero() {
        assert_eq!(js_number(-0.0), "0");
        assert_eq!(js_number(0.0), "0");
    }

    /// The upper boundary. `1e20` is written out in full and `1e21` is
    /// not, and there is no rounder reason than the spec saying 21.
    #[test]
    fn the_upper_boundary_is_where_the_spec_puts_it() {
        assert_eq!(js_number(1e20), "100000000000000000000");
        assert_eq!(js_number(1e21), "1e+21");
        assert_eq!(
            js_number(123_456_789_012_345_680_000.0),
            "123456789012345680000"
        );
    }

    /// The lower boundary, in both directions.
    #[test]
    fn the_lower_boundary_is_where_the_spec_puts_it() {
        assert_eq!(js_number(1e-6), "0.000001");
        assert_eq!(js_number(9.999e-7), "9.999e-7");
        assert_eq!(js_number(1e-7), "1e-7");
    }

    /// The exponent always carries its sign, which `{:e}` does not do.
    #[test]
    fn an_exponent_is_always_signed() {
        assert_eq!(js_number(1e21), "1e+21");
        assert_eq!(js_number(2.5e-10), "2.5e-10");
        assert_eq!(
            js_number(1.797_693_134_862_315_7e308),
            "1.7976931348623157e+308"
        );
        assert_eq!(js_number(5e-324), "5e-324");
    }

    #[test]
    fn the_sign_comes_before_everything() {
        assert_eq!(js_number(-1.5), "-1.5");
        assert_eq!(js_number(-1e21), "-1e+21");
        assert_eq!(js_number(-1e-7), "-1e-7");
    }

    /// Shortest round-trip means the digits that read back as the same
    /// double and no more — `0.1 + 0.2` is the canonical demonstration.
    #[test]
    fn digits_are_the_shortest_that_round_trip() {
        assert_eq!(js_number(0.1 + 0.2), "0.30000000000000004");
        assert_eq!(js_number(1.0 / 3.0), "0.3333333333333333");
    }

    /// Whatever it prints must parse back to the same double, or the
    /// report is lossy in a way no reader could detect.
    #[test]
    fn every_rendering_round_trips() {
        for value in [
            0.0,
            1.0,
            -1.5,
            0.0825,
            1e-7,
            5e-324,
            1e21,
            1e20,
            2.5e-10,
            1.797_693_134_862_315_7e308,
            0.1 + 0.2,
            123_456.789,
        ] {
            let printed = js_number(value);
            let parsed: f64 = printed.parse().expect(&printed);
            assert_eq!(parsed, value, "{printed}");
        }
    }
}
