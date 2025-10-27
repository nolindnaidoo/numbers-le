import { parse } from 'dotenv';
import type { ExtractionResult } from '../../types';

export function extractFromEnv(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = parse(text);
		const numbers: number[] = [];

		for (const value of Object.values(parsed)) {
			if (typeof value === 'string') {
				const num = parseFloat(value);
				if (!Number.isNaN(num) && Number.isFinite(num)) {
					numbers.push(num);
				}
			} else if (typeof value === 'number' && !Number.isNaN(value)) {
				numbers.push(value);
			}
		}

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
					message: `Failed to parse .env: ${(error as Error).message}`,
					filepath,
				},
			]),
		};
	}
}
