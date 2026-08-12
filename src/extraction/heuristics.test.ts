import { describe, expect, it } from 'vitest';
import type { NumberFinding } from '../types';
import {
	collectNumbers,
	isExtractableNumber,
	parseStrictNumber,
	scanTextForNumbers,
} from './heuristics';

/** The values alone; notation has its own cases below. */
function values(found: readonly NumberFinding[]): readonly number[] {
	return found.map((one) => one.value);
}

function value(found: NumberFinding | undefined): number | undefined {
	return found?.value;
}

describe('parseStrictNumber', () => {
	it('accepts full-string numerics', () => {
		expect(value(parseStrictNumber('42'))).toBe(42);
		expect(value(parseStrictNumber('-7'))).toBe(-7);
		expect(value(parseStrictNumber('+3'))).toBe(3);
		expect(value(parseStrictNumber('.5'))).toBe(0.5);
		expect(value(parseStrictNumber('5.'))).toBe(5);
		expect(value(parseStrictNumber('-1.5e3'))).toBe(-1500);
		expect(value(parseStrictNumber(' 19.99 '))).toBe(19.99);
	});

	// An untyped format keeps what its text said, because this module is
	// what parsed it.
	it('carries the notation the text used', () => {
		expect(parseStrictNumber('42')?.notation).toBe('decimal');
		expect(parseStrictNumber('-1.5e3')?.notation).toBe('scientific');
		expect(parseStrictNumber('1E5')?.notation).toBe('scientific');
	});

	it('rejects anything that is not numeric in full', () => {
		expect(parseStrictNumber('12abc')).toBeUndefined();
		expect(parseStrictNumber('1.2.3')).toBeUndefined();
		expect(parseStrictNumber('1,000')).toBeUndefined();
		expect(parseStrictNumber('0x1A')).toBeUndefined();
		expect(parseStrictNumber('')).toBeUndefined();
		expect(parseStrictNumber('Infinity')).toBeUndefined();
		expect(parseStrictNumber('NaN')).toBeUndefined();
	});

	it('rejects values that overflow to Infinity', () => {
		expect(parseStrictNumber('1e999')).toBeUndefined();
	});
});

describe('isExtractableNumber', () => {
	it('accepts finite numbers only', () => {
		expect(isExtractableNumber(0)).toBe(true);
		expect(isExtractableNumber(-3.14)).toBe(true);
		expect(isExtractableNumber(Number.NaN)).toBe(false);
		expect(isExtractableNumber(Number.POSITIVE_INFINITY)).toBe(false);
		expect(isExtractableNumber('42')).toBe(false);
	});
});

describe('collectNumbers', () => {
	const nested = {
		a: 1,
		b: [2.5, { c: -3 }, 'x'],
		d: '4',
		e: null,
		f: true,
	};

	it('walks structures in document order without string coercion', () => {
		expect(values(collectNumbers(nested, { coerceStrings: false }))).toEqual([
			1, 2.5, -3,
		]);
	});

	it('coerces full-string numerics when asked', () => {
		expect(values(collectNumbers(nested, { coerceStrings: true }))).toEqual([
			1, 2.5, -3, 4,
		]);
	});

	it('treats Date values as leaves, not traversable objects', () => {
		expect(
			values(
				collectNumbers({ when: new Date(0), n: 5 }, { coerceStrings: false }),
			),
		).toEqual([5]);
	});

	it('drops non-finite numbers', () => {
		expect(
			values(
				collectNumbers([1, Number.NaN, Number.POSITIVE_INFINITY, 2], {
					coerceStrings: false,
				}),
			),
		).toEqual([1, 2]);

		// A parsed number arrives with its token already resolved, so it
		// is reported as decimal whatever the source wrote.
		expect(collectNumbers([1e21], { coerceStrings: false })[0]?.notation).toBe(
			'decimal',
		);
	});
});

describe('scanTextForNumbers', () => {
	it('finds plain decimals, exponents, and signs in free text', () => {
		expect(values(scanTextForNumbers('width:0 -5 up 1e3 and .25'))).toEqual([
			0, -5, 1000, 0.25,
		]);
		expect(scanTextForNumbers('1e3')[0]?.notation).toBe('scientific');
	});

	it('reads dotted versions as separate numbers (no grammar)', () => {
		expect(values(scanTextForNumbers('v1.2.3'))).toEqual([1.2, 0.3]);
	});
});
