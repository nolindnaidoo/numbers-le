import { parse } from 'csv-parse';
import type { ExtractionResult, ParseError } from '../../types';

export function extractFromCsv(
	text: string,
	filepath: string,
): ExtractionResult {
	try {
		const records = parseCsvRecord(text);
		const numbers: number[] = [];

		for (const record of records) {
			for (const value of record) {
				const num = parseFloat(value);
				if (!Number.isNaN(num) && Number.isFinite(num)) {
					numbers.push(num);
				}
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
					message: `CSV parse error: ${(error as Error).message}`,
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

		const parser = parse({
			columns: true,
			skip_empty_lines: true,
			trim: true,
		});

		parser.on('readable', () => {
			let record: unknown = parser.read();
			while (record !== null) {
				if (typeof record === 'object' && record !== null) {
					for (const value of Object.values(record)) {
						if (typeof value === 'string') {
							const num = parseFloat(value);
							if (!Number.isNaN(num) && Number.isFinite(num)) {
								numbers.push(num);
							}
						} else if (typeof value === 'number' && !Number.isNaN(value)) {
							numbers.push(value);
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

function parseCsvRecord(text: string): readonly (readonly string[])[] {
	const records: string[][] = [];
	let currentRecord: string[] = [];
	let currentField = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			currentRecord.push(currentField.trim());
			currentField = '';
		} else if (char === '\n' && !inQuotes) {
			currentRecord.push(currentField.trim());
			if (currentRecord.some((field) => field.length > 0)) {
				records.push(currentRecord);
			}
			currentRecord = [];
			currentField = '';
		} else {
			currentField += char;
		}
	}

	currentRecord.push(currentField.trim());
	if (currentRecord.some((field) => field.length > 0)) {
		records.push(currentRecord);
	}

	return records;
}

export function parseCsvLine(line: string): readonly string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}
