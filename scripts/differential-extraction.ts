/**
 * Generated differential testing of the **shared** `extract_numbers` MCP
 * tool, across both servers.
 *
 * One tool name, one schema, two servers: an agent asking for
 * `extract_numbers` must get the same answer whichever server it reaches.
 * That is the contract this protects. It is deliberately NOT a comparison
 * of the CLI against the extension — those are different surfaces, one
 * terminal-first and one IDE-first, and they are meant to differ.
 *
 * `crate/fixtures/` pins the cases somebody thought of. This generates
 * the ones nobody did: every literal shape crossed with every language
 * that reads it differently, crossed with the wrappers a literal turns up
 * inside. Its reason for existing is the per-language dialect rules,
 * which are the easiest thing here to get subtly different on two sides:
 *
 *   - `0755` is 493 in C, C++, Go and Java, and 755 in Rust, Python,
 *     Kotlin and C#
 *   - `1_000` is one thousand in Rust and the number 1 in C
 *   - `123n` is a BigInt in JavaScript and TypeScript and nowhere else
 *
 * Three things are asserted per document:
 *
 *   1. both servers agree, envelope for envelope (key order aside — the
 *      two serializers order keys differently and neither is the
 *      contract);
 *   2. both emit the same number **token**, byte for byte, because
 *      `1e+21` and `1e21` are the same double and different bytes;
 *   3. the notation each reports is how the literal was **written**,
 *      checked against this file's own table rather than against either
 *      implementation — a value can be right while the notation lies.
 *
 * Generated cases stay inside the space where the two are contractually
 * identical. The sanctioned divergences — `@iarna/toml` being TOML 0.5
 * where the `toml` crate is 1.0, above all — are pinned by hand in
 * `crate/fixtures/` and listed in `crate/SPEC.md`; generating around them
 * would be generating known-red cases.
 *
 * Run: bun scripts/differential-extraction.ts
 * Env: DIFFERENTIAL_SEED (default 20260812), NUMBERS_LE_BIN
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS } from '../src/mcp/tools';

const ROOT = join(import.meta.dir, '..');
const SEED = Number(process.env.DIFFERENTIAL_SEED ?? 20260812);

type Notation =
	| 'decimal'
	| 'hex'
	| 'binary'
	| 'octal'
	| 'scientific'
	| 'bigint';

/** What this file expects a planted literal to come back as. */
type Expected = Readonly<{ value: number; notation: Notation }>;

/** The three ways a language changes what a literal means. */
type Dialect = Readonly<{
	separator: string | undefined;
	legacyOctal: boolean;
	bigint: boolean;
}>;

const DIALECTS: Readonly<Record<string, Dialect>> = {
	python: { separator: '_', legacyOctal: false, bigint: false },
	rust: { separator: '_', legacyOctal: false, bigint: false },
	kotlin: { separator: '_', legacyOctal: false, bigint: false },
	csharp: { separator: '_', legacyOctal: false, bigint: false },
	go: { separator: '_', legacyOctal: true, bigint: false },
	java: { separator: '_', legacyOctal: true, bigint: false },
	javascript: { separator: '_', legacyOctal: false, bigint: true },
	typescript: { separator: '_', legacyOctal: false, bigint: true },
	c: { separator: "'", legacyOctal: true, bigint: false },
	cpp: { separator: "'", legacyOctal: true, bigint: false },
	sql: { separator: undefined, legacyOctal: false, bigint: false },
	shellscript: { separator: undefined, legacyOctal: false, bigint: false },
};

/**
 * A literal, and what it means once the dialect is known.
 *
 * `expect` returning an empty list means the run is consumed and nothing
 * is reported — an overflow, or base-prefixed digits past 128 bits. Not a
 * miss: the scan must not re-enter the run and report the digits inside.
 *
 * It returns a list rather than one finding because a separator the
 * language does not have splits a literal in two: `1'000` is one thousand
 * in C++ and the number 1 beside the number 0 everywhere else.
 */
type Literal = Readonly<{
	token: string;
	expect: (dialect: Dialect) => readonly Expected[];
}>;

const decimal = (value: number): Expected => ({ value, notation: 'decimal' });
const one = (value: number): readonly Expected[] => [decimal(value)];

