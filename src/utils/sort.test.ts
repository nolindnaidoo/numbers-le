import { describe, expect, test } from 'vitest';
import { dedupeNumber, sortNumber } from './sort';

describe('Sort Utils', () => {
	describe('sortNumber', () => {
		test("should return original array for 'off' mode", () => {
			const numbers = [3, 1, 4, 1, 5];
			const result = sortNumber(numbers, 'off');
			expect(result).toEqual(numbers);
		});

		test('should sort numbers in ascending order', () => {
			const numbers = [3, 1, 4, 1, 5];
			const result = sortNumber(numbers, 'numeric-asc');
			expect(result).toEqual([1, 1, 3, 4, 5]);
		});

		test('should sort numbers in descending order', () => {
			const numbers = [3, 1, 4, 1, 5];
			const result = sortNumber(numbers, 'numeric-desc');
			expect(result).toEqual([5, 4, 3, 1, 1]);
		});

		test('should sort by magnitude in ascending order', () => {
			const numbers = [-3, 1, -4, 1, 5];
			const result = sortNumber(numbers, 'magnitude-asc');
			expect(result).toEqual([1, 1, -3, -4, 5]);
		});

		test('should sort by magnitude in descending order', () => {
			const numbers = [-3, 1, -4, 1, 5];
			const result = sortNumber(numbers, 'magnitude-desc');
			expect(result).toEqual([5, -4, -3, 1, 1]);
		});

		test('should handle empty array', () => {
			const result = sortNumber([], 'numeric-asc');
			expect(result).toEqual([]);
		});

		test('should handle single number', () => {
			const result = sortNumber([42], 'numeric-asc');
			expect(result).toEqual([42]);
		});

		test('should handle negative numbers', () => {
			const numbers = [-5, -1, -3, -2, -4];
			const result = sortNumber(numbers, 'numeric-asc');
			expect(result).toEqual([-5, -4, -3, -2, -1]);
		});

		test('should handle decimal numbers', () => {
			const numbers = [3.14, 1.41, 2.71, 1.73];
			const result = sortNumber(numbers, 'numeric-asc');
			expect(result).toEqual([1.41, 1.73, 2.71, 3.14]);
		});

		test('should not mutate original array', () => {
			const numbers = [3, 1, 4, 1, 5];
			const original = [...numbers];
			sortNumber(numbers, 'numeric-asc');
			expect(numbers).toEqual(original);
		});
	});

	describe('dedupeNumber', () => {
		test('should remove duplicates', () => {
			const numbers = [1, 2, 2, 3, 3, 3, 4];
			const result = dedupeNumber(numbers);
			expect(result).toEqual([1, 2, 3, 4]);
		});

		test('should preserve order of first occurrence', () => {
			const numbers = [3, 1, 2, 1, 3, 2];
			const result = dedupeNumber(numbers);
			expect(result).toEqual([3, 1, 2]);
		});

		test('should handle empty array', () => {
			const result = dedupeNumber([]);
			expect(result).toEqual([]);
		});

		test('should handle single number', () => {
			const result = dedupeNumber([42]);
			expect(result).toEqual([42]);
		});

		test('should handle array with no duplicates', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = dedupeNumber(numbers);
			expect(result).toEqual(numbers);
		});

		test('should handle negative numbers', () => {
			const numbers = [-1, 2, -1, 3, 2, -3];
			const result = dedupeNumber(numbers);
			expect(result).toEqual([-1, 2, 3, -3]);
		});

		test('should handle decimal numbers', () => {
			const numbers = [1.5, 2.5, 1.5, 3.5, 2.5];
			const result = dedupeNumber(numbers);
			expect(result).toEqual([1.5, 2.5, 3.5]);
		});

		test('should not mutate original array', () => {
			const numbers = [1, 2, 2, 3];
			const original = [...numbers];
			dedupeNumber(numbers);
			expect(numbers).toEqual(original);
		});
	});
});
