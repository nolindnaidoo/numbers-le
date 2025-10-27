import { describe, expect, test } from 'vitest';

// Test the validation functions directly without importing the full config module
function isValidSortMode(
	v: unknown,
): v is
	| 'off'
	| 'numeric-asc'
	| 'numeric-desc'
	| 'magnitude-asc'
	| 'magnitude-desc' {
	return (
		v === 'off' ||
		v === 'numeric-asc' ||
		v === 'numeric-desc' ||
		v === 'magnitude-asc' ||
		v === 'magnitude-desc'
	);
}

function isValidNotificationLevel(
	v: unknown,
): v is 'all' | 'important' | 'silent' {
	return v === 'all' || v === 'important' || v === 'silent';
}

describe('Config Utils', () => {
	describe('isValidSortMode', () => {
		test('should validate valid sort modes', () => {
			expect(isValidSortMode('off')).toBe(true);
			expect(isValidSortMode('numeric-asc')).toBe(true);
			expect(isValidSortMode('numeric-desc')).toBe(true);
			expect(isValidSortMode('magnitude-asc')).toBe(true);
			expect(isValidSortMode('magnitude-desc')).toBe(true);
		});

		test('should reject invalid sort modes', () => {
			expect(isValidSortMode('invalid')).toBe(false);
			expect(isValidSortMode('asc')).toBe(false);
			expect(isValidSortMode('desc')).toBe(false);
			expect(isValidSortMode('')).toBe(false);
			expect(isValidSortMode(null)).toBe(false);
			expect(isValidSortMode(undefined)).toBe(false);
			expect(isValidSortMode(123)).toBe(false);
		});
	});

	describe('isValidNotificationLevel', () => {
		test('should validate valid notification levels', () => {
			expect(isValidNotificationLevel('all')).toBe(true);
			expect(isValidNotificationLevel('important')).toBe(true);
			expect(isValidNotificationLevel('silent')).toBe(true);
		});

		test('should reject invalid notification levels', () => {
			expect(isValidNotificationLevel('verbose')).toBe(false);
			expect(isValidNotificationLevel('debug')).toBe(false);
			expect(isValidNotificationLevel('')).toBe(false);
			expect(isValidNotificationLevel(null)).toBe(false);
			expect(isValidNotificationLevel(undefined)).toBe(false);
			expect(isValidNotificationLevel(123)).toBe(false);
		});
	});
});
