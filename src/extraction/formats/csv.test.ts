import { describe, expect, test } from 'vitest';
import { extractFromCsv } from './csv';

describe('CSV Number Extraction', () => {
	describe('extractFromCsv', () => {
		test('should extract numbers from simple CSV', () => {
			const csv = '1,2,3\n4,5,6';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
			expect(result.numbers).toEqual([1, 2, 3, 4, 5, 6]);
		});

		test('should extract numbers from CSV with headers', () => {
			const csv = 'name,age,score\nJohn,25,85.5\nJane,30,92.0';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(4);
			expect(result.numbers).toContain(25);
			expect(result.numbers).toContain(85.5);
			expect(result.numbers).toContain(30);
			expect(result.numbers).toContain(92.0);
		});

		test('should handle decimal numbers', () => {
			const csv = '1.5,2.7,3.14\n4.2,5.8,6.9';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
			expect(result.numbers).toContain(1.5);
			expect(result.numbers).toContain(2.7);
			expect(result.numbers).toContain(3.14);
		});

		test('should handle negative numbers', () => {
			const csv = '-1,-2,3\n-4,5,-6';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
			expect(result.numbers).toContain(-1);
			expect(result.numbers).toContain(-2);
			expect(result.numbers).toContain(-4);
			expect(result.numbers).toContain(-6);
		});

		test('should ignore non-numeric values', () => {
			const csv = 'name,age,active\nJohn,25,true\nJane,30,false';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(2);
			expect(result.numbers).toContain(25);
			expect(result.numbers).toContain(30);
		});

		test('should handle empty CSV', () => {
			const csv = '';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(0);
		});

		test('should handle CSV with only headers', () => {
			const csv = 'name,age,score';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(0);
		});

		test('should handle CSV with empty cells', () => {
			const csv = '1,,3\n,5,6';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(4);
			expect(result.numbers).toContain(1);
			expect(result.numbers).toContain(3);
			expect(result.numbers).toContain(5);
			expect(result.numbers).toContain(6);
		});

		test('should handle CSV with quoted values', () => {
			const csv = '"1","2","3"\n"4","5","6"';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
			expect(result.numbers).toEqual([1, 2, 3, 4, 5, 6]);
		});

		test('should handle CSV with mixed quoted and unquoted values', () => {
			const csv = '1,"2",3\n"4",5,"6"';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
			expect(result.numbers).toEqual([1, 2, 3, 4, 5, 6]);
		});

		test('should handle CSV with line breaks in quoted values', () => {
			const csv = '"1","2","3"\n"4","5\nwith newline","6"';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract numbers even from values with newlines
			expect(result.numbers).toContain(1);
			expect(result.numbers).toContain(2);
			expect(result.numbers).toContain(3);
			expect(result.numbers).toContain(4);
			expect(result.numbers).toContain(6);
		});

		test('should handle very large numbers', () => {
			const csv = '1234567890,0.000001\n999999999,0.999999';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(4);
			expect(result.numbers).toContain(1234567890);
			expect(result.numbers).toContain(0.000001);
			expect(result.numbers).toContain(999999999);
			expect(result.numbers).toContain(0.999999);
		});

		test('should handle scientific notation', () => {
			const csv = '1.23e4,5.67e-2\n9.99e3,1.11e-1';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(4);
			expect(result.numbers).toContain(12300);
			expect(result.numbers).toContain(0.0567);
			expect(result.numbers).toContain(9990);
			expect(result.numbers).toContain(0.111);
		});

		// NEW EDGE CASE TESTS
		test('should handle CSV with zero values', () => {
			const csv = '0,0.0,0,1';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers).toContain(0);
			expect(result.numbers).toContain(1);
		});

		test('should handle CSV with whitespace', () => {
			const csv = '  1  ,  2  ,  3  \n  4  ,  5  ,  6  ';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
		});

		test('should handle CSV with empty rows', () => {
			const csv = '1,2,3\n\n4,5,6\n\n';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
		});

		test('should handle CSV with trailing commas', () => {
			const csv = '1,2,3,\n4,5,6,';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
		});

		test('should handle CSV with Windows line endings', () => {
			const csv = '1,2,3\r\n4,5,6\r\n';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
		});

		test('should handle CSV with mixed line endings', () => {
			const csv = '1,2,3\n4,5,6\r\n7,8,9';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(9);
		});

		test('should handle CSV with numbers in text', () => {
			const csv = 'item123,45 items,price $67.89';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle CSV with percentages', () => {
			const csv = '50%,75%,100%';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract the numeric part
			expect(result.numbers).toContain(50);
			expect(result.numbers).toContain(75);
			expect(result.numbers).toContain(100);
		});

		test('should handle CSV with currency symbols', () => {
			const csv = '$10.50,$20.00,$30.25';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// parseFloat doesn't extract numbers starting with $
			// This is expected behavior - avoids false positives
			expect(result.numbers.length).toBe(0);
		});

		test('should handle CSV with commas in quoted numbers', () => {
			const csv = '"1,000","2,500","3,750"';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// parseFloat will handle this
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle CSV with NaN-producing values', () => {
			const csv = 'abc,def,ghi';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should not include NaN values
			expect(result.numbers.length).toBe(0);
		});

		test('should handle CSV with very large scientific notation', () => {
			const csv = '1e308,1e-308,9.999e307';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should handle very large numbers
			expect(result.numbers.length).toBe(3);
			expect(result.numbers[0]).toBe(1e308);
		});

		test('should handle CSV with very small numbers', () => {
			const csv = '0.0000001,1e-10,0.999999999';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(3);
		});

		test('should handle CSV with integer and float mix', () => {
			const csv = '1,1.0,1.5,2,2.0,2.5';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
			expect(result.numbers).toContain(1);
			expect(result.numbers).toContain(1.5);
			expect(result.numbers).toContain(2);
			expect(result.numbers).toContain(2.5);
		});

		test('should handle CSV with only whitespace cells', () => {
			const csv = '1,   ,3\n ,5, ';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers).toContain(1);
			expect(result.numbers).toContain(3);
			expect(result.numbers).toContain(5);
		});

		test('should handle single column CSV', () => {
			const csv = '1\n2\n3\n4\n5';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(5);
			expect(result.numbers).toEqual([1, 2, 3, 4, 5]);
		});

		test('should handle single row CSV', () => {
			const csv = '1,2,3,4,5';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(5);
			expect(result.numbers).toEqual([1, 2, 3, 4, 5]);
		});

		test('should handle CSV with BOM', () => {
			const csv = '\uFEFF1,2,3\n4,5,6';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			expect(result.numbers.length).toBe(6);
		});

		test('should return immutable arrays', () => {
			const csv = '1,2,3';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Arrays should be frozen for immutability
			expect(Object.isFrozen(result.numbers)).toBe(true);
			expect(Object.isFrozen(result.errors)).toBe(true);
		});
	});
});
