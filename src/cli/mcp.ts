/**
 * `numbers-le mcp`: the crate's MCP server (`crate/src/mcp/`), not the
 * extension's. It offers `numbers_le_scan` beside the shared
 * `extract_numbers`, answers in the crate's words, and writes its replies in
 * serde_json's key order: a struct keeps its field order, and anything the
 * crate builds as a `serde_json::Value` has its keys sorted, because the crate
 * builds without `preserve_order`.
 */

import { isSourceLanguage } from '../extraction/extract';
import { SUPPORTED_FORMATS } from '../mcp/fileType';
import { resolveFormat } from './format';
import { requests } from './frames';
import { examine } from './locate';
import { readTree, sum } from './run';

const PROTOCOL_VERSION = '2025-06-18';
const INVALID_PARAMS = -32602;
const METHOD_NOT_FOUND = -32601;
const DEFAULT_MAX_RESULTS = 500;
const MAX_MAX_RESULTS = 5000;

type Handled =
	| { readonly result: unknown }
	| { readonly error: { readonly code: number; readonly message: string } };

type Diagnostic = Readonly<{ code: string; message: string; severity: string }>;

const EXTRACT_DEFINITION = sorted({
	name: 'extract_numbers',
	description:
		'Extract every numeric value from a document. Parses JSON, YAML, CSV, TOML, INI and dotenv, and reads numeric literals in Python, Rust, Go, Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL and shell — including hex, binary, octal, digit separators and type suffixes. Anything else is scanned as plain text, so a format is optional. Returns each number with the notation it was written in, in document order, and its 1-based line and column where the source says exactly where it is: JSON, the source languages and plain text. Parsed formats (YAML, TOML, CSV, INI, dotenv) carry no position.',
	inputSchema: {
		type: 'object',
		properties: {
			content: { type: 'string', description: 'The document text to scan.' },
			format: {
				type: 'string',
				enum: SUPPORTED_FORMATS,
				description:
					'Document format. Optional — an unrecognised or absent format scans the text directly.',
			},
			filename: {
				type: 'string',
				description:
					'Filename used to infer the format when `format` is absent, e.g. "config.toml".',
			},
			dedupe: {
				type: 'boolean',
				default: false,
				description: 'Collapse repeated values to their first occurrence.',
			},
			maxResults: {
				type: 'integer',
				minimum: 1,
				maximum: MAX_MAX_RESULTS,
				default: DEFAULT_MAX_RESULTS,
				description: `Cap on returned numbers (default ${DEFAULT_MAX_RESULTS}). meta.truncated reports whether any were dropped.`,
			},
		},
		required: ['content'],
		additionalProperties: false,
	},
});

const SCAN_DEFINITION = sorted({
	name: 'numbers_le_scan',
	description:
		'Extract every number from files or directories, with the file it came from and, where it can be located, its line and column. Reads the filesystem; never writes to it, and never judges a number.',
	inputSchema: {
		type: 'object',
		properties: {
			path: { type: 'string', description: 'a file or directory to read' },
			paths: {
				type: 'array',
				items: { type: 'string' },
				description: 'several files or directories, instead of `path`',
			},
			format: {
				type: 'string',
				description:
					'Force a format for every file instead of inferring one per file name. An unrecognised name falls back to the text scan, named `unknown`.',
			},
			dedupe: {
				type: 'boolean',
				default: false,
				description: 'Collapse repeated values to their first occurrence.',
			},
			hidden: {
				type: 'boolean',
				default: false,
				description: 'Walk hidden files and directories too.',
			},
			ignored: {
				type: 'boolean',
				default: false,
				description: 'Walk files excluded by .gitignore too.',
			},
		},
	},
});

/**
 * Serves until stdin closes, one request at a time, in order, over the
 * crate's framing in `frames.ts`.
 */
export async function serve(
	input: AsyncIterable<Uint8Array>,
	write: (line: string) => void,
	version: string,
): Promise<number> {
	for await (const request of requests(input)) {
		const response = handle(request, version);
		if (response !== undefined) write(`${response}\n`);
	}
	return 0;
}

