import { describe, expect, it } from 'vitest';
import type { Notation } from '../../types';
import { extractFromSource, scanSourceForNumbers } from './source';

/**
 * The same assertions as `crate/src/extract/source.rs`'s unit tests,
 * case for case.
 *
 * The corpus in `crate/fixtures/` holds the two implementations to the
 * same documents; these hold them to the same *rules*, which is where a
 * dialect fork would diverge without a corpus document to catch it.
 */

function values(text: string, language: string): readonly number[] {
	return scanSourceForNumbers(text, language).map((found) => found.value);
}

function notations(text: string, language: string): readonly Notation[] {
	return scanSourceForNumbers(text, language).map((found) => found.notation);
}

describe('source literals', () => {
	// The regression this module exists for. Under the text scan these
	// reported 32, 64, 32 and 64 — numbers no source file contains.
	it('does not read a type name as a number', () => {
		for (const name of [
			'u32',
			'i64',
			'f32',
			'usize',
			'int64',
			'sha256',
			'utf8',
			'x1',
		]) {
			expect(values(name, 'rust')).toEqual([]);
		}
	});

	it('leaves one number behind a type suffix', () => {
		expect(values('10u32', 'rust')).toEqual([10]);
		expect(values('100L', 'java')).toEqual([100]);
		expect(values('1.5f', 'cpp')).toEqual([1.5]);
		expect(values('2.75_f64', 'rust')).toEqual([2.75]);
		expect(values('1.5e3f64', 'rust')).toEqual([1500]);
	});

	it('reads each base as one number with its own notation', () => {
		expect(values('0xFF', 'rust')).toEqual([255]);
		expect(notations('0xFF', 'rust')).toEqual(['hex']);
		expect(values('0XFF', 'c')).toEqual([255]);
		expect(values('0b1010', 'rust')).toEqual([10]);
		expect(notations('0b1010', 'rust')).toEqual(['binary']);
		expect(values('0o755', 'rust')).toEqual([493]);
		expect(notations('0o755', 'rust')).toEqual(['octal']);
	});

	it('does not split a number on its separator', () => {
		expect(values('1_000_000', 'rust')).toEqual([1000000]);
		expect(values('1_000_000', 'python')).toEqual([1000000]);
		expect(values("1'000'000", 'cpp')).toEqual([1000000]);
		expect(values('0xFF_FF', 'rust')).toEqual([65535]);
	});

	// A separator in a language that has none is not one, so `1_000`
	// there is the number 1 with an identifier stuck to it — and `1'000'`
	// in Python is the number 1 beside a quoted string.
	it('gives the separator to the dialect that has it', () => {
		expect(values('1_000', 'sql')).toEqual([1]);
		expect(values("1'000'", 'python')).toEqual([1, 0]);
	});

	// The value fork. Reading this wrong reports a number the file does
	// not contain, in whichever direction it is wrong.
	it('treats a leading zero as octal only where the language says so', () => {
		for (const language of ['c', 'cpp', 'go', 'java']) {
			expect(values('0755', language)).toEqual([493]);
			expect(notations('0755', language)).toEqual(['octal']);
		}
		for (const language of [
			'rust',
			'python',
			'csharp',
			'kotlin',
			'javascript',
			'sql',
		]) {
			expect(values('0755', language)).toEqual([755]);
			expect(notations('0755', language)).toEqual(['decimal']);
		}
	});

	it('keeps a leading zero decimal when it is not octal', () => {
		expect(values('0', 'go')).toEqual([0]);
		expect(values('08', 'go')).toEqual([8]);
		expect(values('0.5', 'go')).toEqual([0.5]);
	});

	it('reads a bigint as one only in JavaScript', () => {
		expect(values('123n', 'javascript')).toEqual([123]);
		expect(notations('123n', 'javascript')).toEqual(['bigint']);
		expect(notations('123n', 'typescript')).toEqual(['bigint']);
		expect(notations('123n', 'python')).toEqual(['decimal']);
		// A base still wins: the digits are what was written.
		expect(notations('0xFFn', 'javascript')).toEqual(['hex']);
	});

	it('reads an exponent as scientific', () => {
		expect(values('1.5e3', 'python')).toEqual([1500]);
		expect(notations('1.5e3', 'python')).toEqual(['scientific']);
		expect(values('1e-7', 'python')).toEqual([1e-7]);
		expect(values('1E5', 'python')).toEqual([100000]);
	});

	// An `e` with nothing usable after it is a suffix, not an exponent.
	it('gives an incomplete exponent to the suffix', () => {
		expect(values('1exp', 'python')).toEqual([1]);
		expect(values('1e', 'python')).toEqual([1]);
		expect(values('1e+', 'python')).toEqual([1]);
	});

	it('reads a sign only where a value cannot sit', () => {
		expect(values('x = -1', 'rust')).toEqual([-1]);
		expect(values('(-0.5)', 'rust')).toEqual([-0.5]);
		expect(values('+7', 'rust')).toEqual([7]);
		// A subtraction, not a negative number.
		expect(values('a-1', 'rust')).toEqual([1]);
		expect(values('f()-1', 'rust')).toEqual([1]);
		expect(values('xs[0]-1', 'rust')).toEqual([0, 1]);
	});

	// The text scan reads this as 1.2 and 0.3. A grammar knows better.
	it('does not read a version string as two numbers', () => {
		expect(values('v1.2.3', 'python')).toEqual([]);
		expect(values('"1.2.3"', 'python')).toEqual([1.2]);
	});

	it('does not read a field access as a number', () => {
		expect(values('t.0', 'rust')).toEqual([]);
		expect(values('xs[1].0', 'rust')).toEqual([1]);
	});

	it('reads a leading point where nothing precedes it', () => {
		expect(values('x = .5', 'python')).toEqual([0.5]);
		expect(values('[.5]', 'javascript')).toEqual([0.5]);
	});

	// A range is two numbers, not one fraction between them.
	it('keeps both bounds of a range', () => {
		expect(values('0..10', 'rust')).toEqual([0, 10]);
	});

	it('consumes a run whole so the scan cannot re-enter it', () => {
		expect(values('let m: u32 = 0o755;', 'rust')).toEqual([493]);
		expect(values('const BIG: usize = 1_000_000;', 'rust')).toEqual([1000000]);
	});

	it('returns numbers in document order', () => {
		expect(values('a = 1\nb = 0x10\nc = 2.5\n', 'python')).toEqual([
			1, 16, 2.5,
		]);
	});

	// An overflowing literal is infinity, and infinity is not a number
	// this tool emits — but the run is still consumed, so its digits
	// cannot come back as separate numbers.
	it('consumes an overflowing literal without reporting it', () => {
		expect(values('1e400', 'python')).toEqual([]);
		expect(values(`0x${'F'.repeat(40)}`, 'rust')).toEqual([]);
	});

	it('does not read a bare base prefix as a literal', () => {
		expect(values('0x', 'rust')).toEqual([0]);
		expect(values('0xZZ', 'rust')).toEqual([0]);
	});

	it('finds nothing in text without numbers', () => {
		expect(values('fn main() { println!("hello"); }', 'rust')).toEqual([]);
	});

	// A non-ASCII character is part of a word, so an identifier carrying
	// one does not shed a number.
	it('treats a word with a non-ASCII character as still a word', () => {
		expect(values('café1', 'python')).toEqual([]);
	});

	// An unrecognised key still scans, with no dialect extras. The router
	// never sends one, and answering rather than throwing keeps that a
	// routing bug instead of a crash.
	it('reads the universal shapes for an unknown language', () => {
		expect(values('0xFF 1_000 0755', 'wat')).toEqual([255, 1, 755]);
	});

	it('always succeeds — a source scan has no shape it can reject', () => {
		const result = extractFromSource('const MASK = 0xFF;', 'typescript');
		expect(result.success).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.numbers).toEqual([{ value: 255, notation: 'hex' }]);
		expect(Object.isFrozen(result.numbers)).toBe(true);
	});
});
