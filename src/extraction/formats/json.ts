import type { ExtractionResult } from '../../types';
import { collectNumbers } from '../heuristics';

export function extractFromJson(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = JSON.parse(text);
		return {
			success: true,
			numbers: collectNumbers(parsed, { coerceStrings: false }),
			errors: Object.freeze([]),
		};
	} catch (error) {
		return {
			success: false,
			numbers: Object.freeze([]),
			errors: Object.freeze([
				{
					type: 'parse-error',
					message: `Failed to parse JSON: ${(error as Error).message}`,
					filepath,
				},
			]),
		};
	}
}
