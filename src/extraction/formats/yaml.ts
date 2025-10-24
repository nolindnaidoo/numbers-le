import * as yaml from 'js-yaml';
import type { ExtractionResult } from '../../types';

export function extractNumbersFromYaml(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = yaml.load(text);
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
					message: `Failed to parse YAML: ${(error as Error).message}`,
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
