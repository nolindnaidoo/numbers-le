import type { FileType } from '../types';

/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * Unlike the rest of the family, an unresolved format is not an error here: the
 * engine falls back to scanning plain text for numbers, which is a useful
 * answer rather than an empty one. So this resolver always returns a FileType,
 * and `unknown` is the deliberate default rather than a failure.
 */

/**
 * Every file type the engine parses, keyed by what a caller might send.
 *
 * Both a VS Code `languageId` and a file extension appear here, because
 * an agent sends whichever it has. Held byte-for-byte equal to the Rust
 * CLI's `ALIASES`: a languageId one server accepts and the other refuses
 * makes `extract_numbers` two different tools.
 */
const ALIASES: Readonly<Record<string, FileType>> = Object.freeze({
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
	dotenv: 'env',
	python: 'python',
	py: 'python',
	rust: 'rust',
	rs: 'rust',
	go: 'go',
	java: 'java',
	kotlin: 'kotlin',
	kt: 'kotlin',
	kts: 'kotlin',
	csharp: 'csharp',
	cs: 'csharp',
	cpp: 'cpp',
	cc: 'cpp',
	cxx: 'cpp',
	hpp: 'cpp',
	hh: 'cpp',
	c: 'c',
	h: 'c',
	javascript: 'javascript',
	js: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	javascriptreact: 'javascript',
	jsx: 'javascript',
	typescript: 'typescript',
	ts: 'typescript',
	typescriptreact: 'typescript',
	tsx: 'typescript',
	sql: 'sql',
	shellscript: 'shellscript',
	sh: 'shellscript',
});

/** The formats a caller can name, for the tool schema's enum. */
export const SUPPORTED_FORMATS: readonly string[] = Object.freeze([
	'json',
	'yaml',
	'csv',
	'toml',
	'ini',
	'env',
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

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a file type from an explicit format, else from a filename.
 *
 * Falls back to `unknown`, which the engine handles by scanning the text
 * directly — so a caller who knows nothing about the document still gets its
 * numbers.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): FileType {
	if (format) {
		const direct = ALIASES[normalise(format)];
		if (direct) return direct;
	}

	if (filename) {
		// A dotfile like `.env` has no extension to split on; its whole name is
		// the type.
		const bare = normalise(filename);
		const whole = ALIASES[bare.startsWith('.') ? bare.slice(1) : bare];
		if (whole) return whole;

		const extension = filename.includes('.')
			? filename.slice(filename.lastIndexOf('.') + 1)
			: '';
		const inferred = ALIASES[normalise(extension)];
		if (inferred) return inferred;
	}

	return 'unknown';
}
