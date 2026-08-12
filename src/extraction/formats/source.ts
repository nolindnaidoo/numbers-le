/**
 * Numeric literals in a source language.
 *
 * The plain-text scan in heuristics.ts has no concept of a literal, and
 * on a source file that is not a near miss — it splits on the first
 * character that is not a digit. `0o755` came back as `0` and `755`,
 * `1_000_000` as `1`, `0`, `0`, and — worst of all — `u32` and `i64`
 * came back as `32` and `64`. A Rust file yielded numbers that were
 * never in it, which is the one failure an audit tool cannot have.
 *
 * Two rules do most of the work here:
 *
 * - **A literal never begins inside a word.** That single boundary check
 *   is what makes `u32` a type name again, and it takes `sha256`,
 *   `utf8`, `float32` and `int64` with it.
 * - **A literal is consumed whole, suffix included.** `10u32` is one
 *   number, so the scan resumes after the suffix rather than finding
 *   `32` inside it.
 *
 * It reads comments and strings too, deliberately. A number written in a
 * comment is still a number in the file, and the reviewer this tool
 * serves is checking constants against a specification — a threshold
 * quoted in a docstring is exactly as interesting as one in an
 * expression. Skipping either would need a per-language lexer, which is
 * a different product.
 *
 * The Rust CLI reads the same grammar in crate/src/extract/source.rs and
 * crate/fixtures/ holds both to it.
 */

import type {
	ExtractionResult,
	Notation,
	NumberFinding,
	SourceLanguage,
} from '../../types';

/** The three ways a language changes what a literal means. */
type Dialect = Readonly<{
	/**
	 * What a language puts between digit groups: `_` for most of them,
	 * `'` for C++14 and the headers C shares with it, nothing for SQL and
	 * shell.
	 */
	separator: string | undefined;
	/**
	 * A leading `0` makes the rest octal. This is a value fork, not a
	 * notation one: `0755` is 493 in C, C++, Go and Java, and 755 in
	 * Rust, Python 3, Kotlin and C#. Reading it wrong reports a number
	 * the file does not contain.
	 */
	legacyOctal: boolean;
	/** `123n`. */
	bigint: boolean;
}>;

const PLAIN: Dialect = Object.freeze({
	separator: undefined,
	legacyOctal: false,
	bigint: false,
});

const DIALECTS: Readonly<Record<string, Dialect>> = Object.freeze({
	python: { separator: '_', legacyOctal: false, bigint: false },
	rust: { separator: '_', legacyOctal: false, bigint: false },
	kotlin: { separator: '_', legacyOctal: false, bigint: false },
	csharp: { separator: '_', legacyOctal: false, bigint: false },
	go: { separator: '_', legacyOctal: true, bigint: false },
	java: { separator: '_', legacyOctal: true, bigint: false },
	// Legacy octal is a syntax error in a module and this reads modern
	// sources, so `0755` here is the digits it looks like.
	javascript: { separator: '_', legacyOctal: false, bigint: true },
	typescript: { separator: '_', legacyOctal: false, bigint: true },
	c: { separator: "'", legacyOctal: true, bigint: false },
	cpp: { separator: "'", legacyOctal: true, bigint: false },
	// SQL and shell have no separator and no base prefix of their own;
	// hex is still read, because `0xFF` means the same in both.
	sql: PLAIN,
	shellscript: PLAIN,
});

export function extractFromSource(
	text: string,
	language: SourceLanguage,
): ExtractionResult {
	return {
		success: true,
		numbers: scanSourceForNumbers(text, language),
		errors: Object.freeze([]),
	};
}

export function scanSourceForNumbers(
	text: string,
	language: string,
): readonly NumberFinding[] {
	const dialect = DIALECTS[language] ?? PLAIN;
	const found: NumberFinding[] = [];
	let at = 0;

	while (at < text.length) {
		const token = tokenAt(text, at, dialect);
		if (token === undefined) {
			at += 1;
			continue;
		}
		if (token.finding !== undefined) found.push(token.finding);
		at = token.end;
	}
	return Object.freeze(found);
}

type Token = Readonly<{
	/**
	 * Absent for a literal-shaped run this tool will not report: one that
	 * overflows to infinity, and one whose base-prefixed digits do not
	 * fit 128 bits. The run is still consumed, so the scan cannot
	 * re-enter it and report the digits inside.
	 */
	finding: NumberFinding | undefined;
	end: number;
}>;

