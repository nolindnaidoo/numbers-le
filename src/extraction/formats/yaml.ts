import * as yaml from 'js-yaml';
import type { ExtractionResult } from '../../types';
import { collectNumbers } from '../heuristics';

export function extractFromYaml(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const numbers: number[] = [];
		// loadAll handles both single documents and `---`-separated
		// multi-document streams (load() rejects the latter outright).
		for (const doc of yaml.loadAll(text)) {
			numbers.push(...collectNumbers(doc, { coerceStrings: false }));
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
					message: `Failed to parse YAML: ${(error as Error).message}`,
					filepath,
				},
			]),
		};
	}
}
