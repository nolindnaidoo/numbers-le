/**
 * Requires the npm command line to behave exactly as the Rust one does.
 *
 * Both install a command named `numbers-le`, so a person or a CI step cannot
 * tell which one they have. This is a different contract from
 * `check-extraction-parity.ts`, which holds the extension's engine equal to
 * the crate's: here the whole terminal surface is compared, the walk, the
 * positions, the exit codes, stdout and stderr byte for byte, and every reply
 * `numbers-le mcp` writes, byte for byte too.
 *
 * Nothing is masked: the extension reads JSON, YAML, TOML, INI and CSV with
 * transcriptions of the crate's own parsers, so a refused document is
 * refused in the same words, and the tree holds broken documents of each
 * format to prove it.
 *
 * Run: bun run build:cli && cargo build --locked --manifest-path crate/Cargo.toml
 *      bun scripts/check-cli-parity.ts
 */
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmdirSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const RUST =
	process.env.NUMBERS_LE_BIN ??
	join(
		ROOT,
		'crate',
		'target',
		'debug',
		`numbers-le${process.platform === 'win32' ? '.exe' : ''}`,
	);
const NODE_CLI = join(ROOT, 'cli', 'cli.js');
/**
 * Node, by name, not `process.execPath`: this script runs under Bun, and the
 * package is run by Node wherever `npx` runs it. Bun's errors are not Node's.
 */
const NODE = process.env.NODE_BIN ?? 'node';

interface Case {
	readonly args: readonly string[];
	readonly stdin?: string | Buffer;
}

