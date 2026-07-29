import * as ini from 'ini';
import type { ExtractionResult } from '../../types';
import { collectNumbers } from '../heuristics';

export function extractFromIni(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const parsed = ini.parse(text);
		return {
			success: true,
			// INI values are inherently strings; numeric-looking values
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
					message: `Failed to parse INI: ${(error as Error).message}`,
					filepath,
				},
			]),
		};
	}
}
