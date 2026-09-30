import { describe, expect, it } from 'vitest';
import { extractNumber } from './extract';
import { exactPositions } from './positions';

const place = (text: string, fileType: 'json' | 'unknown' | 'toml' | 'rust') =>
	exactPositions(
		text,
		fileType,
		extractNumber(text, fileType, '').numbers,
		fileType === 'rust',
	);

describe('exactPositions', () => {
	it('places JSON numbers, and skips digits inside strings and keys', () => {
		expect(place('{"k26": 8080,\n "s": "9", "n": -1.5e3}', 'json')).toEqual([
			{ line: 1, column: 9 },
			{ line: 2, column: 17 },
		]);
	});

	it('places source literals and plain-text numbers', () => {
		expect(place('let a = 0x1A;', 'rust')).toEqual([{ line: 1, column: 9 }]);
		expect(place('rate 0.0825 and 12', 'unknown')).toEqual([
			{ line: 1, column: 6 },
			{ line: 1, column: 17 },
		]);
	});

	it('gives a parsed format no position rather than a guess', () => {
		expect(place('k26 = 0x1A\n', 'toml')).toBeUndefined();
	});

	it('places nothing when a repeated key makes the lists disagree', () => {
		expect(place('{"a": 1, "a": 2}', 'json')).toBeUndefined();
	});
});