/** A leading zero is octal only where the language says so. */
const zero = (dialect: Dialect): Expected =>
	dialect.legacyOctal ? { value: 0, notation: 'octal' } : decimal(0);

const SOURCE_LITERALS: readonly Literal[] = [
	{ token: '0', expect: () => one(0) },
	{ token: '42', expect: () => one(42) },
	{ token: '8080', expect: () => one(8080) },
	{ token: '0.5', expect: () => one(0.5) },
	{ token: '.5', expect: () => one(0.5) },
	{ token: '2.75', expect: () => one(2.75) },
	{ token: '-1.5', expect: () => one(-1.5) },
	{ token: '+7', expect: () => one(7) },
	{ token: '1.5e3', expect: () => [{ value: 1500, notation: 'scientific' }] },
	{ token: '1e-7', expect: () => [{ value: 1e-7, notation: 'scientific' }] },
	{ token: '1E5', expect: () => [{ value: 1e5, notation: 'scientific' }] },
	{ token: '0xFF', expect: () => [{ value: 255, notation: 'hex' }] },
	{ token: '0x1A', expect: () => [{ value: 26, notation: 'hex' }] },
	{ token: '0b1010', expect: () => [{ value: 10, notation: 'binary' }] },
	{ token: '0o755', expect: () => [{ value: 493, notation: 'octal' }] },
	// The value fork. Reading it wrong reports a number the file does not
	// contain, in whichever direction it is wrong.
	{
		token: '0755',
		expect: (dialect) =>
			dialect.legacyOctal ? [{ value: 493, notation: 'octal' }] : one(755),
	},
	{
		token: '0644',
		expect: (dialect) =>
			dialect.legacyOctal ? [{ value: 420, notation: 'octal' }] : one(644),
	},
	// `08` is octal in no language here, so a leading zero stays decimal.
	{ token: '08', expect: () => one(8) },
	// A separator in a language that has none is not one: `1_000` there is
	// the number 1 with an identifier stuck to it.
	{
		token: '1_000',
		expect: (dialect) => one(dialect.separator === '_' ? 1000 : 1),
	},
	{
		token: '1_000_000',
		expect: (dialect) => one(dialect.separator === '_' ? 1_000_000 : 1),
	},
	// Where `'` is not a separator it is not part of the literal, so this
	// is the number 1 and then the number 0 — and that second one is
	// octal in the languages where a leading zero says so.
	{
		token: "1'000",
		expect: (dialect) =>
			dialect.separator === "'" ? one(1000) : [decimal(1), zero(dialect)],
	},
	// A suffix is consumed whole, so the scan cannot resume inside it and
	// report the `32` of `10u32`.
	{ token: '10u32', expect: () => one(10) },
	{ token: '100L', expect: () => one(100) },
	{ token: '1.5f', expect: () => one(1.5) },
	{ token: '2.75_f64', expect: () => one(2.75) },
	{
		token: '1.5e3f64',
		expect: () => [{ value: 1500, notation: 'scientific' }],
	},
	// BigInt only in JavaScript and TypeScript; elsewhere `n` is a suffix.
	{
		token: '123n',
		expect: (dialect) =>
			dialect.bigint ? [{ value: 123, notation: 'bigint' }] : one(123),
	},
	{
		token: '0xFFn',
		expect: () => [{ value: 255, notation: 'hex' }],
	},
	// An incomplete exponent belongs to the suffix, not to the number.
	{ token: '1exp', expect: () => one(1) },
	{ token: '1e', expect: () => one(1) },
	// Consumed and not reported: an overflow to infinity, and
	// base-prefixed digits past 128 bits. Never a panic, and never the
	// digits inside coming back as separate numbers.
	{ token: '1e400', expect: () => [] },
	{ token: `0x${'F'.repeat(40)}`, expect: () => [] },
	// A type name is not a number. Under the text scan these were 32 and
	// 64 — numbers no source file contains.
	{ token: 'u32', expect: () => [] },
	{ token: 'sha256', expect: () => [] },
];

/**
 * Where a literal turns up. None of these carries a digit of its own, so
 * the document holds exactly the planted literal and nothing else.
 *
 * `//` reads as a comment in most of these and as nothing in the rest;
 * either way the literal reader takes it, deliberately — a threshold
 * quoted in a comment is exactly as interesting to a reviewer.
 */
