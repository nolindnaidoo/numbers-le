import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmdirSync,
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
		const status = await serve(input, (line) => written.push(line), '9.9.9');
		return { status, written };
	}

	it('answers in serde_json’s key order and drops what it cannot answer', async () => {
		const { status, written } = await session([
			'{"jsonrpc":"2.0","id":1,"method":"initialize"}',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}',
			'not json',
			'{"jsonrpc":"2.0","id":2,"method":"nope"}',
		]);
		expect(status).toBe(0);
		expect(written).toEqual([
			'{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":{}},"protocolVersion":"2025-06-18","serverInfo":{"name":"numbers-le","version":"9.9.9"}}}\n',
			'{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"this server does not implement nope"}}\n',
		]);
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

	it('drops a line that is not UTF-8 and serves the next', async () => {
		const written: string[] = [];
		const input = Readable.from([
			Buffer.from([0x7b, 0xff, 0x7d, 0x0a]),
			Buffer.from('{"jsonrpc":"2.0","id":1,"method":"ping"}\n'),
		]);
		expect(await serve(input, (reply) => written.push(reply), '9.9.9')).toBe(0);
		expect(written).toEqual(['{"jsonrpc":"2.0","id":1,"result":{}}\n']);
	});
});
