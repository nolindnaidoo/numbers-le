import { resolveFormat } from '../mcp/fileType';
import type { ExtractionResult, FileType, SourceLanguage } from '../types';
import { extractFromCsv } from './formats/csv';
import { extractFromEnv } from './formats/env';
import { extractFromIni } from './formats/ini';
import { extractFromJson } from './formats/json';
import { extractFromSource } from './formats/source';
import { extractFromToml } from './formats/toml';
import { extractFromYaml } from './formats/yaml';
import { scanTextForNumbers } from './heuristics';

/**
 * The languages read by the numeric-literal extractor.
 *
 * Held equal to the Rust CLI's `SOURCE_FORMATS` by the shared corpus: a
 * language one side routes to the literal reader and the other to the
 * text scan is two tools answering differently for the same file.
 */
const SOURCE_LANGUAGES: readonly SourceLanguage[] = Object.freeze([
	'python',
	'rust',
	'go',
	'java',
	'kotlin',
	'csharp',
	'cpp',
	'c',
	'javascript',
	'typescript',
	'sql',
	'shellscript',
]);

export function isSourceLanguage(
	fileType: FileType,
): fileType is SourceLanguage {
	return (SOURCE_LANGUAGES as readonly string[]).includes(fileType);
}

export function extractNumber(
	text: string,
	fileType: FileType,
	filepath: string,
): ExtractionResult {
	if (isSourceLanguage(fileType)) {
		return extractFromSource(text, fileType);
	}

	switch (fileType) {
		case 'json':
			return extractFromJson(text, filepath);
		case 'jsonc':
			return extractFromJson(text, filepath, true);
		case 'yaml':
			return extractFromYaml(text, filepath);
		case 'csv':
			return extractFromCsv(text, filepath);
		case 'tsv':
			return extractFromCsv(text, filepath, '\t');
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
	return {
		success: true,
		numbers: scanTextForNumbers(text),
		errors: Object.freeze([]),
	};
}

/**
 * The file type a filename implies: the basename, through the one resolver
 * the MCP server and the npm command line read with. A second table here
 * split `.env.local` on its last dot and asked `local` for a format, so a
 * file the other two surfaces read as dotenv prompted for a type.
 *
 * The basename is taken on both separators, because the editor hands a
 * Windows path with backslashes whatever platform this runs on in a test.
 */
export function detectFileType(filename: string): FileType {
	const name = filename.split(/[\\/]/).pop() ?? '';
	return resolveFormat(undefined, name);
}