type Wrapper = Readonly<{ name: string; wrap: (token: string) => string }>;

const SOURCE_WRAPPERS: readonly Wrapper[] = [
	{ name: 'bare', wrap: (token) => `${token}\n` },
	{ name: 'assigned', wrap: (token) => `const rate = ${token};\n` },
	{ name: 'quoted', wrap: (token) => `const rate = "${token}";\n` },
	{ name: 'in a comment', wrap: (token) => `// the rate is ${token}\n` },
	{ name: 'mid-line', wrap: (token) => `apply(rate, ${token}, scale);\n` },
	{ name: 'at eof without a newline', wrap: (token) => `rate = ${token}` },
];

/** Plain tokens: valid wherever a number can be written, in any format. */
const PLAIN_TOKENS: readonly Readonly<{ token: string; value: number }>[] = [
	{ token: '0', value: 0 },
	{ token: '42', value: 42 },
	{ token: '8080', value: 8080 },
	{ token: '0.0825', value: 0.0825 },
	{ token: '-325', value: -325 },
	{ token: '2.5', value: 2.5 },
	{ token: '1e21', value: 1e21 },
	{ token: '1e-7', value: 1e-7 },
	{ token: '-1.5e3', value: -1500 },
	{ token: '9007199254740993', value: 9007199254740993 },
	{ token: '123456789012345680000', value: 123456789012345680000 },
];

/** Whether a token is written in scientific notation. */
function plainNotation(token: string): Notation {
	return /[eE]/.test(token) ? 'scientific' : 'decimal';
}

type Case = Readonly<{
	name: string;
	format: string;
	content: string;
	expected: readonly Expected[];
}>;

/**
 * Every generated case.
 *
 * Typed formats report `decimal` however the token was written, because
 * their parser resolved it before the numeric policy saw it. Untyped ones
 * keep what the text said. That difference is the notation contract, and
 * generating both sides of it is the point.
 */
function cases(): Case[] {
	const out: Case[] = [];

	for (const [language, dialect] of Object.entries(DIALECTS)) {
		for (const literal of SOURCE_LITERALS) {
			for (const wrapper of SOURCE_WRAPPERS) {
				out.push({
					name: `${language}: ${literal.token} ${wrapper.name}`,
					format: language,
					content: wrapper.wrap(literal.token),
					expected: literal.expect(dialect),
				});
			}
		}
	}

	for (const { token, value } of PLAIN_TOKENS) {
		const written = plainNotation(token);
		// The text scan reads its own runs, so it keeps what they said.
		out.push({
			name: `unknown: ${token} in prose`,
			format: 'unknown',
			content: `the rate ${token} applies\n`,
			expected: [{ value, notation: written }],
		});
		out.push({
			name: `unknown: ${token} at eof without a newline`,
			format: 'unknown',
			content: `rate ${token}`,
			expected: [{ value, notation: written }],
		});

		// Untyped: the value is text this policy parses itself, so the
		// notation is the text's.
		out.push({
			name: `env: ${token}`,
			format: 'env',
			content: `RATE=${token}\n`,
			expected: [{ value, notation: written }],
		});
		out.push({
			name: `env: ${token} quoted`,
			format: 'env',
			content: `RATE="${token}"\n`,
			expected: [{ value, notation: written }],
		});
		out.push({
			name: `ini: ${token}`,
			format: 'ini',
			content: `[section]\nrate = ${token}\n`,
			expected: [{ value, notation: written }],
		});
		out.push({
			name: `csv: ${token}`,
			format: 'csv',
			content: `label,rate\nalpha,${token}\n`,
			expected: [{ value, notation: written }],
		});

		// Typed: the parser resolved the token, so the notation is gone
		// and every one of these is decimal — including the scientific
		// ones, which is the assertion worth generating.
		out.push({
			name: `json: ${token}`,
			format: 'json',
			content: `{"rate": ${token}}\n`,
			expected: [decimal(value)],
		});
		out.push({
			name: `json: ${token} nested`,
			format: 'json',
			content: `{"a":{"b":[${token}]}}\n`,
			expected: [decimal(value)],
		});
		out.push({
			name: `yaml: ${token}`,
			format: 'yaml',
			content: `rate: ${token}\n`,
			expected: [decimal(value)],
		});
		// TOML integers at or above 2^53 are a documented divergence —
		// `@iarna/toml` hands back a JavaScript BigInt there and wraps at
		// i64, the `toml` crate returns an i64 and refuses what does not
		// fit. See "Deliberate divergences" in crate/SPEC.md; generating
		// around it would be generating known-red cases.
		if (Math.abs(value) < 2 ** 53) {
			out.push({
				name: `toml: ${token}`,
				format: 'toml',
				content: `rate = ${token}\n`,
				expected: [decimal(value)],
			});
		}

		// A quoted number in a typed format is data, never a number.
		out.push({
			name: `json: "${token}" is data`,
			format: 'json',
			content: `{"rate": "${token}"}\n`,
			expected: [],
		});
	}

	out.push(...whitespaceCases());
	return out;
}

