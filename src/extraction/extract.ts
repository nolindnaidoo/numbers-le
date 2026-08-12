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

function isSourceLanguage(fileType: FileType): fileType is SourceLanguage {
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
		case 'yaml':
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
	return {
		success: true,
		numbers: scanTextForNumbers(text),
		errors: Object.freeze([]),
	};
}

/**
 * The file type a filename implies.
 *
 * Both a VS Code `languageId` and a file extension resolve through the
 * MCP server's ALIASES; this is the extension-only half, kept in step
 * with it and with the crate's `resolve_format`.
 */
const EXTENSIONS: Readonly<Record<string, FileType>> = Object.freeze({
	json: 'json',
	jsonc: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	csv: 'csv',
	tsv: 'csv',
	toml: 'toml',
	ini: 'ini',
	cfg: 'ini',
	conf: 'ini',
	env: 'env',
	py: 'python',
	rs: 'rust',
	go: 'go',
	java: 'java',
	kt: 'kotlin',
	kts: 'kotlin',
	cs: 'csharp',
	cpp: 'cpp',
	cc: 'cpp',
	cxx: 'cpp',
	hpp: 'cpp',
	hh: 'cpp',
	c: 'c',
	h: 'c',
	js: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	jsx: 'javascript',
	ts: 'typescript',
	tsx: 'typescript',
	sql: 'sql',
	sh: 'shellscript',
});

export function detectFileType(filename: string): FileType {
	const ext = filename.split('.').pop()?.toLowerCase();

	if (!ext) {
		return 'unknown';
	}

	return EXTENSIONS[ext] ?? 'unknown';
}
