/**
 * Which extractor reads a document, as the Rust CLI's `extract/format.rs`
 * resolves it.
 *
 * Not the MCP server's `resolveFormat`: the crate reads `.env.local`,
 * `.env.production` and their siblings as dotenv, and the extension's
 * resolver splits on the last dot and falls to the text scan. Both binaries
 * install as `numbers-le`, so this one follows the crate.
 */
import type { FileType } from '../types';

const ALIASES: Readonly<Record<string, FileType>> = Object.freeze({
	json: 'json',
	jsonc: 'jsonc',
	yaml: 'yaml',
	yml: 'yaml',
	csv: 'csv',
	tsv: 'tsv',
	toml: 'toml',
	ini: 'ini',
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

export const FALLBACK_FORMAT: FileType = 'unknown';

/** The extractor key for an already-canonical name, or the text scan. */
export function canonical(format: string): FileType {
	return Object.hasOwn(ALIASES, format)
		? (ALIASES[format] as FileType)
		: FALLBACK_FORMAT;
}

/** Lower-cased, trimmed, and every leading dot dropped, as `normalise` does. */
function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\.+/, '');
}

/** An explicit format, else the file name, else the text scan. */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): FileType {
	if (format !== undefined) {
		const direct = canonical(normalise(format));
		if (direct !== FALLBACK_FORMAT) return direct;
	}
	if (filename === undefined) return FALLBACK_FORMAT;
	const whole = canonical(normalise(filename));
	if (whole !== FALLBACK_FORMAT) return whole;
	if (isDotenv(filename.trim().toLowerCase())) return 'env';
	const dot = filename.lastIndexOf('.');
	if (dot === -1) return FALLBACK_FORMAT;
	return canonical(normalise(filename.slice(dot + 1)));
}

/**
 * `.env` and every suffix of it, and `<name>.env`. The leading dot is the
 * signal, which is why `env.ts` stays TypeScript and `.envrc` stays a shell
 * script.
 */
function isDotenv(name: string): boolean {
	if (name === '.env' || name === 'env') return true;
	if (name.startsWith('.env.')) return true;
	return name.endsWith('.env') && name.length > '.env'.length;
}