/**
 * The two characters Rust and JavaScript disagree about calling
 * whitespace.
 *
 * U+FEFF is whitespace to JavaScript and not to Rust; U+0085 is
 * whitespace to Rust and not to JavaScript. Both lead real values in
 * real files — a byte-order mark is what a spreadsheet export and a
 * PowerShell redirect both add — and either one landing on the wrong
 * side of a trim makes a number appear on one server and not the other.
 *
 * It bites hardest through the *format name*: coercion keys off the
 * resolved format, so a name that resolves on one server and falls
 * through on the other makes the two disagree about whether a quoted
 * `"42"` is data.
 */
const BOM = '\u{feff}';
const NEL = '\u{85}';

function whitespaceCases(): Case[] {
	const out: Case[] = [];

	// A format name carrying a mark still resolves, on both servers. The
	// typed formats carry a quoted number as well, because that is what
	// falling through to the text scan changes: coercion keys off the
	// resolved format, so an unresolved name turns data into a finding.
	const named: readonly (readonly [string, string])[] = [
		['json', '{"a": 42, "b": "7"}\n'],
		['toml', 'a = 42\nb = "7"\n'],
		['yaml', 'a: 42\nb: "7"\n'],
		['csv', 'label,42\n'],
		['env', 'RATE=42\n'],
		['ini', '[s]\nrate = 42\n'],
		['rust', 'let a = 42;\n'],
	];
	for (const [format, content] of named) {
		out.push({
			name: `a ${format} name led by a byte-order mark`,
			format: `${BOM}${format}`,
			content,
			expected: [decimal(42)],
		});
	}

	// A value led by one, in every untyped format — the ones where the
	// numeric policy reads the text itself, so the trim is the whole
	// decision.
	for (const [format, wrap] of [
		['env', (value: string) => `RATE=${value}\n`],
		['ini', (value: string) => `[s]\nrate = ${value}\n`],
		['csv', (value: string) => `label,${value}\n`],
	] as const) {
		out.push({
			name: `${format}: a value led by a byte-order mark`,
			format,
			content: wrap(`${BOM}42`),
			expected: [decimal(42)],
		});
		out.push({
			name: `${format}: a value trailed by a byte-order mark`,
			format,
			content: wrap(`42${BOM}`),
			expected: [decimal(42)],
		});
		// U+0085 is not whitespace to JavaScript, so it stays part of
		// the value and the value is not numeric in full.
		//
		// INI is left out: `rust-ini` strips U+0085 from a value before
		// the numeric policy ever sees it and the npm `ini` package does
		// not, which is a difference between two parsers rather than a
		// trim this crate performs. Recorded under "Deliberate
		// divergences" in crate/SPEC.md.
		if (format !== 'ini') {
			out.push({
				name: `${format}: a value led by a next-line character`,
				format,
				content: wrap(`${NEL}42`),
				expected: [],
			});
		}
	}

	return out;
}

