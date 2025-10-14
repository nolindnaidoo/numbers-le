import { describe, expect, test } from 'vitest';
import { dedupeNumbers, filterNumbers, sortNumbers } from './sort';

describe('Sort Utils', () => {
	describe('sortNumbers', () => {
		test("should return original array for 'off' mode", () => {
			const numbers = [3, 1, 4, 1, 5];
			const result = sortNumbers(numbers, 'off');
			expect(result).toEqual(numbers);
		});

		test('should sort numbers in ascending order', () => {
			const numbers = [3, 1, 4, 1, 5];
			const result = sortNumbers(numbers, 'numeric-asc');
			expect(result).toEqual([1, 1, 3, 4, 5]);
		});

		test('should sort numbers in descending order', () => {
			const numbers = [3, 1, 4, 1, 5];
			const result = sortNumbers(numbers, 'numeric-desc');
			expect(result).toEqual([5, 4, 3, 1, 1]);
		});

		test('should sort by magnitude in ascending order', () => {
			const numbers = [-3, 1, -4, 1, 5];
			const result = sortNumbers(numbers, 'magnitude-asc');
			expect(result).toEqual([1, 1, -3, -4, 5]);
		});

		test('should sort by magnitude in descending order', () => {
			const numbers = [-3, 1, -4, 1, 5];
			const result = sortNumbers(numbers, 'magnitude-desc');
			expect(result).toEqual([5, -4, -3, 1, 1]);
		});

		test('should handle empty array', () => {
			const result = sortNumbers([], 'numeric-asc');
			expect(result).toEqual([]);
		});

		test('should handle single number', () => {
			const result = sortNumbers([42], 'numeric-asc');
			expect(result).toEqual([42]);
		});

		test('should handle negative numbers', () => {
			const numbers = [-5, -1, -3, -2, -4];
			const result = sortNumbers(numbers, 'numeric-asc');
			expect(result).toEqual([-5, -4, -3, -2, -1]);
		});

		test('should handle decimal numbers', () => {
			const numbers = [3.14, 1.41, 2.71, 1.73];
			const result = sortNumbers(numbers, 'numeric-asc');
			expect(result).toEqual([1.41, 1.73, 2.71, 3.14]);
		});

		test('should not mutate original array', () => {
			const numbers = [3, 1, 4, 1, 5];
			const original = [...numbers];
			sortNumbers(numbers, 'numeric-asc');
			expect(numbers).toEqual(original);
		});
	});

	describe('dedupeNumbers', () => {
		test('should remove duplicates', () => {
			const numbers = [1, 2, 2, 3, 3, 3, 4];
			const result = dedupeNumbers(numbers);
			expect(result).toEqual([1, 2, 3, 4]);
		});

		test('should preserve order of first occurrence', () => {
			const numbers = [3, 1, 2, 1, 3, 2];
			const result = dedupeNumbers(numbers);
			expect(result).toEqual([3, 1, 2]);
		});

		test('should handle empty array', () => {
			const result = dedupeNumbers([]);
			expect(result).toEqual([]);
		});

		test('should handle single number', () => {
			const result = dedupeNumbers([42]);
			expect(result).toEqual([42]);
		});

		test('should handle array with no duplicates', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = dedupeNumbers(numbers);
			expect(result).toEqual(numbers);
		});

		test('should handle negative numbers', () => {
			const numbers = [-1, 2, -1, 3, 2, -3];
			const result = dedupeNumbers(numbers);
			expect(result).toEqual([-1, 2, 3, -3]);
		});

		test('should handle decimal numbers', () => {
			const numbers = [1.5, 2.5, 1.5, 3.5, 2.5];
			const result = dedupeNumbers(numbers);
			expect(result).toEqual([1.5, 2.5, 3.5]);
		});

		test('should not mutate original array', () => {
			const numbers = [1, 2, 2, 3];
			const original = [...numbers];
			dedupeNumbers(numbers);
			expect(numbers).toEqual(original);
		});
	});

	describe('filterNumbers', () => {
		test('should filter numbers by minimum value', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = filterNumbers(numbers, 3);
			expect(result).toEqual([3, 4, 5]);
		});

		test('should filter numbers by maximum value', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = filterNumbers(numbers, undefined, 3);
			expect(result).toEqual([1, 2, 3]);
		});

		test('should filter numbers by both min and max', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = filterNumbers(numbers, 2, 4);
			expect(result).toEqual([2, 3, 4]);
		});

		test('should handle empty array', () => {
			const result = filterNumbers([], 1, 5);
			expect(result).toEqual([]);
		});

		test('should handle no filters', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = filterNumbers(numbers);
			expect(result).toEqual(numbers);
		});

		test('should handle negative numbers', () => {
			const numbers = [-5, -3, -1, 0, 1, 3, 5];
			const result = filterNumbers(numbers, -2, 2);
			expect(result).toEqual([-1, 0, 1]);
		});

		test('should handle decimal numbers', () => {
			const numbers = [1.1, 2.2, 3.3, 4.4, 5.5];
			const result = filterNumbers(numbers, 2.0, 4.0);
			expect(result).toEqual([2.2, 3.3]);
		});

		test('should not mutate original array', () => {
			const numbers = [1, 2, 3, 4, 5];
			const original = [...numbers];
			filterNumbers(numbers, 2, 4);
			expect(numbers).toEqual(original);
		});

		test('should return empty array when no numbers match', () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = filterNumbers(numbers, 10, 20);
			expect(result).toEqual([]);
		});
	});
});