function tokenAt(
	text: string,
	start: number,
	dialect: Dialect,
): Token | undefined {
	const here = text.charAt(start);
	const signed = here === '+' || here === '-';
	if (signed && !signMayBegin(text, start)) return undefined;

	const body = signed ? start + 1 : start;
	if (!bodyMayBegin(text, body)) return undefined;

	const read = readBody(text, body, dialect);
	if (read === undefined) return undefined;

	if (read.value === undefined) return { finding: undefined, end: read.end };

	const negative = signed && here === '-';
	const value = negative ? -read.value : read.value;
	if (!Number.isFinite(value)) return { finding: undefined, end: read.end };
	return { finding: { value, notation: read.notation }, end: read.end };
}

/**
 * Whether a character belongs to a word.
 *
 * Anything above ASCII counts, so `café1` is one identifier rather than
 * a word and the number 1.
 */
function isWord(char: string): boolean {
	if (char.length === 0) return false;
	return /[A-Za-z0-9_$]/.test(char) || char.charCodeAt(0) >= 0x80;
}

/**
 * A sign is part of a literal only where nothing can sit to its left:
 * `x = -1` is negative one, `a-1` is a subtraction and yields 1.
 */
function signMayBegin(text: string, at: number): boolean {
	if (at === 0) return true;
	const previous = text.charAt(at - 1);
	return !isWord(previous) && previous !== ')' && previous !== ']';
}

function bodyMayBegin(text: string, at: number): boolean {
	const char = text.charAt(at);
	if (isDigitOf(char, 10)) return digitMayBegin(text, at);
	if (char !== '.') return false;
	return isDigitOf(text.charAt(at + 1), 10) && pointMayBegin(text, at);
}

/**
 * The boundary rule, and the reason this module exists: `u32` is a type
 * and `sha256` is a name.
 *
 * A digit behind a point is refused too when that point follows a value
 * — `t.0` is a tuple index and the `3` of `1.2.3` is the tail of a
 * version, not a third number.
 */
function digitMayBegin(text: string, at: number): boolean {
	if (at === 0) return true;
	const previous = text.charAt(at - 1);
	if (isWord(previous)) return false;
	if (previous !== '.') return true;
	if (at < 2) return true;
	const before = text.charAt(at - 2);
	return !isWord(before) && before !== ')' && before !== ']';
}

/** `.5` is a literal; the `.5` of `x.5`, `f().5` and `1..5` is not. */
function pointMayBegin(text: string, at: number): boolean {
	if (at === 0) return true;
	const previous = text.charAt(at - 1);
	return (
		!isWord(previous) &&
		previous !== ')' &&
		previous !== ']' &&
		previous !== '.'
	);
}

type Body = Readonly<{
	value: number | undefined;
	notation: Notation;
	end: number;
}>;

function readBody(
	text: string,
	at: number,
	dialect: Dialect,
): Body | undefined {
	return readPrefixed(text, at, dialect) ?? readDecimal(text, at, dialect);
}

/** `0xFF`, `0b1010`, `0o755` — the bases that announce themselves. */
function readPrefixed(
	text: string,
	at: number,
	dialect: Dialect,
): Body | undefined {
	if (text.charAt(at) !== '0') return undefined;
	const base = BASES[text.charAt(at + 1).toLowerCase()];
	if (base === undefined) return undefined;

	const [radix, notation] = base;
	const digits = readDigits(text, at + 2, radix, dialect);
	if (digits.digits.length === 0) return undefined;

	const end = readSuffix(text, digits.end).end;
	return { value: fromRadix(digits.digits, radix), notation, end };
}

function readDecimal(
	text: string,
	at: number,
	dialect: Dialect,
): Body | undefined {
	const integer = readDigits(text, at, 10, dialect);
	let token = integer.digits;
	let end = integer.end;
	let notation: Notation =
		dialect.legacyOctal && isLegacyOctal(token) ? 'octal' : 'decimal';

	// The point is only part of the literal when a digit follows it, so
	// `1..5` stays a range and `1.max(2)` stays a method call.
	if (text.charAt(end) === '.' && isDigitOf(text.charAt(end + 1), 10)) {
		const fraction = readDigits(text, end + 1, 10, dialect);
		token = `${token}.${fraction.digits}`;
		end = fraction.end;
		notation = 'decimal';
	}

	if (token.length === 0) return undefined;

	const exponent = readExponent(text, end, dialect);
	if (exponent !== undefined) {
		token += exponent.text;
		end = exponent.end;
		notation = 'scientific';
	}

	const suffix = readSuffix(text, end);
	if (dialect.bigint && suffix.text === 'n' && notation === 'decimal') {
		notation = 'bigint';
	}

	const value =
		notation === 'octal' ? fromRadix(token, 8) : parseDecimal(token);
	return { value, notation, end: suffix.end };
}

