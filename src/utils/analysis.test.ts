import { describe, expect, test } from 'vitest';
import {
	analyzeNumbers,
	calculateStandardDeviation,
	calculateVariance,
	findOutliers,
} from './analysis';

describe('Analysis Utils', () => {
	describe('analyzeNumbers', () => {
		test('should handle empty array', () => {
			const result = analyzeNumbers([]);
			expect(result.count).toBe(0);
			expect(result.sum).toBe(0);
			expect(result.average).toBe(0);
			expect(result.min).toBe(0);
			expect(result.max).toBe(0);
			expect(result.median).toBe(0);
			expect(result.range).toBe(0);
		});

		test('should calculate basic statistics for single number', () => {
			const result = analyzeNumbers([42]);
			expect(result.count).toBe(1);
			expect(result.sum).toBe(42);
			expect(result.average).toBe(42);
			expect(result.min).toBe(42);
			expect(result.max).toBe(42);
			expect(result.median).toBe(42);
			expect(result.range).toBe(0);
		});

		test('should calculate basic statistics for multiple numbers', () => {
			const result = analyzeNumbers([1, 2, 3, 4, 5]);
			expect(result.count).toBe(5);
			expect(result.sum).toBe(15);
			expect(result.average).toBe(3);
			expect(result.min).toBe(1);
			expect(result.max).toBe(5);
			expect(result.median).toBe(3);
			expect(result.range).toBe(4);
		});

		test('should calculate median for even number of elements', () => {
			const result = analyzeNumbers([1, 2, 3, 4]);
			expect(result.median).toBe(2.5);
		});

		test('should calculate median for odd number of elements', () => {
			const result = analyzeNumbers([1, 2, 3, 4, 5]);
			expect(result.median).toBe(3);
		});

		test('should calculate mode', () => {
			const result = analyzeNumbers([1, 2, 2, 3, 3, 3]);
			expect(result.mode).toBe(3);
		});

		test('should return undefined mode when no duplicates', () => {
			const result = analyzeNumbers([1, 2, 3, 4, 5]);
			expect(result.mode).toBe(undefined);
		});

		test('should handle negative numbers', () => {
			const result = analyzeNumbers([-5, -3, -1, 0, 1, 3, 5]);
			expect(result.count).toBe(7);
			expect(result.sum).toBe(0);
			expect(result.average).toBe(0);
			expect(result.min).toBe(-5);
			expect(result.max).toBe(5);
			expect(result.median).toBe(0);
			expect(result.range).toBe(10);
		});

		test('should handle decimal numbers', () => {
			const result = analyzeNumbers([1.5, 2.5, 3.5]);
			expect(result.count).toBe(3);
			expect(result.sum).toBe(7.5);
			expect(result.average).toBe(2.5);
			expect(result.min).toBe(1.5);
			expect(result.max).toBe(3.5);
			expect(result.median).toBe(2.5);
			expect(result.range).toBe(2);
		});
	});

	describe('calculateStandardDeviation', () => {
		test('should return 0 for empty array', () => {
			const result = calculateStandardDeviation([]);
			expect(result).toBe(0);
		});

		test('should return 0 for single number', () => {
			const result = calculateStandardDeviation([42]);
			expect(result).toBe(0);
		});

		test('should calculate standard deviation for multiple numbers', () => {
			const result = calculateStandardDeviation([1, 2, 3, 4, 5]);
			expect(Math.abs(result - Math.SQRT2) < 0.01).toBe(true);
		});

		test('should handle negative numbers', () => {
			const result = calculateStandardDeviation([-2, -1, 0, 1, 2]);
			expect(Math.abs(result - Math.SQRT2) < 0.01).toBe(true);
		});
	});

	describe('calculateVariance', () => {
		test('should return 0 for empty array', () => {
			const result = calculateVariance([]);
			expect(result).toBe(0);
		});

		test('should return 0 for single number', () => {
			const result = calculateVariance([42]);
			expect(result).toBe(0);
		});

		test('should calculate variance for multiple numbers', () => {
			const result = calculateVariance([1, 2, 3, 4, 5]);
			expect(Math.abs(result - 2) < 0.01).toBe(true);
		});
	});

	describe('findOutliers', () => {
		test('should return empty array for less than 4 numbers', () => {
			const result = findOutliers([1, 2, 3]);
			expect(result.length).toBe(0);
		});

		test('should find outliers using IQR method', () => {
			const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is an outlier
			const result = findOutliers(numbers);
			expect(result.length).toBe(1);
			expect(result[0]).toBe(100);
		});

		test('should find multiple outliers', () => {
			const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100, 200]; // 100 and 200 are outliers
			const result = findOutliers(numbers);
			expect(result.length).toBe(2);
			expect(result.includes(100)).toBe(true);
			expect(result.includes(200)).toBe(true);
		});

		test('should return empty array when no outliers', () => {
			const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const result = findOutliers(numbers);
			expect(result.length).toBe(0);
		});

		test('should handle negative outliers', () => {
			const numbers = [-100, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // -100 is an outlier
			const result = findOutliers(numbers);
			expect(result.length).toBe(1);
			expect(result[0]).toBe(-100);
		});
	});
});
