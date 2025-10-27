import * as ini from 'ini';
import type { ExtractionResult } from '../../types';

export function extractFromIni(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = ini.parse(text);
		const numbers = collectNumber(parsed);

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

function collectNumber(value: unknown): readonly number[] {
	if (typeof value === 'number' && !Number.isNaN(value)) {
		return [value];
	}

	if (typeof value === 'string') {
		const num = parseFloat(value);
		if (!Number.isNaN(num) && Number.isFinite(num)) {
			return [num];
		}
		return [];
	}

	if (Array.isArray(value)) {
		const numbers: number[] = [];
		for (const item of value) {
			numbers.push(...collectNumber(item));
		}
		return numbers;
	}

	if (value && typeof value === 'object') {
		const numbers: number[] = [];
		for (const prop of Object.values(value)) {
			numbers.push(...collectNumber(prop));
		}
		return numbers;
	}

	return [];
}
