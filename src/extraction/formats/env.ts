import { parse } from 'dotenv';
import type { ExtractionResult } from '../../types';
import { errorMessage } from '../../utils/errors';
import { collectNumbers } from '../heuristics';

export function extractFromEnv(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = parse(text);
		return {
			success: true,
			// .env values are inherently strings; numeric-looking values
			// are numbers here, unlike in JSON/YAML/TOML.
			numbers: collectNumbers(parsed, { coerceStrings: true }),
			errors: Object.freeze([]),
		};
	} catch (error) {
		return {
			success: false,
			numbers: Object.freeze([]),
			errors: Object.freeze([
				{
					type: 'parse-error',
					message: `Failed to parse .env: ${errorMessage(error)}`,
					filepath,
				},
			]),
		};
	}
}
