import { execFileSync } from 'node:child_process';
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmdirSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from './args';
import { resolveFormat } from './format';
import { examine } from './locate';
import { serve } from './mcp';
import { run } from './run';
import { DEFAULT_SCAN, exitCode, describe as line, scanContent } from './scan';
import { FLAGS, USAGE } from './usage';
import { collect, DEFAULT_WALK } from './walk';

describe('usage', () => {
	it('names every flag the parser accepts, and no other', () => {
		const named = new Set(
			USAGE.split(/\s+/)
				.filter((word) => word.startsWith('--'))
				.map((word) => word.replace(/[,.:;]+$/, ''))
				.filter((word) => word !== '--version' && word !== '--help'),
		);
		expect([...named].sort()).toEqual([...FLAGS].sort());
	});

	it('offers no judgment about which numbers matter', () => {
		for (const word of ['magic', 'round', 'convert', 'score'])
			expect(USAGE).not.toContain(word);
	});
});

describe('parse', () => {
	it('refuses an unknown flag rather than ignoring it', () => {
		expect(() => parse(['--dedup', 'x'])).toThrow('--dedup is not an option');
	});

	it('falls back on a format it does not name, and resolves one it does', () => {
		expect(parse(['--format', 'handwriting', 'x']).scan.format).toBe('unknown');
		expect(parse(['--format', '.YML', 'x']).scan.format).toBe('yaml');
	});

	it('refuses a format flag with no value, naming nothing, and stdin with files', () => {
		expect(() => parse(['--format'])).toThrow('--format needs a format');
		expect(() => parse([])).toThrow('name a file or a directory');
		expect(() => parse(['--stdin', 'x'])).toThrow('takes no file arguments');
	});
});

describe('resolveFormat', () => {
	it('reads every dotenv spelling as dotenv, as the crate does', () => {
		for (const name of [
			'.env',
			'.env.local',
			'.env.test.local',
			'app.env',
			'env',
		])
			expect(resolveFormat(undefined, name), name).toBe('env');
	});

	it('leaves a source file and a direnv script alone', () => {
		expect(resolveFormat(undefined, 'env.ts')).toBe('typescript');
		expect(resolveFormat(undefined, '.envrc')).toBe('unknown');
	});

	it('prefers a format it recognises over the file name', () => {
		expect(resolveFormat('toml', 'a.json')).toBe('toml');
		expect(resolveFormat('klingon', 'a.json')).toBe('json');
	});
});

describe('examine', () => {
	const at = (text: string, format: string) =>
		examine(text, format).found.map((found) => [
			found.value,
			found.position && [found.position.line, found.position.column],
		]);

	it('places a value its parser resolved at the next run with the same double', () => {
		expect(at('x = 0x1A\nk26 = 0x1A\n', 'toml')).toEqual([
			['26', [2, 2]],
			['26', null],
		]);
	});

	it('reports every JSON token, a repeated key included', () => {
		expect(at('{"a":1e21,"a":-0}', 'json')).toEqual([
			['1e+21', [1, 6]],
			['0', [1, 15]],
		]);
	});

	it('consumes a run led by a digit from another script, as Rust’s \\d does', () => {
		expect(at('٣5 then 7', 'unknown')).toEqual([['7', [1, 9]]]);
	});

	it('counts columns in UTF-16 units after an astral character', () => {
		expect(at('\u{1F3AF} 7', 'unknown')).toEqual([['7', [1, 4]]]);
	});

	it('reports a refusal in the crate’s words for the formats it parses', () => {
		expect(examine('1,"open\n', 'csv').parseError).toMatch(
			/^Failed to parse CSV: /,
		);
		expect(examine('{', 'json').parseError).toMatch(/^Failed to parse JSON: /);
		expect(examine('{}', 'json').parseError).toBeNull();
	});
});

describe('jsonc positions', () => {
	it('places a number after an astral character in a comment', () => {
		const text = '/* \u{1F3AF} */ {"a": 1}';
		expect(examine(text, 'jsonc').found[0]?.position).toEqual({
			line: 1,
			column: 16,
		});
	});
});

