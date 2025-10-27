import { describe, expect, test } from 'vitest';
import { extractFromJson } from './json';

describe('JSON Number Extraction', () => {
	describe('extractFromJson', () => {
		test('should extract numbers from simple JSON object', () => {
			const json = '{"count": 42, "price": 19.99, "active": true}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(42)).toBe(true);
			expect(result.numbers.includes(19.99)).toBe(true);
		});

		test('should extract numbers from JSON array', () => {
			const json = '[1, 2, 3.14, 4, 5.5]';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(5);
			expect(result.numbers).toEqual([1, 2, 3.14, 4, 5.5]);
		});

		test('should extract numbers from nested JSON objects', () => {
			const json =
				'{"user": {"id": 123, "profile": {"age": 25, "score": 95.5}}}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(123)).toBe(true);
			expect(result.numbers.includes(25)).toBe(true);
			expect(result.numbers.includes(95.5)).toBe(true);
		});

		test('should extract numbers from nested arrays', () => {
			const json = '{"matrix": [[1, 2], [3, 4]], "scalar": 5}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(5);
			expect(result.numbers.includes(1)).toBe(true);
			expect(result.numbers.includes(2)).toBe(true);
			expect(result.numbers.includes(3)).toBe(true);
			expect(result.numbers.includes(4)).toBe(true);
			expect(result.numbers.includes(5)).toBe(true);
		});

		test('should handle negative numbers', () => {
			const json = '{"temperature": -10, "delta": -5.5}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(-10)).toBe(true);
			expect(result.numbers.includes(-5.5)).toBe(true);
		});

		test('should handle zero values', () => {
			const json = '{"count": 0, "balance": 0.0, "ratio": 0}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(0)).toBe(true);
		});

		test('should ignore non-numeric values', () => {
			const json = '{"name": "John", "age": 30, "active": true, "score": 85.5}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(85.5)).toBe(true);
		});

		test('should handle empty JSON object', () => {
			const json = '{}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(0);
		});

		test('should handle empty JSON array', () => {
			const json = '[]';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(0);
		});

		test('should handle invalid JSON', () => {
			const json = '{"invalid": json}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(false);
			expect(result.errors.length).toBe(1);
			// Error message varies by JSON parser implementation
			expect(result.errors[0]?.message.length).toBeGreaterThan(0);
		});

		test('should handle malformed JSON', () => {
			const json = '{"unclosed": "string';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(false);
			expect(result.errors.length).toBe(1);
		});

		test('should handle null values', () => {
			const json = '{"value": null, "count": 5}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(1);
			expect(result.numbers.includes(5)).toBe(true);
		});

		test('should handle large numbers', () => {
			const json = '{"big": 1234567890, "small": 0.000001}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(1234567890)).toBe(true);
			expect(result.numbers.includes(0.000001)).toBe(true);
		});

		test('should handle scientific notation', () => {
			const json = '{"scientific": 1.23e4, "negative": -5.67e-2}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(12300)).toBe(true);
			expect(result.numbers.includes(-0.0567)).toBe(true);
		});

		test('should preserve number precision', () => {
			const json = '{"precise": 3.14159265359}';
			const result = extractFromJson(json, 'test.json');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(1);
			// Use approximate equality for floating point numbers
			expect(Math.abs((result.numbers[0] ?? 0) - Math.PI) < 1e-10).toBe(true);
		});
	});
});
