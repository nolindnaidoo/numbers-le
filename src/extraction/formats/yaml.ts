import * as yaml from 'js-yaml';
import type { ExtractionResult, NumberFinding } from '../../types';
import { errorMessage } from '../../utils/errors';
import { collectNumbers } from '../heuristics';

export function extractFromYaml(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const numbers: NumberFinding[] = [];
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
					message: `Failed to parse YAML: ${errorMessage(error)}`,
					filepath,
				},
			]),
		};
	}
}
