import { describe, expect, test } from 'vitest';
import type { ExtractionResult } from '../../types';
import { extractFromIni } from './ini';

/**
 * The values alone. Findings carry `{ value, notation }` since 0.2.0;
 * these tests are about which numbers come out, and the notation has its
 * own cases in the shared corpus.
 */
function values(result: ExtractionResult): readonly number[] {
	return result.numbers.map((found) => found.value);
}

describe('INI Number Extraction', () => {
	describe('extractFromIni', () => {
		test('should extract numbers from simple INI', () => {
			const ini = '[settings]\ncount=42\nprice=19.99';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(42)).toBe(true);
			expect(values(result).includes(19.99)).toBe(true);
		});

		test('should extract numbers from multiple sections', () => {
			const ini =
				'[server]\nport=8080\ntimeout=30\n\n[database]\nconnections=5';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).includes(8080)).toBe(true);
			expect(values(result).includes(30)).toBe(true);
			expect(values(result).includes(5)).toBe(true);
		});

		test('should handle negative numbers', () => {
			const ini = '[values]\ntemperature=-10\ndelta=-5.5';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(-10)).toBe(true);
			expect(values(result).includes(-5.5)).toBe(true);
		});

		test('should handle zero values', () => {
			const ini = '[test]\ncount=0\nbalance=0.0\nratio=0';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).filter((n) => n === 0).length).toBe(3);
		});

		test('should ignore non-numeric values', () => {
			const ini =
				'[user]\nname=John\nage=30\nemail=john@example.com\nscore=85.5';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(30)).toBe(true);
			expect(values(result).includes(85.5)).toBe(true);
		});

		test('should handle INI without sections', () => {
			const ini = 'count=42\nprice=19.99';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(42)).toBe(true);
			expect(values(result).includes(19.99)).toBe(true);
		});

		test('should handle empty INI', () => {
			const ini = '';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(0);
		});

		test('should handle INI with comments', () => {
			const ini = '; Configuration\n[server]\nport=8080\n; Timeout\ntimeout=30';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(8080)).toBe(true);
			expect(values(result).includes(30)).toBe(true);
		});

		test('should handle large numbers', () => {
			const ini = '[numbers]\nbig=1234567890\nsmall=0.000001';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(1234567890)).toBe(true);
			expect(values(result).includes(0.000001)).toBe(true);
		});

		test('should handle scientific notation', () => {
			const ini = '[science]\nscientific=1.23e4\nnegative=-5.67e-2';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(12300)).toBe(true);
			expect(values(result).includes(-0.0567)).toBe(true);
		});

		test('should handle quoted values', () => {
			const ini = '[config]\nport="8080"\ntimeout=\'30\'\nretries=3';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(3);
			expect(values(result).includes(8080)).toBe(true);
			expect(values(result).includes(30)).toBe(true);
			expect(values(result).includes(3)).toBe(true);
		});

		test('should handle spaces around equals', () => {
			const ini = '[test]\ncount = 42\nprice = 19.99';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(values(result).length).toBe(2);
			expect(values(result).includes(42)).toBe(true);
			expect(values(result).includes(19.99)).toBe(true);
		});
	});
});
