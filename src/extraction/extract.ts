import type { ExtractionResult, FileType } from '../types';
import { extractFromCsv } from './formats/csv';
import { extractFromEnv } from './formats/env';
import { extractFromIni } from './formats/ini';
import { extractFromJson } from './formats/json';
import { extractFromToml } from './formats/toml';
import { extractFromYaml } from './formats/yaml';

export function extractNumber(
	text: string,
	fileType: FileType,
	filepath: string,
): ExtractionResult {
	switch (fileType) {
		case 'json':
			return extractFromJson(text, filepath);
		case 'yaml':
		case 'yml':
			return extractFromYaml(text, filepath);
		case 'csv':
			return extractFromCsv(text, filepath);
		case 'toml':
			return extractFromToml(text, filepath);
		case 'ini':
			return extractFromIni(text, filepath);
		case 'env':
			return extractFromEnv(text, filepath);
		case 'unknown':
			return extractFromFallback(text, filepath);
		default:
			return extractFromFallback(text, filepath);
	}
}

function extractFromFallback(
	text: string,
	_filepath: string,
): ExtractionResult {
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

	if (!ext) {
		return 'unknown';
	}

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
