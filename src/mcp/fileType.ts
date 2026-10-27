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
 *
 * A `Map`, not a plain object: on an object, `constructor`, `__proto__` and
 * every other `Object.prototype` name is a hit, and a caller naming one got
 * a function or the prototype back as its file type. A map has no inherited
 * keys.
 */
const ALIASES: ReadonlyMap<string, FileType> = new Map([
	['json', 'json'],
	['jsonc', 'jsonc'],
	['yaml', 'yaml'],
	['yml', 'yaml'],
	['csv', 'csv'],
	['tsv', 'tsv'],
	['toml', 'toml'],
	['ini', 'ini'],
	['env', 'env'],
	['dotenv', 'env'],
	['python', 'python'],
	['py', 'python'],
	['rust', 'rust'],
	['rs', 'rust'],
	['go', 'go'],
	['java', 'java'],
	['kotlin', 'kotlin'],
	['kt', 'kotlin'],
	['kts', 'kotlin'],
	['csharp', 'csharp'],
	['cs', 'csharp'],
	['cpp', 'cpp'],
	['cc', 'cpp'],
	['cxx', 'cpp'],
	['hpp', 'cpp'],
	['hh', 'cpp'],
	['c', 'c'],
	['h', 'c'],
	['javascript', 'javascript'],
	['js', 'javascript'],
	['mjs', 'javascript'],
	['cjs', 'javascript'],
	['javascriptreact', 'javascript'],
	['jsx', 'javascript'],
	['typescript', 'typescript'],
	['ts', 'typescript'],
	['typescriptreact', 'typescript'],
	['tsx', 'typescript'],
	['sql', 'sql'],
	['shellscript', 'shellscript'],
	['sh', 'shellscript'],
]);

/** The formats a caller can name, for the tool schema's enum. */
export const SUPPORTED_FORMATS: readonly string[] = Object.freeze([
	'json',
	'jsonc',
	'yaml',
	'csv',
	'tsv',
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

export const FALLBACK_FORMAT: FileType = 'unknown';

/** The extractor key for an already-canonical name, or the text scan. */
export function canonical(format: string): FileType {
	return ALIASES.get(format) ?? FALLBACK_FORMAT;
}

/** Lower-cased, trimmed, and every leading dot dropped, as the crate's `normalise` does. */
function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\.+/, '');
}

/**
 * Resolve a file type from an explicit format, else from a filename, as the
 * crate's `resolve_format` does. The one resolver in this repository: the
 * extension and the npm command line both read through it.
 *
 * Falls back to `unknown`, which the engine handles by scanning the text
 * directly — so a caller who knows nothing about the document still gets its
 * numbers.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): FileType {
	if (format !== undefined) {
		const direct = canonical(normalise(format));
		if (direct !== FALLBACK_FORMAT) return direct;
	}
	if (filename === undefined) return FALLBACK_FORMAT;

	// A dotfile like `.env` has no extension to split on; its whole name is
	// the type.
	const whole = canonical(normalise(filename));
	if (whole !== FALLBACK_FORMAT) return whole;

	// A dotenv file is `.env` and everything after it. Splitting on the last
	// dot asked `local` for a format and sent `.env.local` to the text scan,
	// which has no comment rule, so a commented-out `# POLL=500` became a
	// finding here that the crate's server, reading dotenv, dropped.
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
