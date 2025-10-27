import { describe, expect, test } from 'vitest';
import { extractFromIni } from './ini';

describe('INI Number Extraction', () => {
	describe('extractFromIni', () => {
		test('should extract numbers from simple INI', () => {
			const ini = '[settings]\ncount=42\nprice=19.99';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(42)).toBe(true);
			expect(result.numbers.includes(19.99)).toBe(true);
		});

		test('should extract numbers from multiple sections', () => {
			const ini =
				'[server]\nport=8080\ntimeout=30\n\n[database]\nconnections=5';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(5)).toBe(true);
		});

		test('should handle negative numbers', () => {
			const ini = '[values]\ntemperature=-10\ndelta=-5.5';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(-10)).toBe(true);
			expect(result.numbers.includes(-5.5)).toBe(true);
		});

		test('should handle zero values', () => {
			const ini = '[test]\ncount=0\nbalance=0.0\nratio=0';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.filter((n) => n === 0).length).toBe(3);
		});

		test('should ignore non-numeric values', () => {
			const ini =
				'[user]\nname=John\nage=30\nemail=john@example.com\nscore=85.5';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(85.5)).toBe(true);
		});

		test('should handle INI without sections', () => {
			const ini = 'count=42\nprice=19.99';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(42)).toBe(true);
			expect(result.numbers.includes(19.99)).toBe(true);
		});

		test('should handle empty INI', () => {
			const ini = '';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(0);
		});

		test('should handle INI with comments', () => {
			const ini = '; Configuration\n[server]\nport=8080\n; Timeout\ntimeout=30';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
		});

		test('should handle large numbers', () => {
			const ini = '[numbers]\nbig=1234567890\nsmall=0.000001';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(1234567890)).toBe(true);
			expect(result.numbers.includes(0.000001)).toBe(true);
		});

		test('should handle scientific notation', () => {
			const ini = '[science]\nscientific=1.23e4\nnegative=-5.67e-2';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(12300)).toBe(true);
			expect(result.numbers.includes(-0.0567)).toBe(true);
		});

		test('should handle quoted values', () => {
			const ini = '[config]\nport="8080"\ntimeout=\'30\'\nretries=3';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(3)).toBe(true);
		});

		test('should handle spaces around equals', () => {
			const ini = '[test]\ncount = 42\nprice = 19.99';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(42)).toBe(true);
			expect(result.numbers.includes(19.99)).toBe(true);
		});
	});
});
