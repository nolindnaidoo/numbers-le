import { describe, expect, it } from 'vitest';

describe('Basic Numbers Extension Tests', () => {
	it('should pass basic test', () => {
		expect(1 + 1).toBe(2);
	});

	it('should handle basic math operations', () => {
		const result = 5 * 3;
		expect(result).toBe(15);
	});

	it('should validate array operations', () => {
		const numbers = [1, 2, 3, 4, 5];
		const sum = numbers.reduce((acc, num) => acc + num, 0);
		expect(sum).toBe(15);
	});
});