describe('scan', () => {
	it('dedupes by printed value and keeps the first position', () => {
		const report = scanContent('{"a":5,"b":9,"c":5}', 'a.json', 'json', {
			...DEFAULT_SCAN,
			dedupe: true,
		});
		expect(report.numbers.map((found) => found.value)).toEqual(['5', '9']);
		expect(line(report, report.numbers[0] as never)).toBe('a.json:1:6  5');
	});

	it('follows grep: numbers 0, none 1, and a parse failure is not 2', () => {
		const found = scanContent('A=1', 'a.env', 'env', DEFAULT_SCAN);
		const none = scanContent('{"a":"x"}', 'a.json', 'json', DEFAULT_SCAN);
		const broken = scanContent('{', 'a.json', 'json', DEFAULT_SCAN);
		expect(exitCode([found], false)).toBe(0);
		expect(exitCode([none], false)).toBe(1);
		expect(exitCode([broken], false)).toBe(1);
		expect(broken.diagnostics[0]?.code).toBe('unparsed');
	});
});

describe('walk', () => {
	const made: string[] = [];
	afterEach(() => {
		for (const path of made.reverse()) {
			chmodSync(path, 0o700);
			for (const name of readdirSync(path)) unlinkSync(join(path, name));
			rmdirSync(path);
		}
		made.length = 0;
	});

	it('carries a directory it cannot open rather than ending the run', () => {
		if (process.platform === 'win32' || process.getuid?.() === 0) return;
		const root = mkdtempSync(join(tmpdir(), 'numbers-le-walk-'));
		made.push(root);
		mkdirSync(join(root, 'locked'));
		made.push(join(root, 'locked'));
		writeFileSync(join(root, 'kept.env'), 'A=1\n');
		chmodSync(join(root, 'locked'), 0o000);

		const walked = collect([root], DEFAULT_WALK);
		expect(walked.files).toEqual([join(root, 'kept.env')]);
		expect(walked.unreadable).toEqual([
			{
				path: join(root, 'locked'),
				reason: `IO error for operation on ${join(root, 'locked')}: Permission denied (os error 13)`,
			},
		]);
	});

	it('names a FIFO rather than opening or dropping it', () => {
		// Reading a pipe with no writer never returns, so it was never opened;
		// it was never named either, so it vanished from the report.
		if (process.platform === 'win32') return;
		const root = mkdtempSync(join(tmpdir(), 'numbers-le-fifo-'));
		made.push(root);
		writeFileSync(join(root, 'kept.env'), 'A=1\n');
		const fifo = join(root, 'pipe.env');
		try {
			execFileSync('mkfifo', [fifo]);
		} catch {
			return;
		}
		const walked = collect([root], DEFAULT_WALK);
		expect(walked.files).toEqual([join(root, 'kept.env')]);
		expect(walked.unreadable).toEqual([
			{ path: fifo, reason: 'not a regular file' },
		]);
		expect(collect([fifo], DEFAULT_WALK).unreadable).toEqual([
			{ path: fifo, reason: 'not a regular file' },
		]);
	});

	it('counts a symbolic link it does not follow', () => {
		// Never followed, by design; it was passed over without a line, so a
		// reader could not tell the tree held more than the scan read.
		if (process.platform === 'win32') return;
		const root = mkdtempSync(join(tmpdir(), 'numbers-le-symlink-'));
		made.push(root);
		writeFileSync(join(root, 'a.env'), 'A=1\n');
		symlinkSync(join(root, 'a.env'), join(root, 'link.env'));
		const walked = collect([root], DEFAULT_WALK);
		expect(walked.files).toEqual([join(root, 'a.env')]);
		expect(walked.symlinks).toBe(1);
		expect(walked.unreadable).toEqual([]);
	});

	it('refuses a named path that is not there', () => {
		// Each platform's own wording, as Rust's io::Error prints it.
		const reason =
			process.platform === 'win32'
				? 'The system cannot find the path specified. (os error 3)'
				: 'No such file or directory (os error 2)';
		expect(() => collect(['/no/such/place'], DEFAULT_WALK)).toThrow(
			`/no/such/place: ${reason}`,
		);
	});
});

