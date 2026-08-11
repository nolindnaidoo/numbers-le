/**
 * Fails when the extension's number extraction drifts from the shared
 * corpus, which the Rust CLI (crate/) also builds against.
 *
 * - extraction.json `documents`: every number each extractor finds in a
 *   corpus document, in document order, **as text**.
 * - extraction.json `rendering`: how a number is printed. JavaScript and
 *   Rust agree on the value of an IEEE-754 double and disagree on its
 *   string, so the boundaries of ECMAScript's Number::toString are
 *   pinned here in both directions — the last decimal before exponential
 *   notation takes over, and the first exponential after it.
 * - mcp-extract-numbers.json: the `extract_numbers` tool, which BOTH MCP
 *   servers offer and must answer identically.
 *
 * This checks only the extension's side. `cargo test` runs the crate's
 * implementation over the same files.
 *
 * Run: bun scripts/check-extraction-parity.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractNumber } from '../src/extraction/extract';
import { TOOLS } from '../src/mcp/tools';

const ROOT = join(import.meta.dir, '..');
/** The corpus lives inside the crate so the published package is self-contained. */
const CORPUS = join(ROOT, 'crate', 'fixtures');
const failures: string[] = [];

function fail(message: string): void {
	failures.push(message);
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	if (a === null || b === null) return false;
	const keysA = Object.keys(a).sort();
	const keysB = Object.keys(b).sort();
	if (!deepEqual(keysA, keysB)) return false;
	return keysA.every((key) =>
		deepEqual(
			(a as Record<string, unknown>)[key],
			(b as Record<string, unknown>)[key],
		),
	);
}

function readCorpus(name: string): unknown {
	return JSON.parse(readFileSync(join(CORPUS, name), 'utf8'));
}

function readDocument(name: string): string {
	return readFileSync(join(CORPUS, 'documents', name), 'utf8');
}

interface DocumentCase {
	readonly name: string;
	readonly file: string;
	readonly fileType: string;
	readonly expected: readonly string[];
	readonly errors: readonly string[];
}

interface RenderCase {
	/**
	 * The source token, as text a document could hold.
	 *
	 * Deliberately not a JSON number. The crate reads this corpus too,
	 * and serde_json's float parsing is not correctly rounded for every
	 * token — a corpus of numbers would have been testing the reader
	 * rather than the rendering.
	 */
	readonly input: string;
	readonly expected: string;
}

function checkDocuments(): void {
	const corpus = readCorpus('extraction.json') as {
		documents: readonly DocumentCase[];
		rendering: readonly RenderCase[];
	};
	if (corpus.documents.length === 0) fail('the corpus has no documents');

	for (const testCase of corpus.documents) {
		const result = extractNumber(
			readDocument(testCase.file),
			// biome-ignore lint/suspicious/noExplicitAny: the corpus stores the file type as text
			testCase.fileType as any,
			testCase.file,
		);
		const actual = [...result.numbers].map(String);
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`document "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
		const failed = result.errors.length > 0;
		if (failed !== testCase.errors.length > 0) {
			fail(
				`document "${testCase.name}": expected ${testCase.errors.length > 0 ? 'a parse failure' : 'a clean parse'}, got the other`,
			);
		}
	}

	if (corpus.rendering.length === 0) fail('the corpus pins no rendering');
	for (const testCase of corpus.rendering) {
		const actual = String(Number(testCase.input));
		if (actual !== testCase.expected) {
			fail(
				`rendering ${testCase.input}: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`,
			);
		}
	}
}

/**
 * `extract_numbers` is offered by BOTH MCP servers. They are meant to be
 * the same tool, not two similar ones, so the same corpus runs against
 * both: this function here, and `crate/src/mcp/extract.rs`'s own test
 * there.
 */
async function checkMcpExtractNumbers(): Promise<void> {
	const cases = readCorpus('mcp-extract-numbers.json') as ReadonlyArray<{
		name: string;
		file?: string;
		content?: string;
		arguments: Record<string, unknown>;
		expected?: unknown;
		expectedError?: string;
	}>;

	const tool = TOOLS.find((t) => t.name === 'extract_numbers');
	if (!tool) {
		fail('the extension no longer offers extract_numbers');
		return;
	}

	for (const testCase of cases) {
		const args: Record<string, unknown> = { ...testCase.arguments };
		if (testCase.file !== undefined) args.content = readDocument(testCase.file);
		else if (testCase.content !== undefined) args.content = testCase.content;

		if (testCase.expectedError !== undefined) {
			try {
				await tool.handler(args);
				fail(
					`mcp extract "${testCase.name}": expected it to fail with ${JSON.stringify(testCase.expectedError)}`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message !== testCase.expectedError) {
					fail(
						`mcp extract "${testCase.name}": expected error ${JSON.stringify(testCase.expectedError)}, got ${JSON.stringify(message)}`,
					);
				}
			}
			continue;
		}

		const actual = await tool.handler(args);
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`mcp extract "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
		// The envelope is compared as JSON *text* as well, because a
		// number's token is the contract here: 1e+21 and 1e21 are the
		// same double and different bytes, and only one of them is what
		// the other server writes.
		if (
			JSON.stringify(actual) !== JSON.stringify(testCase.expected)
		) {
			fail(
				`mcp extract "${testCase.name}": the values agree and the text does not — a number is being printed differently`,
			);
		}
	}
}

checkDocuments();
await checkMcpExtractNumbers();

if (failures.length > 0) {
	console.error(`Extraction parity FAILED (${failures.length}):\n`);
	for (const failure of failures) {
		console.error(`- ${failure}\n`);
	}
	process.exit(1);
}
console.log(
	'OK: every corpus case reproduces under the extension, and both MCP servers agree.',
);