/**
 * A leading zero followed only by octal digits. `0` alone is zero, and
 * `08` is not octal in any of these languages.
 */
function isLegacyOctal(digits: string): boolean {
	return digits.length > 1 && /^0[0-7]+$/.test(digits);
}

/**
 * Digits of one base, with the dialect's separators removed.
 *
 * A separator counts only when a digit follows it, which is what leaves
 * the `_f64` of `3.14_f64` to be read as the suffix it is.
 */
function readDigits(
	text: string,
	from: number,
	radix: number,
	dialect: Dialect,
): Readonly<{ digits: string; end: number }> {
	let digits = '';
	let at = from;

	while (at < text.length) {
		const char = text.charAt(at);
		if (isDigitOf(char, radix)) {
			digits += char;
			at += 1;
			continue;
		}
		const separates =
			char === dialect.separator && isDigitOf(text.charAt(at + 1), radix);
		if (!separates) break;
		at += 1;
	}
	return { digits, end: at };
}

/** Mirrors Rust's `char::is_digit`, which accepts ASCII only. */
function isDigitOf(char: string, radix: number): boolean {
	const code = char.charCodeAt(0);
	if (code >= 48 && code <= 57) return code - 48 < radix;
	if (code >= 97 && code <= 122) return code - 97 + 10 < radix;
	if (code >= 65 && code <= 90) return code - 65 + 10 < radix;
	return false;
}

/**
 * `e`, an optional sign, and at least one digit. Anything less is not an
 * exponent — the `e` of `1exp` belongs to the suffix.
 */
function readExponent(
	text: string,
	at: number,
	dialect: Dialect,
): Readonly<{ text: string; end: number }> | undefined {
	const marker = text.charAt(at);
	if (marker !== 'e' && marker !== 'E') return undefined;
	const signChar = text.charAt(at + 1);
	const signed = signChar === '+' || signChar === '-';
	const digits = readDigits(text, signed ? at + 2 : at + 1, 10, dialect);
	if (digits.digits.length === 0) return undefined;
	return {
		text: `e${signed ? signChar : ''}${digits.digits}`,
		end: digits.end,
	};
}

/**
 * The trailing identifier: `u32`, `L`, `f64`, `n`, `_f32`.
 *
 * Consuming it is half the fix — without it the scan resumes inside the
 * suffix and reports the `32` of `10u32`.
 */
function readSuffix(
	text: string,
	from: number,
): Readonly<{ text: string; end: number }> {
	let at = from;
	while (at < text.length && /[A-Za-z0-9_$]/.test(text.charAt(at))) at += 1;
	return { text: text.slice(from, at), end: at };
}

/**
 * A base-prefixed literal is an integer, so it is read as one. Past 128
 * bits there is no reader here that agrees with the crate's, and
 * guessing a double is worse than reporting nothing.
 */
function fromRadix(digits: string, radix: number): number | undefined {
	const value = BigInt(`${PREFIX[radix]}${digits}`);
	if (value > MAX_128) return undefined;
	return Number(value);
}

const PREFIX: Readonly<Record<number, string>> = Object.freeze({
	2: '0b',
	8: '0o',
	16: '0x',
});

const BASES: Readonly<Record<string, readonly [number, Notation]>> =
	Object.freeze({
		x: [16, 'hex'],
		b: [2, 'binary'],
		o: [8, 'octal'],
	});

const MAX_128 = 2n ** 128n - 1n;

/**
 * `Number()` rather than `parseFloat`, matching the crate's `str::parse`
 * — both are correctly rounded for a token of any length, and the whole
 * output of this tool is a number printed as text.
 */
function parseDecimal(token: string): number | undefined {
	const value = Number(token);
	return Number.isNaN(value) ? undefined : value;
}