describe('run', () => {
	async function cli(args: readonly string[], stdin = '', terminal = false) {
		let stdout = '';
		let stderr = '';
		const status = await run(args, {
			stdout: (text) => {
				stdout += text;
			},
			stderr: (text) => {
				stderr += text;
			},
			stdoutIsTerminal: terminal,
			readStdin: () => Promise.resolve(Buffer.from(stdin)),
			version: '9.9.9',
		});
		return { status, stdout, stderr };
	}

	it('writes the report in the crate’s field order when piped', async () => {
		const result = await cli(['--stdin', '--format', 'json'], '{"a": 1}');
		expect(result.status).toBe(0);
		expect(result.stdout).toBe(
			'{"file":"<stdin>","format":"json","numbers":[{"value":"1","notation":"decimal","line":1,"column":7}],"diagnostics":[],"summary":{"numbers":1,"unlocated":0}}\n',
		);
		expect(result.stderr).toBe('<stdin>:1:7  1\n1 number in 1 file\n');
	});

	it('keeps stdout silent at a terminal unless the values were asked for', async () => {
		expect((await cli(['--stdin'], '7', true)).stdout).toBe('');
		const values = await cli(['--stdin', '--values'], '7 8', true);
		expect(values.stdout).toBe('7\n8\n');
		expect(values.stderr).toBe('2 numbers in 1 file\n');
	});

	it('lists a symbolic link it did not follow on stderr', async () => {
		if (process.platform === 'win32') return;
		const root = mkdtempSync(join(tmpdir(), 'numbers-le-run-symlink-'));
		writeFileSync(join(root, 'rates.env'), 'VAT=0.2\n');
		symlinkSync(join(root, 'rates.env'), join(root, 'link.env'));
		try {
			const { status, stderr } = await cli([root]);
			expect(status).toBe(0);
			expect(stderr).toContain('1 symbolic link not followed\n');
		} finally {
			unlinkSync(join(root, 'link.env'));
			unlinkSync(join(root, 'rates.env'));
			rmdirSync(root);
		}
	});

	it('answers a malformed question with exit 2 and the crate’s words', async () => {
		const result = await cli(['--dedup', 'x']);
		expect(result.status).toBe(2);
		expect(result.stderr).toBe(
			'numbers-le: --dedup is not an option. Try --help.\n',
		);
		expect((await cli(['--version'])).stdout).toBe('numbers-le 9.9.9\n');
	});
});

