import * as toml from '@iarna/toml';
import type { ExtractionResult } from '../../types';
import { errorMessage } from '../../utils/errors';
import { collectNumbers } from '../heuristics';

export function extractFromToml(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = toml.parse(text);
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
					message: `Failed to parse TOML: ${errorMessage(error)}`,
					filepath,
				},
			]),
		};
	}
}
