import { parse } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';
import type { ExtractionResult, ParseError } from '../../types';
import { errorMessage } from '../../utils/errors';
import { parseStrictNumber } from '../heuristics';

/**
 * All CSV handling goes through csv-parse. v1.x had three hand-rolled
 * splitters (two in this module, one in ui/prompts.ts) that mishandled
 * escaped quotes ("") and disagreed with the streaming path, which
 * silently consumed the first row as a header. Sync and streaming now
 * produce identical results: every row is data, no header inference.
 */
const PARSE_OPTIONS = Object.freeze({
	bom: true,
	columns: false,
	relax_column_count: true,
	relax_quotes: true,
	skip_empty_lines: true,
	trim: true,
});

export function extractFromCsv(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const records = parseSync(text, PARSE_OPTIONS) as string[][];
		const numbers: number[] = [];

		for (const record of records) {
			for (const value of record) {
				const num = parseStrictNumber(value);
				if (num !== undefined) numbers.push(num);
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
					message: `CSV parse error: ${errorMessage(error)}`,
					filepath,
				},
			]),
		};
	}
}

export function extractFromCsvAsync(
	text: string,
	filepath: string,
): Promise<ExtractionResult> {
	return new Promise((resolve) => {
		const numbers: number[] = [];
		const errors: ParseError[] = [];

		const parser = parse(PARSE_OPTIONS);

		parser.on('readable', () => {
			let record: unknown = parser.read();
			while (record !== null) {
				if (Array.isArray(record)) {
					for (const value of record) {
						if (typeof value === 'string') {
							const num = parseStrictNumber(value);
							if (num !== undefined) numbers.push(num);
						}
					}
				}
				record = parser.read();
			}
		});

		parser.on('error', (error) => {
			errors.push({
				type: 'parse-error',
				message: `CSV parse error: ${error.message}`,
				filepath,
			});
		});

		parser.on('end', () => {
			resolve({
				success: errors.length === 0,
				numbers: Object.freeze(numbers),
				errors: Object.freeze(errors),
			});
		});

		parser.write(text);
		parser.end();
	});
}

/** Split a single CSV line into cells with the same parser and options. */
export function parseCsvLine(line: string): readonly string[] {
	try {
		const records = parseSync(line, PARSE_OPTIONS) as string[][];
		return Object.freeze(records[0] ?? []);
	} catch {
		return Object.freeze([]);
	}
}
