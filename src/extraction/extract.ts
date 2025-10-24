import type { ExtractionResult, FileType } from '../types';
import { extractNumbersFromCsvSync } from './formats/csv';
import { extractNumbersFromEnv } from './formats/env';
import { extractNumbersFromIni } from './formats/ini';
import { extractNumbersFromJson } from './formats/json';
import { extractNumbersFromToml } from './formats/toml';
import { extractNumbersFromYaml } from './formats/yaml';

export function extractNumbers(
	text: string,
	fileType: FileType,
	filepath: string,
): ExtractionResult {
	switch (fileType) {
		case 'json':
			return extractNumbersFromJson(text, filepath);
		case 'yaml':
			return extractNumbersFromYaml(text, filepath);
		case 'yml':
			return extractNumbersFromYaml(text, filepath);
		case 'csv':
			return extractNumbersFromCsvSync(text, filepath);
		case 'toml':
			return extractNumbersFromToml(text, filepath);
		case 'ini':
			return extractNumbersFromIni(text, filepath);
		case 'env':
			return extractNumbersFromEnv(text, filepath);
		default:
			return extractNumbersFromFallback(text, filepath);
	}
}

function extractNumbersFromFallback(
	text: string,
	_filepath: string,
): ExtractionResult {
	// Fallback: extract numbers using regex
	const numberRegex = /-?\d+\.?\d*/g;
	const matches = text.match(numberRegex);
	const numbers = matches
		? matches.map(Number).filter((n) => !Number.isNaN(n) && Number.isFinite(n))
		: [];

	return {
		success: true,
		numbers: Object.freeze(numbers),
		errors: Object.freeze([]),
	};
}

export function detectFileType(filename: string): FileType {
	const ext = filename.split('.').pop()?.toLowerCase();

	switch (ext) {
		case 'json':
			return 'json';
		case 'yaml':
		case 'yml':
			return 'yaml';
		case 'csv':
			return 'csv';
		case 'toml':
			return 'toml';
		case 'ini':
			return 'ini';
		case 'env':
			return 'env';
		default:
			return 'unknown';
	}
}
