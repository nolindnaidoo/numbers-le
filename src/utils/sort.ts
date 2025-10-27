import type { SortMode } from '../types';

export type { SortMode };

export function sortNumber(
	numbers: readonly number[],
	mode: SortMode,
): readonly number[] {
	switch (mode) {
		case 'numeric-asc':
			return Object.freeze([...numbers].sort((a, b) => a - b));
		case 'numeric-desc':
			return Object.freeze([...numbers].sort((a, b) => b - a));
		case 'magnitude-asc':
			return Object.freeze(
				[...numbers].sort((a, b) => Math.abs(a) - Math.abs(b)),
			);
		case 'magnitude-desc':
			return Object.freeze(
				[...numbers].sort((a, b) => Math.abs(b) - Math.abs(a)),
			);
		case 'off':
			return Object.freeze([...numbers]);
		default:
			return Object.freeze([...numbers]);
	}
}

export function dedupeNumber(numbers: readonly number[]): readonly number[] {
	const seen = new Set<number>();
	const result: number[] = [];

	for (const num of numbers) {
		if (!seen.has(num)) {
			seen.add(num);
			result.push(num);
		}
	}

	return Object.freeze(result);
}

export function filterNumber(
	numbers: readonly number[],
	min?: number,
	max?: number,
): readonly number[] {
	return Object.freeze(
		numbers.filter((num) => {
			if (min !== undefined && num < min) return false;
			if (max !== undefined && num > max) return false;
			return true;
		}),
	);
}
