/**
 * The crate's `csv.rs`: the blanks around quoted fields trimmed, then the
 * csv crate's records, flexible and headerless. Every cell that reads
 * strictly as a number is one.
 */

import { csvRows, trimAroundQuotes } from '../../parsers/csv';
import type { ExtractionResult } from '../../types';
import { parseStrictNumber } from '../heuristics';
import { answer } from './typed';

export function extractFromCsv(
	text: string,
	filepath: string,
	delimiter = ',',
): ExtractionResult {
	const trimmed = trimAroundQuotes(text);
	if (trimmed === undefined)
		return answer(
			[],
			'Failed to parse CSV: quoted field is never closed',
			filepath,
		);
	const numbers = csvRows(trimmed, delimiter)
		.flat()
		.flatMap((cell) => parseStrictNumber(cell) ?? []);
	return answer(numbers, undefined, filepath);
}

/** The first record's cells, for the column picker; empty when none parse. */
export function parseCsvLine(line: string): readonly string[] {
	const trimmed = trimAroundQuotes(line);
	if (trimmed === undefined) return Object.freeze([]);
	return Object.freeze(csvRows(trimmed, ',')[0] ?? []);
}