interface Outcome {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

for (const [label, path] of [
	['the Rust binary', RUST],
	['cli/cli.js', NODE_CLI],
] as const) {
	if (!existsSync(path)) {
		console.error(`FAIL: ${label} is missing at ${path}. Build it first.`);
		process.exit(1);
	}
}

const tree = mkdtempSync(join(tmpdir(), 'numbers-le-cli-parity-'));
const created: string[] = [];
const dirs: string[] = [tree];

function dir(relative: string): void {
	mkdirSync(join(tree, relative));
	dirs.push(join(tree, relative));
}

function file(relative: string, content: string | Buffer): void {
	writeFileSync(join(tree, relative), content);
	created.push(join(tree, relative));
}

const canLock = process.platform !== 'win32' && process.getuid?.() !== 0;

/** The shared corpus, every document of it. */
function corpus(): void {
	const source = join(ROOT, 'crate', 'fixtures', 'documents');
	dir('corpus');
	for (const name of readdirSync(source)) {
		file(`corpus/${name}`, readFileSync(join(source, name)));
	}
}

/** One document of each parsed format that its parser refuses, plus near misses. */
function broken(): void {
	dir('broken');
	const documents: Record<string, string> = {
		'a.json': '{"a": 1,',
		'b.json': '{"a": 1, "b": }',
		'empty.json': '',
		'dup.json': '{"a": 1, "a": 2}',
		'a.jsonc': '{\n  // c\n  "a": 1,,\n}',
		'a.yaml': 'a: [1\n',
		'b.yaml': 'a: b: c\n',
		'c.yml': '\t- 1\n',
		'a.toml': '[a\nb = 1\n',
		'b.toml': 'a = \n',
		'mixed.toml': 'a = [1, 2.5, "x"]\nbig = 9007199254740993\n',
		'wide.toml': 'a = 9223372036854775808\n',
		'a.csv': 'a,b\n"1,2\n',
		'b.csv': ' "1" , 2 \n3,"4"x\n',
		'a.tsv': 'a\tb\n"x\n',
		'a.ini': '[a\nb=1\n',
		'b.ini': 'rate = \u008542\nbare\n',
		'a.env': 'A="unterminated\nB=1\nB=2\nexport C = 3 # c\n',
	};
	for (const [name, content] of Object.entries(documents)) {
		file(`broken/${name}`, content);
	}
}

function build(): void {
	corpus();
	broken();
	dir('repo');
	dir('repo/.git');
	dir('repo/.git/info');
	file('repo/.git/info/exclude', 'excluded.txt\n');
	file('repo/.gitignore', 'ignored.ts\nbuild/\n*.log\n!keep.log\n');
	file('repo/ignored.ts', 'const a = 11;\n');
	file('repo/excluded.txt', 'rate 12\n');
	file('repo/noise.log', 'retry 13 times\n');
	file('repo/keep.log', 'kept 14\n');
	dir('repo/build');
	file('repo/build/out.js', 'const b = 15;\n');

	file(
		'repo/config.json',
		'{\n  "port": 8080,\n  "rate": 0.0825,\n  "big": 1e21,\n  "small": 1e-7,\n' +
			'  "edge": 123456789012345680000,\n  "wide": 9007199254740993,\n  "neg": -0,\n' +
			'  "dup": 5,\n  "dup": 6,\n  "text": "42",\n  "list": [1, 2.50, {"deep": 3}],\n' +
			'  "café 🎯": 7,\n  "huge": 1e400,\n  "flag": true\n}\n',
	);
	file('repo/scalar.json', '  42\n');
	file(
		'repo/settings.jsonc',
		'// timeout 30 in a comment\n{\n  /* 🎯 block 40 */ "a": 50,\n  "b": [60, 70,],\n}\n',
	);
	file('repo/only-comments.jsonc', '// nothing 1 here\n/* or 2 here */\n');
	file(
		'repo/app.yaml',
		'port: 8080\nratio: 0.5\nhex: 0x1A\noctal: 0o17\nexp: 1.5e3\ntext: "42"\n' +
			'when: 2024-01-15\ninf: .inf\nlist:\n  - 1\n  - 2\nanchor: &a 9\nref: *a\n',
	);
	file('repo/data.csv', 'id,price,note\n1,9.99,"1,000"\n2,-3,abc\n3,+4,1e3\nragged\n');
	file('repo/data.tsv', 'a\tb\n1\t2\n');
	file(
		'repo/config.toml',
		'x = 0x1A\nk26 = 0x1A\nsep = 1_000\nf = 2.5\nwhen = 1979-05-27\nneg = -0\n' +
			'inf = inf\n[table]\nport = 8080\narr = [1, 2, 3]\n',
	);
	file('repo/settings.ini', '[server]\nport = 8080\nrate = "0.5"\npath = C:\\data\\1\nversion = 1.2.3\n');
	file('repo/.env', 'export PORT=3000\nRATE="0.25"\n# POLL=500\nEMPTY=\nHEX=0x10\n');
	file('repo/.env.local', 'POLL=500\n# OFF=600\n');
	file('repo/app.env', 'WORKERS=4\n');
	file('repo/env.ts', 'export const env = 8;\n');
	file('repo/.envrc', 'export LIMIT=9\n');
	file('repo/main.py', 'MODE = 0o755\nBIG = 1_000_000\nX = 1e3 + 0x1F + 0b101\nname = "v2"\n');
	file('repo/lib.rs', 'const MASK: u32 = 0xFF_u32;\nlet a = 1_000i64;\nlet b = 2.5f32;\n');
	file('repo/main.go', 'package main\nconst Perm = 0755\nvar x = 1e3\n');
	file('repo/App.java', 'long a = 100L;\nint b = 0b1010;\n');
	file('repo/App.kt', 'val a = 1_000L\n');
	file('repo/Program.cs', 'var a = 1.5m;\nvar b = 0x10UL;\n');
	file('repo/main.cpp', "auto a = 1'000;\nauto b = 0x10ULL;\n");
	file('repo/main.c', 'int a = 017;\nfloat b = 1.5f;\n');
	file('repo/app.js', 'const a = 10n;\nconst b = 0b11;\nconst c = 1e21;\n');
	file('repo/app.ts', 'const VAT: number = 0.2;\nlet n: u32 = 7;\n');
	file('repo/query.sql', 'SELECT * FROM t WHERE x > 100 LIMIT 5;\n');
	file('repo/run.sh', 'sleep 30\nexit 0\n');
	file('repo/NOTES.md', 'Released v1.2.3 at a rate of 0.2, then ٣5 more, 🎯 7 later.\n');
	file('repo/Makefile', 'JOBS = 4\n');
	file('repo/crlf.yaml', 'a: 1\r\nb: 2\r\n');
	file('repo/bom.json', '\uFEFF{"a": 1}\n');
	file('repo/empty.json', '');
	file('repo/blank.yaml', '   \n\n');
	file('repo/latin1.txt', Buffer.from([0x31, 0x32, 0xe9, 0x0a]));
	file('repo/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a, 0x0a]));
	file('repo/bad.json', '{"a": 1,}\n');
	file('repo/bad.yaml', 'x: [1, 2\n');
	file('repo/bad.toml', 'k = 1\n[t\n');
	file('repo/bad.csv', '1,"unterminated\n');
	file('repo/ünïcode.json', '{"k": 3}\n');
	// A backslash is a separator on Windows, so the name cannot exist there.
	if (process.platform !== 'win32') file('repo/od\\d.json', '{"k": 4}\n');
	dir('repo/a');
	file('repo/a/b.json', '{"k": 5}\n');
	file('repo/a.json', '{"k": 6}\n');
	dir('repo/nested');
	file('repo/nested/.gitignore', '!ignored.ts\nlocal.txt\n');
	file('repo/nested/ignored.ts', 'const n = 16;\n');
	file('repo/nested/local.txt', 'local 17\n');
	file('repo/nested/.ignore', 'dot-ignored.txt\n');
	file('repo/nested/dot-ignored.txt', 'dot 18\n');
	file('repo/.hidden.json', '{"h": 19}\n');
	dir('repo/.hiddendir');
	file('repo/.hiddendir/in.json', '{"h": 20}\n');
	// Windows grants symlinks to administrators and developer mode only, and
	// both binaries then see the same tree without the link.
	try {
		symlinkSync(join(tree, 'repo', 'a.json'), join(tree, 'repo', 'link.json'));
		created.push(join(tree, 'repo', 'link.json'));
	} catch {}

	dir('loose');
	file('loose/.gitignore', 'not-a-repo.txt\n');
	file('loose/not-a-repo.txt', 'outside 21\n');
	file('loose/.ignore', 'dot.txt\n');
	file('loose/dot.txt', 'dot 22\n');

	dir('none');
	file('none/words.txt', 'no digits here\n');

	if (canLock) {
		file('repo/locked.json', '{"l": 23}\n');
		chmodSync(join(tree, 'repo', 'locked.json'), 0o000);
		dir('closed');
		file('closed/open.env', 'A=24\n');
		dir('closed/shut.toml');
		file('closed/shut.toml/inside.json', '{"s": 25}\n');
		chmodSync(join(tree, 'closed', 'shut.toml'), 0o000);
		dir('sealed');
		chmodSync(join(tree, 'sealed'), 0o000);
	}
}

function cases(): readonly Case[] {
	const repo = join(tree, 'repo');
	const at = (name: string): string => join(repo, name);
	return [
		{ args: ['--help'] },
		{ args: ['--version'] },
		{ args: ['-V'] },
		{ args: ['-h'] },
		{ args: [] },
		{ args: [repo] },
		{ args: [`${repo}/`] },
		{ args: ['repo'] },
		{ args: [repo, '--dedupe'] },
		{ args: [repo, '--values'] },
		{ args: [repo, '--values', '--dedupe'] },
		{ args: [repo, '--hidden'] },
		{ args: [repo, '--no-ignore'] },
		{ args: [repo, '--hidden', '--no-ignore'] },
		{ args: [repo, '--strict'] },
		{ args: [at('config.json'), at('scalar.json'), '--format', 'json'] },
		{ args: [at('settings.jsonc'), at('config.json'), '--format', 'JSONC'] },
		{ args: [at('app.yaml'), at('crlf.yaml'), '--format', '.yml'] },
		{ args: [at('settings.ini'), at('.env'), '--format', 'env'] },
		{ args: [at('data.csv'), '--format', 'tsv'] },
		{ args: [at('main.py'), at('lib.rs'), '--format', 'go'] },
		{ args: [repo, '--format', 'klingon'] },
		{ args: [repo, '--format', '\uFEFFtoml'] },
		{ args: [repo, '--format'] },
		{ args: [at('ignored.ts'), at('.hidden.json'), at('config.json')] },
		{ args: [at('config.json'), at('config.json')] },
		{ args: [at('a.json'), at('a')] },
		{ args: [at('.env.local'), at('.env'), at('app.env'), at('env.ts'), at('.envrc')] },
		{ args: [at('logo.png')] },
		{ args: [at('logo.png'), '--strict'] },
		{ args: [at('latin1.txt'), '--strict'] },
		{ args: [at('empty.json')] },
		{ args: [at('bad.yaml'), at('bad.json'), '--values'] },
		{ args: [at('bad.toml'), at('bad.csv')] },
		{ args: [join(tree, 'none')] },
		{ args: [join(tree, 'loose')] },
		{ args: [join(tree, 'missing')] },
		{ args: [join(tree, 'no', 'such', 'place')] },
		{ args: [repo, '--dedup'] },
		{ args: [repo, '--help'] },
		{ args: [repo, '-'] },
		{ args: ['--stdin'], stdin: 'const a = 0x1F;\nrate 0.5\n' },
		{ args: ['--stdin', repo] },
		{ args: ['--stdin', '--format', 'json'], stdin: '{"a": 1, "b": [2, 3]}\n' },
		{ args: ['--stdin', '--format', 'yaml', '--values'], stdin: 'a: 1\nb: 0x10\n' },
		{ args: ['--stdin', '--format', 'json'], stdin: '\uFEFF{"a": 1}\n' },
		{ args: ['--stdin'], stdin: Buffer.from([0x31, 0xff, 0x0a]) },
		{ args: ['--stdin', '--format', 'json'], stdin: '' },
		{ args: ['--stdin', '--format', 'json'], stdin: '{"a": ' },
		{ args: ['--stdin', '--dedupe'], stdin: '1 2 1 0x1 1.0\n' },
		{ args: ['--stdin', '--format', 'rust'], stdin: 'let a = 0x1A; let b = 26;\n' },
		...(canLock
			? [
					{ args: [join(tree, 'closed')] },
					{ args: [join(tree, 'closed'), '--strict'] },
					{ args: [join(tree, 'sealed')] },
				]
			: []),
		{ args: ['corpus'] },
		{ args: ['broken'] },
		{ args: ['broken', '--strict'] },
		{ args: ['corpus', '--dedupe'] },
		{ args: ['corpus', '--values'] },
		{ args: [join(ROOT, 'samples')] },
	];
}

function run(command: readonly string[], testCase: Case): Outcome {
	const [program, ...rest] = command as [string, ...string[]];
	const result = spawnSync(program, [...rest, ...testCase.args], {
		input: testCase.stdin ?? '',
		cwd: tree,
	});
	return {
		status: result.status,
		stdout: result.stdout.toString('utf8'),
		stderr: result.stderr.toString('utf8'),
	};
}

function compareCli(): string[] {
	const failures: string[] = [];
	for (const testCase of cases()) {
		const rust = run([RUST], testCase);
		const node = run([NODE, NODE_CLI], testCase);
		for (const field of ['status', 'stdout', 'stderr'] as const) {
			if (rust[field] === node[field]) continue;
			failures.push(
				`numbers-le ${testCase.args.join(' ')}\n  ${field} differs\n` +
					`  rust: ${JSON.stringify(rust[field])}\n  node: ${JSON.stringify(node[field])}`,
			);
		}
	}
	return failures;
}

function mcpLines(): readonly string[] {
	const repo = join(tree, 'repo');
	let id = 0;
	const request = (method: string, params?: unknown) =>
		JSON.stringify({
			jsonrpc: '2.0',
			id: ++id,
			method,
			...(params === undefined ? {} : { params }),
		});
	const call = (name: string, args?: unknown) =>
		request('tools/call', args === undefined ? { name } : { name, arguments: args });
	const extract = (args: Record<string, unknown>) => call('extract_numbers', args);
	return [
		request('initialize', { protocolVersion: '2024-11-05' }),
		JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		request('tools/list'),
		request('ping'),
		request('resources/list'),
		request('tools/call'),
		request('tools/call', { arguments: {} }),
		call('no_such_tool', {}),
		JSON.stringify({ jsonrpc: '2.0', id: 'text-id', method: 'ping' }),
		JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping' }),
		JSON.stringify({ jsonrpc: '2.0', id: { b: 1, a: [2] }, method: 'ping' }),
		JSON.stringify({ id: 77, method: 'ping' }),
		JSON.stringify({ jsonrpc: '2.0', id: 78 }),
		'not json',
		'',
		'   ',
		'[1, 2]',
		`${request('ping')}\r`,
		extract({ content: '{"a": 1e21, "a": -0, "b": [1, 2.50]}', format: 'json' }),
		extract({ content: '{"a": 1,}', format: 'json' }),
		extract({ content: '// x 1\n{"a": 2,}', format: 'jsonc' }),
		extract({ content: 'a: 0x1A\nb: "42"\nc: 1.5e3\n', format: 'yaml' }),
		extract({ content: 'x = 0x1A\nk26 = 0x1A\n', format: 'toml' }),
		extract({ content: 'a: [1\n', format: 'yaml' }),
		extract({ content: 'POLL=500\n# OFF=600\n', filename: 'src/.env.local' }),
		extract({ content: 'POLL=500\n', filename: 'app.env' }),
		extract({ content: 'let a = 0xFF_u32;\n', filename: 'lib.rs' }),
		extract({ content: 'rate ٣5 and 🎯 7', format: 'markdown' }),
		extract({ content: '1 2 1 0x1 1.0', dedupe: true }),
		extract({ content: '1 2 3', maxResults: 2 }),
		extract({ content: '1 2 3', maxResults: 0 }),
		extract({ content: '1 2 3', maxResults: -1 }),
		extract({ content: '1 2 3', maxResults: 'two' }),
		extract({ content: '1 2 3', maxResults: null }),
		extract({ content: '1 2 3', maxResults: 999999 }),
		// Written as text: JSON.stringify prints 2.0 as 2, and the crate's serde
		// reads 2.0 as a float, which `as_u64` refused.
		`{"jsonrpc":"2.0","id":${++id},"method":"tools/call","params":{"name":"extract_numbers","arguments":{"content":"1 2 3","maxResults":2.0}}}`,
		`{"jsonrpc":"2.0","id":${++id},"method":"tools/call","params":{"name":"extract_numbers","arguments":{"content":"1 2 3","maxResults":1e3}}}`,
		`{"jsonrpc":"2.0","id":${++id},"method":"tools/call","params":{"name":"extract_numbers","arguments":{"content":"1 2 3","maxResults":1E20}}}`,
		`{"jsonrpc":"2.0","id":${++id},"method":"tools/call","params":{"name":"extract_numbers","arguments":{"content":"1 2 3","maxResults":2.5}}}`,
		// A scan entry that is not a string is named, not dropped.
		`{"jsonrpc":"2.0","id":${++id},"method":"tools/call","params":{"name":"numbers_le_scan","arguments":{"paths":[${JSON.stringify(tree)},7]}}}`,
		`{"jsonrpc":"2.0","id":${++id},"method":"tools/call","params":{"name":"numbers_le_scan","arguments":{"path":7}}}`,
		extract({ content: '"42"', format: '\uFEFFjson' }),
		extract({ content: 7 }),
		extract({}),
		call('extract_numbers'),
		call('numbers_le_scan', { path: repo }),
		call('numbers_le_scan', { paths: [repo, join(tree, 'loose')], dedupe: true }),
		call('numbers_le_scan', { path: repo, hidden: true, ignored: true, format: 'json' }),
		call('numbers_le_scan', { path: repo, format: 'klingon' }),
		call('numbers_le_scan', { path: join(repo, 'config.toml'), format: 7 }),
		call('numbers_le_scan', { paths: [] }),
		call('numbers_le_scan', { paths: [3] }),
		call('numbers_le_scan', {}),
		call('numbers_le_scan', { path: join(tree, 'missing') }),
		...(canLock ? [call('numbers_le_scan', { path: join(tree, 'closed') })] : []),
		call('numbers_le_scan', { path: join(tree, 'none') }),
	];
}

function serve(command: readonly string[], input: string | Buffer): Outcome {
	const [program, ...rest] = command as [string, ...string[]];
	const result = spawnSync(program, [...rest, 'mcp'], { input, cwd: tree });
	return {
		status: result.status,
		stdout: result.stdout.toString('utf8'),
		stderr: result.stderr.toString('utf8'),
	};
}

function compareMcp(): string[] {
	const failures: string[] = [];
	const lines = mcpLines();
	const sessions: readonly (readonly [string, string | Buffer])[] = [
		['the whole session', `${lines.join('\n')}\n`],
		['a last line with no newline', lines[3] as string],
		[
			'a line that is not UTF-8',
			Buffer.concat([
				Buffer.from(`${lines[3]}\n`),
				Buffer.from([0x7b, 0xff, 0x7d, 0x0a]),
				Buffer.from(`${lines[3]}\n`),
			]),
		],
	];
	for (const [label, input] of sessions) {
		const rust = serve([RUST], input);
		const node = serve([NODE, NODE_CLI], input);
		for (const field of ['status', 'stdout', 'stderr'] as const) {
			if (rust[field] === node[field]) continue;
			failures.push(
				`numbers-le mcp, ${label}\n  ${field} differs\n` +
					describeDifference(rust[field], node[field]),
			);
		}
	}
	return failures;
}

/** The first differing line, which is the one worth reading in a long session. */
function describeDifference(rust: string, node: string): string {
	const left = rust.split('\n');
	const right = node.split('\n');
	const index = left.findIndex((line, at) => line !== right[at]);
	const at = index === -1 ? left.length : index;
	return `  line ${at + 1}\n  rust: ${left[at]}\n  node: ${right[at]}`;
}

function cleanUp(): void {
	const unlock: readonly (readonly [string, number])[] = [
		[join(tree, 'repo', 'locked.json'), 0o600],
		[join(tree, 'closed', 'shut.toml'), 0o700],
		[join(tree, 'sealed'), 0o700],
	];
	for (const [path, mode] of unlock) if (existsSync(path)) chmodSync(path, mode);
	for (const path of created) unlinkSync(path);
	for (const path of [...dirs].reverse()) rmdirSync(path);
}

build();
let failures: string[];
try {
	failures = [...compareCli(), ...compareMcp()];
} finally {
	cleanUp();
}

if (failures.length > 0) {
	console.error(failures.join('\n\n'));
	console.error(`\nFAIL: ${failures.length} difference(s) between the npm and Rust CLIs`);
	process.exit(1);
}
console.log(
	`OK: the npm CLI matches the Rust CLI on ${cases().length} commands and ${mcpLines().length} MCP lines`,
);
