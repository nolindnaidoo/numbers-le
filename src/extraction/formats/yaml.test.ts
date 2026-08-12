import { describe, expect, test } from 'vitest';
import type { ExtractionResult } from '../../types';
import { extractFromYaml } from './yaml';

/**
 * The values alone. Findings carry `{ value, notation }` since 0.2.0;
 * these tests are about which numbers come out, and the notation has its
 * own cases in the shared corpus.
 */
function values(result: ExtractionResult): readonly number[] {
	return result.numbers.map((found) => found.value);
}

describe('YAML Number Extraction', () => {
	describe('extractFromYaml', () => {
		test('should extract numbers from simple YAML', () => {
			const yaml = 'count: 42\nprice: 19.99\nactive: true';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(42)).toBe(true);
			expect(values(result).includes(19.99)).toBe(true);
		});

		test('should extract numbers from YAML array', () => {
			const yaml = '- 1\n- 2\n- 3.14\n- 4\n- 5.5';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(5);
			expect(values(result)).toEqual([1, 2, 3.14, 4, 5.5]);
		});

		test('should extract numbers from nested YAML objects', () => {
			const yaml = `
user:
  id: 123
  profile:
    age: 25
    score: 95.5
`;
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).includes(123)).toBe(true);
			expect(values(result).includes(25)).toBe(true);
			expect(values(result).includes(95.5)).toBe(true);
		});

		test('should handle negative numbers', () => {
			const yaml = 'temperature: -10\ndelta: -5.5';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(-10)).toBe(true);
			expect(values(result).includes(-5.5)).toBe(true);
		});

		test('should handle zero values', () => {
			const yaml = 'count: 0\nbalance: 0.0\nratio: 0';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).filter((n) => n === 0).length).toBe(3);
		});

		test('should ignore non-numeric values', () => {
			const yaml = 'name: John\nage: 30\nactive: true\nscore: 85.5';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(30)).toBe(true);
			expect(values(result).includes(85.5)).toBe(true);
		});

		test('should handle empty YAML', () => {
			const yaml = '';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(0);
		});

		test('should handle invalid YAML', () => {
			const yaml = 'invalid: [unclosed';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(false);
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]?.message).toContain('Failed to parse YAML');
		});

		test('should handle null values', () => {
			const yaml = 'value: null\ncount: 5';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(1);
			expect(values(result).includes(5)).toBe(true);
		});

		test('should handle large numbers', () => {
			const yaml = 'big: 1234567890\nsmall: 0.000001';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(1234567890)).toBe(true);
			expect(values(result).includes(0.000001)).toBe(true);
		});

		test('should handle scientific notation', () => {
			const yaml = 'scientific: 1.23e4\nnegative: -5.67e-2';
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(12300)).toBe(true);
			expect(values(result).includes(-0.0567)).toBe(true);
		});

		test('should extract numbers from YAML lists', () => {
			const yaml = `
data:
  - value: 10
  - value: 20
  - value: 30
`;
			const result = extractFromYaml(yaml, 'test.yaml');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result)).toEqual([10, 20, 30]);
		});
	});
});
