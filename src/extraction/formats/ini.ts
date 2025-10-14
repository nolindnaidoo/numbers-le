import * as ini from 'ini';
import type { ExtractionResult } from '../../types';

export function extractNumbersFromIni(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = ini.parse(text);
		const numbers = collectNumbers(parsed);

		return {
			success: true,
			numbers: Object.freeze(numbers),
			errors: Object.freeze([]),
		};
	} catch (error) {
		return {
			success: false,
			numbers: Object.freeze([]),
			errors: Object.freeze([
				{
					type: 'parse-error',
					message: `Failed to parse INI: ${(error as Error).message}`,
					filepath,
				},
			]),
		};
	}
}

function collectNumbers(obj: unknown): number[] {
	const numbers: number[] = [];

	if (typeof obj === 'number' && !Number.isNaN(obj)) {
		numbers.push(obj);
	} else if (typeof obj === 'string') {
		// Try to parse string as number
		const num = parseFloat(obj);
		if (!Number.isNaN(num) && Number.isFinite(num)) {
			numbers.push(num);
		}
	} else if (Array.isArray(obj)) {
		for (const item of obj) {
			numbers.push(...collectNumbers(item));
		}
	} else if (obj && typeof obj === 'object') {
		for (const value of Object.values(obj)) {
			numbers.push(...collectNumbers(value));
		}
	}

	return numbers;
}