/** A seeded shuffle, so an ordering effect cannot hide behind insertion order. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
	let state = seed >>> 0 || 1;
	const next = (): number => {
		state ^= state << 13;
		state >>>= 0;
		state ^= state >> 17;
		state ^= state << 5;
		state >>>= 0;
		return state / 0x1_0000_0000;
	};
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(next() * (i + 1));
		[out[i], out[j]] = [out[j] as T, out[i] as T];
	}
	return out;
}

function binaryPath(): string {
	const override = process.env.NUMBERS_LE_BIN;
	if (override) return override;
	for (const profile of ['release', 'debug']) {
		const candidate = join(ROOT, 'crate', 'target', profile, 'numbers-le');
		if (existsSync(candidate)) return candidate;
		if (existsSync(`${candidate}.exe`)) return `${candidate}.exe`;
	}
	throw new Error(
		'no numbers-le binary: run `cargo build` in crate/, or set NUMBERS_LE_BIN',
	);
}

/**
 * Every envelope the Rust server answers with, as raw response text.
 *
 * One server process for the whole run: the tool is pure, so a request
 * cannot see the one before it, and spawning a process per document would
 * put a second of process startup between this job and being run.
 */
async function crateEnvelopes(requests: readonly Case[]): Promise<string[]> {
	const proc = Bun.spawn({
		cmd: [binaryPath(), 'mcp'],
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const lines = requests
		.map((testCase, id) =>
			JSON.stringify({
				jsonrpc: '2.0',
				id: id + 1,
				method: 'tools/call',
				params: {
					name: 'extract_numbers',
					arguments: {
						content: testCase.content,
						format: testCase.format,
					},
				},
			}),
		)
		.join('\n');
	proc.stdin.write(`${lines}\n`);
	await proc.stdin.end();

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const answered = stdout.split('\n').filter((line) => line.trim().length > 0);
	if (answered.length !== requests.length) {
		throw new Error(
			`the server answered ${answered.length} of ${requests.length} requests\n${stderr}`,
		);
	}
	return answered;
}

/**
 * Key order made irrelevant. `serde_json` sorts its keys and JavaScript
 * keeps insertion order; neither is the contract, and comparing raw text
 * would fail on that alone.
 */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value === null || typeof value !== 'object') return value;
	const entries = Object.entries(value as Record<string, unknown>).sort(
		([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
	);
	return entries.map(([key, inner]) => [key, canonical(inner)]);
}

/**
 * The number tokens in a `numbers` array, as the server wrote them.
 *
 * Read from the raw response text rather than from a parsed value on
 * purpose: parsing is exactly what would hide the difference between
 * `1e+21` and `1e21`, and that difference is the contract.
 */
function valueTokens(responseText: string): string[] {
	const marker = '"numbers":';
	const at = responseText.indexOf(marker);
	if (at < 0) return [];
	let depth = 0;
	let end = at + marker.length;
	for (let i = at + marker.length; i < responseText.length; i += 1) {
		const char = responseText.charAt(i);
		if (char === '[') depth += 1;
		if (char === ']') {
			depth -= 1;
			if (depth === 0) {
				end = i + 1;
				break;
			}
		}
	}
	const array = responseText.slice(at + marker.length, end);
	// Values are always JSON numbers here — the shared tool emits no
	// strings inside `numbers` — so a token runs to the next `,` or `}`.
	return [...array.matchAll(/"value":([^,}\]]+)/g)].map((match) =>
		(match[1] ?? '').trim(),
	);
}

type Envelope = Readonly<{
	ok: boolean;
	data: { numbers: readonly { value: number; notation: Notation }[] };
	diagnostics: readonly { code: string }[];
}>;

/** Both refused, both said so, and both returned nothing. */
function refusedAlike(crate: Envelope, extension: Envelope): boolean {
	return (
		crate.ok === extension.ok &&
		crate.data.numbers.length === 0 &&
		extension.data.numbers.length === 0 &&
		crate.diagnostics.some((one) => one.code === 'parse-error') ===
			extension.diagnostics.some((one) => one.code === 'parse-error')
	);
}

const failures: string[] = [];

function fail(testCase: Case, detail: string): void {
	failures.push(
		`${testCase.name}\n` +
			`  seed:     ${SEED}\n` +
			`  format:   ${testCase.format}\n` +
			`  document: ${JSON.stringify(testCase.content)}\n` +
			`  ${detail}`,
	);
}