function field(value: unknown, name: string): unknown {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}
	return Object.hasOwn(value, name)
		? (value as Record<string, unknown>)[name]
		: undefined;
}

function handle(request: unknown, version: string): string | undefined {
	const id = field(request, 'id');
	const method = field(request, 'method');
	if (typeof method !== 'string') return undefined;
	// A notification carries no id and gets no reply.
	if (id === undefined) return undefined;

	// The id is echoed as the `serde_json::Value` it was parsed into.
	const echoed = sorted(id);
	const handled = dispatch(method, field(request, 'params'), version);
	if ('error' in handled) {
		return JSON.stringify({ jsonrpc: '2.0', id: echoed, error: handled.error });
	}
	return JSON.stringify({ jsonrpc: '2.0', id: echoed, result: handled.result });
}

function dispatch(method: string, params: unknown, version: string): Handled {
	if (method === 'initialize') {
		return {
			result: sorted({
				protocolVersion: PROTOCOL_VERSION,
				capabilities: { tools: {} },
				serverInfo: { name: 'numbers-le', version },
			}),
		};
	}
	if (method === 'tools/list') {
		return { result: { tools: [EXTRACT_DEFINITION, SCAN_DEFINITION] } };
	}
	if (method === 'tools/call') return callTool(params);
	if (method === 'ping') return { result: {} };
	return {
		error: {
			code: METHOD_NOT_FOUND,
			message: `this server does not implement ${method}`,
		},
	};
}

/**
 * Protocol failures are JSON-RPC errors. A tool that fails on its arguments
 * returns a result carrying `isError`, so a model reads the reason rather than
 * concluding the server is broken.
 */
function callTool(params: unknown): Handled {
	if (params === undefined) {
		return {
			error: { code: INVALID_PARAMS, message: 'no tool call was supplied' },
		};
	}
	const name = field(params, 'name');
	if (typeof name !== 'string') {
		return {
			error: { code: INVALID_PARAMS, message: 'the tool call named no tool' },
		};
	}
	const args = field(params, 'arguments') ?? {};
	if (name === 'extract_numbers')
		return { result: outcome(() => extract(args)) };
	if (name === 'numbers_le_scan') return { result: outcome(() => scan(args)) };
	return {
		error: {
			code: INVALID_PARAMS,
			message: `this server offers no tool named ${name}`,
		},
	};
}

function outcome(tool: () => unknown): unknown {
	let envelope: unknown;
	try {
		envelope = tool();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { content: [{ text: message, type: 'text' }], isError: true };
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
		structuredContent: envelope,
		isError: false,
	};
}

function extract(args: unknown): unknown {
	const content = field(args, 'content');
	if (typeof content !== 'string') {
		throw new Error('content is required and must be a string');
	}
	const maxResults = readMaxResults(args);
	const format = resolveFormat(
		stringField(args, 'format'),
		stringField(args, 'filename'),
	);
	const { found, parseError } = examine(content, format);
	// Placed only where the source says exactly where a number is. The parsed
	// formats hand over resolved values, and placing one would be a search
	// for its digits that can land in a key.
	const exact =
		format === 'json' || format === 'unknown' || isSourceLanguage(format);
	const numbers = found.map((item) => {
		const finding = { value: Number(item.value), notation: item.notation };
		if (!exact || item.position === null) return finding;
		return { ...finding, ...item.position };
	});
	// Deduplication is by value, never by notation: `0xFF` and `255` are one
	// number written twice.
	const kept = field(args, 'dedupe') === true ? firstOfEach(numbers) : numbers;
	const truncated = kept.length > maxResults;
	const items = kept.slice(0, maxResults);
	const diagnostics: Diagnostic[] =
		parseError === null
			? []
			: [{ code: 'parse-error', message: parseError, severity: 'error' }];
	return envelope(
		'extract_numbers',
		{ numbers: items, fileType: format },
		items.length,
		diagnostics,
		truncated,
	);
}