describe('mcp', () => {
	async function session(lines: readonly string[]) {
		const written: string[] = [];
		const input = Readable.from([Buffer.from(`${lines.join('\n')}\n`)]);
		const status = await serve(
			input,
			(line) => {
				written.push(line);
				return undefined;
			},
			'9.9.9',
		);
		return { status, written };
	}

	it('answers in serde_json’s key order and refuses what it cannot answer', async () => {
		const { status, written } = await session([
			'{"jsonrpc":"2.0","id":1,"method":"initialize"}',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}',
			'not json',
			'{"jsonrpc":"2.0","id":2,"method":"nope"}',
		]);
		expect(status).toBe(0);
		expect(written).toEqual([
			'{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":{}},"protocolVersion":"2025-06-18","serverInfo":{"name":"numbers-le","version":"9.9.9"}}}\n',
			'{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Invalid JSON"}}\n',
			'{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"Unknown method: nope"}}\n',
		]);
	});

	// ERR-19: the three servers this repository ships answered a malformed
	// frame three different ways. The words are the extension server's.
	it('refuses malformed frames in the words the other two servers use, and a null id is a notification', async () => {
		const { written } = await session([
			'{"id":1,"method":"ping"}',
			'{"jsonrpc":"1.0","id":2,"method":"ping"}',
			'[{"jsonrpc":"2.0","id":3,"method":"ping"}]',
			'{"jsonrpc":"2.0","id":null,"method":"ping"}',
			'{"jsonrpc":"2.0","id":4,"method":"notifications/initialized"}',
			'{"jsonrpc":"2.0","id":5,"method":"tools/call","params":5}',
			'{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"nope"}}',
			'{"jsonrpc":"2.0","id":7,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}',
		]);
		const refused = {
			jsonrpc: '2.0',
			id: null,
			error: { code: -32700, message: 'Not a JSON-RPC 2.0 request' },
		};
		expect(written.map((line) => JSON.parse(line))).toEqual([
			refused,
			refused,
			refused,
			{
				jsonrpc: '2.0',
				id: 4,
				error: {
					code: -32601,
					message: 'Unknown method: notifications/initialized',
				},
			},
			{
				jsonrpc: '2.0',
				id: 5,
				error: { code: -32602, message: 'tools/call requires a string `name`' },
			},
			{
				jsonrpc: '2.0',
				id: 6,
				error: { code: -32602, message: 'Unknown tool: nope' },
			},
			{
				jsonrpc: '2.0',
				id: 7,
				result: {
					capabilities: { tools: {} },
					protocolVersion: '2025-06-18',
					serverInfo: { name: 'numbers-le', version: '9.9.9' },
				},
			},
		]);
	});

	it('waits for the pipe to drain before reading the next frame', async () => {
		const lines: string[] = [];
		let drained = 0;
		const input = Readable.from([
			Buffer.from(
				'{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,"method":"ping"}\n',
			),
		]);
		await serve(
			input,
			(line) => {
				lines.push(line);
				return new Promise((resolve) =>
					setTimeout(() => {
						drained += 1;
						resolve();
					}, 1),
				);
			},
			'9.9.9',
		);
		expect(lines).toHaveLength(2);
		expect(drained).toBe(2);
	});

	it('gives the parsed formats no position and the exact ones theirs', async () => {
		const call = (args: unknown) =>
			JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'extract_numbers', arguments: args },
			});
		const { written } = await session([
			call({ content: 'a = 7', format: 'toml' }),
			call({ content: '{"a": 7}', format: 'json' }),
		]);
		const numbers = written.map(
			(reply) => JSON.parse(reply).result.structuredContent.data.numbers,
		);
		expect(numbers).toEqual([
			[{ value: 7, notation: 'decimal' }],
			[{ value: 7, notation: 'decimal', line: 1, column: 7 }],
		]);
	});

	it('names an unreadable file in the envelope diagnostics', async () => {
		// The filter looked for a severity no report carries, so `ok: true`
		// with `diagnostics: []` was answered for a tree with a file in it that
		// the scan could not read.
		if (process.platform === 'win32' || process.getuid?.() === 0) return;
		const root = mkdtempSync(join(tmpdir(), 'numbers-le-unreadable-'));
		writeFileSync(join(root, 'open.env'), 'A=1\n');
		writeFileSync(join(root, 'closed.env'), 'B=2\n');
		chmodSync(join(root, 'closed.env'), 0o000);
		try {
			const { written } = await session([
				`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"numbers_le_scan","arguments":{"path":${JSON.stringify(root)}}}}`,
			]);
			const envelope = JSON.parse(written[0] ?? '').result.structuredContent;
			expect(envelope.ok).toBe(true);
			expect(envelope.diagnostics).toEqual([
				{
					code: 'unreadable',
					message: `${join(root, 'closed.env')} could not be read, so this scan does not cover it`,
					severity: 'warning',
				},
			]);
		} finally {
			chmodSync(join(root, 'closed.env'), 0o600);
			unlinkSync(join(root, 'closed.env'));
			unlinkSync(join(root, 'open.env'));
			rmdirSync(root);
		}
	});

	it('carries the symbolic links it did not follow in the envelope', async () => {
		if (process.platform === 'win32') return;
		const root = mkdtempSync(join(tmpdir(), 'numbers-le-mcp-symlink-'));
		writeFileSync(join(root, 'a.json'), '{"a":1}\n');
		symlinkSync(join(root, 'a.json'), join(root, 'link.json'));
		try {
			const { written } = await session([
				`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"numbers_le_scan","arguments":{"path":${JSON.stringify(root)}}}}`,
			]);
			const data = JSON.parse(written[0] ?? '').result.structuredContent.data;
			expect(data.symbolicLinks).toBe(1);
			expect(data.reports).toHaveLength(1);
		} finally {
			unlinkSync(join(root, 'link.json'));
			unlinkSync(join(root, 'a.json'));
			rmdirSync(root);
		}
	});

	it('names a path entry that is not a string rather than dropping it', async () => {
		// `["dir", 7]` was answered for `dir` alone and the 7 vanished without a
		// word, on this server and the crate's alike.
		const call = (args: string) =>
			`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"numbers_le_scan","arguments":${args}}}`;
		const { written } = await session([
			call('{"paths":["a",7]}'),
			call('{"paths":[null]}'),
			call('{"path":7}'),
			call('{"paths":[]}'),
		]);
		const refusal = (reply: string) => JSON.parse(reply).error;
		expect(written.map(refusal)).toEqual([
			{ code: -32602, message: 'entry 1 of paths is not a string' },
			{ code: -32602, message: 'entry 0 of paths is not a string' },
			{ code: -32602, message: 'path must be a string' },
			{ code: -32602, message: 'the list of paths was empty' },
		]);
	});

	it('refuses a wrong-typed or undeclared argument as a protocol error, and a missing path as a tool failure', async () => {
		// A `hidden: "yes"` was read as false and a `format: 7` as absent; the
		// schema the agent read allowed neither. A path that is not there is a
		// fact about the filesystem, and stays the tool's own failure.
		const call = (name: string, args: string) =>
			`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"${name}","arguments":${args}}}`;
		const { written } = await session([
			call('numbers_le_scan', '{"path":".","hidden":"yes"}'),
			call('numbers_le_scan', '{"path":".","format":7}'),
			call('numbers_le_scan', '{"path":".","bogus":1}'),
			call('extract_numbers', '{"content":"1","dedupe":"yes"}'),
			call('extract_numbers', '{"content":"1","extra":true,"another":1}'),
			call('numbers_le_scan', '{"path":"/no/such/place-xyz"}'),
		]);
		const replies = written.map((line) => JSON.parse(line));
		expect(replies.slice(0, 5).map((reply) => reply.error)).toEqual([
			{ code: -32602, message: 'hidden must be a boolean' },
			{ code: -32602, message: 'format must be a string' },
			{ code: -32602, message: 'unknown argument: bogus' },
			{ code: -32602, message: 'dedupe must be a boolean' },
			{ code: -32602, message: 'unknown arguments: another, extra' },
		]);
		expect(replies[5].error).toBeUndefined();
		expect(replies[5].result.isError).toBe(true);
		expect(replies[5].result.content[0].text).toMatch(
			/^\/no\/such\/place-xyz: /,
		);
	});

	it('reads a cap written as an integer-valued float or exponent, as the crate reads it', async () => {
		// Sent as text rather than through JSON.stringify, which would print 2.0
		// as 2: the crate's serde reads 2.0 as a float, and refused it.
		const call = (cap: string) =>
			`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"extract_numbers","arguments":{"content":"1 2 3","maxResults":${cap}}}}`;
		const { written } = await session([
			call('2.0'),
			call('1e3'),
			call('1E20'),
			call('2.5'),
		]);
		const outcome = (reply: string) => {
			const parsed = JSON.parse(reply);
			if (parsed.error) return parsed.error.message;
			const result = parsed.result;
			return `${result.structuredContent.meta.count}/${result.structuredContent.meta.truncated}`;
		};
		expect(written.map(outcome)).toEqual([
			'2/true',
			'3/false',
			'3/false',
			'maxResults must be a positive integer',
		]);
	});

	it('answers a line that is not UTF-8 with a parse error and serves the next', async () => {
		// Dropped without a word before; the crate's server reads it with
		// replacement characters now, and so does this.
		const written: string[] = [];
		const input = Readable.from([
			Buffer.from([0x7b, 0xff, 0x7d, 0x0a]),
			Buffer.from('{"jsonrpc":"2.0","id":1,"method":"ping"}\n'),
		]);
		expect(
			await serve(
				input,
				(reply) => {
					written.push(reply);
					return undefined;
				},
				'9.9.9',
			),
		).toBe(0);
		expect(written).toEqual([
			'{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Invalid JSON"}}\n',
			'{"jsonrpc":"2.0","id":1,"result":{}}\n',
		]);
	});
});