async function main(): Promise<void> {
	const all = shuffled(cases(), SEED);
	console.log(
		`differential: ${all.length} generated documents, seed ${SEED}, ` +
			`binary ${binaryPath()}`,
	);

	const tool = TOOLS.find((one) => one.name === 'extract_numbers');
	if (!tool) throw new Error('the extension no longer offers extract_numbers');

	const answers = await crateEnvelopes(all);

	for (const [index, testCase] of all.entries()) {
		const raw = answers[index] ?? '';
		const response = JSON.parse(raw) as {
			result?: { structuredContent?: unknown };
			error?: unknown;
		};
		if (response.error !== undefined || !response.result?.structuredContent) {
			fail(testCase, `the crate server refused the call: ${raw}`);
			continue;
		}
		const fromCrate = response.result.structuredContent as Envelope;
		const fromExtension = (await tool.handler({
			content: testCase.content,
			format: testCase.format,
		})) as Envelope;

		// A refused document is compared by shape, not by text. The
		// message comes from whichever parser did the refusing —
		// `@iarna/toml` and the `toml` crate word them differently and
		// neither is wrong — so what has to match is that both refused,
		// both said so, and both returned nothing.
		if (fromCrate.ok === false || fromExtension.ok === false) {
			if (!refusedAlike(fromCrate, fromExtension)) {
				fail(
					testCase,
					'one server refused the document and the other read it\n' +
						`  crate:     ok=${fromCrate.ok} ${JSON.stringify(fromCrate.data.numbers)}\n` +
						`  extension: ok=${fromExtension.ok} ${JSON.stringify(fromExtension.data.numbers)}\n` +
						'  This is the SHARED tool: either the parsers genuinely differ — in which\n' +
						'  case it belongs in "Deliberate divergences" in crate/SPEC.md — or one of\n' +
						'  the two is wrong.',
				);
			}
			continue;
		}

		// 1. The whole envelope, key order aside. A divergence here is a
		//    divergence in the tool BOTH servers offer — one name, one
		//    schema — so it is a bug in one of them, never an IDE-first
		//    versus terminal-first difference.
		if (
			JSON.stringify(canonical(fromCrate)) !==
			JSON.stringify(canonical(fromExtension))
		) {
			fail(
				testCase,
				'the two servers answer the shared extract_numbers tool differently\n' +
					`  crate:     ${JSON.stringify(fromCrate.data.numbers)}\n` +
					`  extension: ${JSON.stringify(fromExtension.data.numbers)}\n` +
					'  This is the SHARED tool, not the two surfaces: one of the two is wrong.',
			);
			continue;
		}

		// 2. The token, byte for byte. `1e+21` and `1e21` are the same
		//    double and different bytes, and only one is what the other
		//    server writes.
		const crateTokens = valueTokens(raw);
		const extensionTokens = fromExtension.data.numbers.map((found) =>
			String(found.value),
		);
		if (JSON.stringify(crateTokens) !== JSON.stringify(extensionTokens)) {
			fail(
				testCase,
				'the values agree and the text does not — a number is printed differently\n' +
					`  crate:     ${JSON.stringify(crateTokens)}\n` +
					`  extension: ${JSON.stringify(extensionTokens)}`,
			);
			continue;
		}

		// 3. The notation is how the literal was WRITTEN, checked against
		//    this file's table rather than against either implementation.
		//    A value can be right while the notation lies, and two servers
		//    lying the same way would agree.
		const actual = fromCrate.data.numbers.map((found) => ({
			value: found.value,
			notation: found.notation,
		}));
		if (JSON.stringify(actual) !== JSON.stringify(testCase.expected)) {
			fail(
				testCase,
				'both servers agree and both disagree with the dialect rules\n' +
					`  expected: ${JSON.stringify(testCase.expected)}\n` +
					`  got:      ${JSON.stringify(actual)}`,
			);
		}
	}

	if (failures.length > 0) {
		console.error(
			`\nDifferential extraction FAILED (${failures.length} of ${all.length}), seed ${SEED}:\n`,
		);
		for (const failure of failures) console.error(`- ${failure}\n`);
		process.exit(1);
	}
	console.log(
		`OK: ${all.length} generated documents, both servers identical, ` +
			'every notation the one the literal was written in.',
	);
}

await main();