/**
 * Clamp quietly, reject loudly. A whole number of one or more, however it
 * was written: `2.0`, `1e3` and `1E20` are caps, as JSON Schema's `integer`
 * reads them and as the crate's server reads them.
 */
function readMaxResults(args: unknown): number {
	if (!hasField(args, 'maxResults')) return DEFAULT_MAX_RESULTS;
	const raw = field(args, 'maxResults');
	if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
		throw new Error('maxResults must be a positive integer');
	}
	return Math.min(raw, MAX_MAX_RESULTS);
}

function firstOfEach<T extends { readonly value: number }>(
	items: readonly T[],
): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const token = String(item.value);
		if (seen.has(token)) return false;
		seen.add(token);
		return true;
	});
}

function scan(args: unknown): unknown {
	const inputs = requestedPaths(args);
	const flag = (name: string): boolean => field(args, name) === true;
	const format = stringField(args, 'format');
	const { reports, binary } = readTree(inputs, {
		scan: {
			dedupe: flag('dedupe'),
			format: format === undefined ? null : resolveFormat(format, undefined),
		},
		walk: { hidden: flag('hidden'), respectIgnore: !flag('ignored') },
	});
	const numbers = sum(reports, (report) => report.summary.numbers);
	const unlocated = sum(reports, (report) => report.summary.unlocated);
	const diagnostics: Diagnostic[] = reports
		.filter((report) =>
			report.diagnostics.some((found) => found.severity === 'error'),
		)
		.map((report) =>
			warning(
				'unreadable',
				`${report.file} could not be read, so this scan does not cover it`,
			),
		);
	if (unlocated > 0) {
		// A model treating these positions as a complete index needs to know
		// how much of it is not one.
		diagnostics.push(
			warning(
				'unlocated',
				`${unlocated} values could not be located in their source`,
			),
		);
	}
	return envelope(
		'numbers_le_scan',
		sorted({
			reports,
			numbers,
			binaryFiles: binary,
		}),
		reports.length,
		diagnostics,
		false,
	);
}

function requestedPaths(args: unknown): readonly string[] {
	const path = field(args, 'path');
	if (typeof path === 'string') return [path];
	if (path !== undefined) throw new Error('path must be a string');
	const paths = field(args, 'paths');
	if (!Array.isArray(paths)) {
		throw new Error('no file or directory was supplied to read');
	}
	// An entry that is not a string is named rather than dropped: `["dir", 7]`
	// was answered for `dir` alone and the 7 vanished without a word.
	const index = paths.findIndex((item) => typeof item !== 'string');
	if (index !== -1) throw new Error(`entry ${index} of paths is not a string`);
	if (paths.length === 0) throw new Error('the list of paths was empty');
	return paths as readonly string[];
}

/** The crate's `Envelope` struct, in its field order. */
function envelope(
	tool: string,
	data: unknown,
	count: number,
	diagnostics: readonly Diagnostic[],
	truncated: boolean,
): unknown {
	return {
		ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
		data,
		diagnostics,
		meta: { tool, count, truncated },
	};
}

function warning(code: string, message: string): Diagnostic {
	return { code, message, severity: 'warning' };
}

function stringField(args: unknown, name: string): string | undefined {
	const value = field(args, name);
	return typeof value === 'string' ? value : undefined;
}

function hasField(value: unknown, name: string): boolean {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	return Object.hasOwn(value, name);
}

/** A `serde_json::Value` object: keys in the order of their UTF-8 bytes. */
function sorted<T>(value: T): T {
	if (Array.isArray(value)) return value.map(sorted) as T;
	if (typeof value !== 'object' || value === null) return value;
	const entries = Object.entries(value).sort(([left], [right]) =>
		Buffer.compare(Buffer.from(left), Buffer.from(right)),
	);
	return Object.fromEntries(
		entries.map(([key, item]) => [key, sorted(item)]),
	) as T;
}
