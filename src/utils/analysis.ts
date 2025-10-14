import type { AnalysisResult } from '../types';

export function analyzeNumbers(numbers: readonly number[]): AnalysisResult {
	if (numbers.length === 0) {
		return {
			count: 0,
			sum: 0,
			average: 0,
			min: 0,
			max: 0,
			median: 0,
			range: 0,
		};
	}

	const sorted = [...numbers].sort((a, b) => a - b);
	const count = numbers.length;
	const sum = numbers.reduce((acc, num) => acc + num, 0);
	const average = sum / count;
	const min = sorted[0]!;
	const max = sorted[sorted.length - 1]!;
	const median = calculateMedian(sorted);
	const mode = calculateMode(numbers);
	const range = max - min;

	return Object.freeze({
		count,
		sum,
		average,
		min: min!,
		max: max!,
		median,
		mode,
		range,
	});
}

function calculateMedian(sortedNumbers: number[]): number {
	const length = sortedNumbers.length;
	if (length % 2 === 0) {
		const mid1 = sortedNumbers[length / 2 - 1]!;
		const mid2 = sortedNumbers[length / 2]!;
		return (mid1 + mid2) / 2;
	} else {
		return sortedNumbers[Math.floor(length / 2)]!;
	}
}

function calculateMode(numbers: readonly number[]): number | undefined {
	const frequency = new Map<number, number>();

	for (const num of numbers) {
		frequency.set(num, (frequency.get(num) || 0) + 1);
	}

	let maxCount = 0;
	let mode: number | undefined;

	for (const [num, count] of frequency) {
		if (count > maxCount) {
			maxCount = count;
			mode = num;
		}
	}

	return maxCount > 1 ? mode : undefined;
}

export function calculateStandardDeviation(numbers: readonly number[]): number {
	if (numbers.length === 0) return 0;

	const mean = numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
	const squaredDiffs = numbers.map((num) => (num - mean) ** 2);
	const variance =
		squaredDiffs.reduce((acc, diff) => acc + diff, 0) / numbers.length;

	return Math.sqrt(variance);
}

export function calculateVariance(numbers: readonly number[]): number {
	if (numbers.length === 0) return 0;

	const mean = numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
	const squaredDiffs = numbers.map((num) => (num - mean) ** 2);

	return squaredDiffs.reduce((acc, diff) => acc + diff, 0) / numbers.length;
}

export function findOutliers(numbers: readonly number[]): number[] {
	if (numbers.length < 4) return [];

	const sorted = [...numbers].sort((a, b) => a - b);
	const q1 = calculateQuartile(sorted, 0.25);
	const q3 = calculateQuartile(sorted, 0.75);
	const iqr = q3 - q1;
	const lowerBound = q1 - 1.5 * iqr;
	const upperBound = q3 + 1.5 * iqr;

	return numbers.filter((num) => num < lowerBound || num > upperBound);
}

function calculateQuartile(
	sortedNumbers: number[],
	percentile: number,
): number {
	const index = percentile * (sortedNumbers.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const weight = index % 1;

	if (upper >= sortedNumbers.length)
		return sortedNumbers[sortedNumbers.length - 1]!;

	return sortedNumbers[lower]! * (1 - weight) + sortedNumbers[upper]! * weight;
}
