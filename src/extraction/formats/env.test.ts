import { describe, expect, test } from 'vitest';
import { extractFromEnv } from './env';

describe('ENV Number Extraction', () => {
	describe('extractFromEnv', () => {
		test('should extract numbers from simple .env', () => {
			const env = 'PORT=8080\nTIMEOUT=30\nRETRIES=3';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(3)).toBe(true);
		});

		test('should extract decimal numbers', () => {
			const env = 'PRICE=19.99\nTAX=0.15\nDISCOUNT=5.50';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(19.99)).toBe(true);
			expect(result.numbers.includes(0.15)).toBe(true);
			expect(result.numbers.includes(5.5)).toBe(true);
		});

		test('should handle negative numbers', () => {
			const env = 'TEMPERATURE=-10\nDELTA=-5.5';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(-10)).toBe(true);
			expect(result.numbers.includes(-5.5)).toBe(true);
		});

		test('should handle zero values', () => {
			const env = 'COUNT=0\nBALANCE=0.0\nRATIO=0';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.filter((n) => n === 0).length).toBe(3);
		});

		test('should ignore non-numeric values', () => {
			const env = 'NAME=John\nAGE=30\nEMAIL=john@example.com\nSCORE=85.5';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(85.5)).toBe(true);
		});

		test('should handle empty .env', () => {
			const env = '';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(0);
		});

		test('should handle .env with comments', () => {
			const env = '# Configuration\nPORT=8080\n# Timeout\nTIMEOUT=30';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
		});

		test('should handle .env with empty lines', () => {
			const env = 'PORT=8080\n\nTIMEOUT=30\n\nRETRIES=3';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(3)).toBe(true);
		});

		test('should handle large numbers', () => {
			const env = 'BIG=1234567890\nSMALL=0.000001';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(1234567890)).toBe(true);
			expect(result.numbers.includes(0.000001)).toBe(true);
		});

		test('should handle scientific notation', () => {
			const env = 'SCIENTIFIC=1.23e4\nNEGATIVE=-5.67e-2';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers.includes(12300)).toBe(true);
			expect(result.numbers.includes(-0.0567)).toBe(true);
		});

		test('should handle quoted values', () => {
			const env = 'PORT="8080"\nTIMEOUT=\'30\'\nRETRIES=3';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
			expect(result.numbers.includes(8080)).toBe(true);
			expect(result.numbers.includes(30)).toBe(true);
			expect(result.numbers.includes(3)).toBe(true);
		});

		test('should handle values with numbers in strings', () => {
			const env = 'VERSION=1.2.3\nAPI_KEY=abc123\nCOUNT=42';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// VERSION=1.2.3 parses as 1.2
			// API_KEY=abc123 is NaN
			// COUNT=42 parses as 42
			expect(result.numbers.includes(42)).toBe(true);
		});
	});
});
