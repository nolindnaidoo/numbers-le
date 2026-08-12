import { describe, expect, test } from 'vitest';
import type { ExtractionResult } from '../../types';
import { extractFromToml } from './toml';

/**
 * The values alone. Findings carry `{ value, notation }` since 0.2.0;
 * these tests are about which numbers come out, and the notation has its
 * own cases in the shared corpus.
 */
function values(result: ExtractionResult): readonly number[] {
	return result.numbers.map((found) => found.value);
}

describe('TOML Number Extraction', () => {
	describe('extractFromToml', () => {
		test('should extract numbers from simple TOML', () => {
			const toml = 'count = 42\nprice = 19.99\nactive = true';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(42)).toBe(true);
			expect(values(result).includes(19.99)).toBe(true);
		});

		test('should extract numbers from TOML array', () => {
			const toml = 'integers = [1, 2, 3, 4, 5]\nfloats = [1.1, 2.2, 3.3]';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(8);
			expect(values(result).includes(1)).toBe(true);
			expect(values(result).includes(2)).toBe(true);
			expect(values(result).includes(3)).toBe(true);
			expect(values(result).includes(1.1)).toBe(true);
			expect(values(result).includes(2.2)).toBe(true);
			expect(values(result).includes(3.3)).toBe(true);
		});

		test('should extract numbers from TOML tables', () => {
			const toml = `
[user]
id = 123

[user.profile]
age = 25
score = 95.5
`;
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).includes(123)).toBe(true);
			expect(values(result).includes(25)).toBe(true);
			expect(values(result).includes(95.5)).toBe(true);
		});

		test('should handle negative numbers', () => {
			const toml = 'temperature = -10\ndelta = -5.5';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(-10)).toBe(true);
			expect(values(result).includes(-5.5)).toBe(true);
		});

		test('should handle zero values', () => {
			const toml = 'count = 0\nbalance = 0.0\nratio = 0';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).filter((n) => n === 0).length).toBe(3);
		});

		test('should ignore non-numeric values', () => {
			const toml = 'name = "John"\nage = 30\nactive = true\nscore = 85.5';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(30)).toBe(true);
			expect(values(result).includes(85.5)).toBe(true);
		});

		test('should handle empty TOML', () => {
			const toml = '';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(0);
		});

		test('should handle invalid TOML', () => {
			const toml = 'invalid = [unclosed';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(false);
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]?.message).toContain('Failed to parse TOML');
		});

		test('should handle large numbers', () => {
			const toml = 'big = 1234567890\nsmall = 0.000001';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(1234567890)).toBe(true);
			expect(values(result).includes(0.000001)).toBe(true);
		});

		test('should handle scientific notation', () => {
			const toml = 'scientific = 1.23e4\nnegative = -5.67e-2';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(12300)).toBe(true);
			expect(values(result).includes(-0.0567)).toBe(true);
		});

		test('should extract numbers from inline tables', () => {
			const toml = 'point = { x = 10, y = 20, z = 30 }';
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).includes(10)).toBe(true);
			expect(values(result).includes(20)).toBe(true);
			expect(values(result).includes(30)).toBe(true);
		});

		test('should extract numbers from array of tables', () => {
			const toml = `
[[products]]
id = 1
price = 10.99

[[products]]
id = 2
price = 20.50
`;
			const result = extractFromToml(toml, 'test.toml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(4);
			expect(values(result).includes(1)).toBe(true);
			expect(values(result).includes(2)).toBe(true);
			expect(values(result).includes(10.99)).toBe(true);
			expect(values(result).includes(20.5)).toBe(true);
		});
	});
});
