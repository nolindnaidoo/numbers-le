import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { ExtractionResult } from '../types';
import { capped, isOk, readMaxResults, toDiagnostics } from './envelope';
import { resolveFormat, SUPPORTED_FORMATS } from './fileType';
import { TOOLS } from './tools';
import { createResponder, MAX_FRAME_BYTES, serve } from './transport';

/**
 * The MCP layer: the normalisation boundary, the tool table and the protocol.
 *
 * The engine is covered by its own characterization goldens. What is new here
 * is the translation between an agent's request and that engine. This one is
 * the odd member of the family: an unknown format is not an error, because the
 * engine falls back to scanning plain text — so the interesting mistake would
 * be refusing work it could have done.
 */

const emptyResult: ExtractionResult = Object.freeze({
	success: true,
	numbers: Object.freeze([]),
	errors: Object.freeze([]),
});

describe('envelope: ok vs success', () => {
	it('treats an empty result with no errors as ok', () => {
		expect(isOk(toDiagnostics(emptyResult))).toBe(true);
	});

	it('is not ok when a parser reported a problem', () => {
		expect(
			isOk(
				toDiagnostics({
					...emptyResult,
					errors: [{ type: 'parse-error', message: 'bad' }],
				}),
			),
		).toBe(false);
	});
});

describe('envelope: result cap', () => {
	it('reports truncation honestly when it drops items', () => {
		const { items, truncated } = capped([1, 2, 3, 4, 5], 2);
		expect(items).toEqual([1, 2]);
		expect(truncated).toBe(true);
	});

	it('does not claim truncation when everything fits', () => {
		const { items, truncated } = capped([1, 2], 5);
		expect(items).toHaveLength(2);
		expect(truncated).toBe(false);
	});

	it('rejects a maxResults a tool cannot honour', () => {
		expect(() => readMaxResults({ maxResults: 0 })).toThrow(/positive integer/);
		expect(() => readMaxResults({ maxResults: 1.5 })).toThrow();
		expect(() => readMaxResults({ maxResults: 'ten' })).toThrow();
	});

	it('clamps an oversized request rather than refusing it', () => {
		expect(readMaxResults({ maxResults: 999999 })).toBe(5000);
	});

	it('reads a cap written as an integer-valued float or exponent as the crate does', () => {
		// JSON Schema's `integer` is any number with a zero fractional part, and
		// the crate's server reads it with serde, where `2.0` and `1e3` are
		// floats: it refused them while this accepted them, and it accepted
		// `1E20` while this one and the crate refused it. The shared tool reads
		// all three the same way: a whole number of one or more, clamped.
		expect(readMaxResults({ maxResults: 2.0 })).toBe(2);
		expect(readMaxResults({ maxResults: 1e3 })).toBe(1000);
		expect(readMaxResults({ maxResults: 1e20 })).toBe(5000);
		expect(readMaxResults({ maxResults: Number.MAX_VALUE })).toBe(5000);
		expect(() => readMaxResults({ maxResults: 2.5 })).toThrow(
			/positive integer/,
		);
		expect(() =>
			readMaxResults({ maxResults: Number.POSITIVE_INFINITY }),
		).toThrow(/positive integer/);
		expect(() => readMaxResults({ maxResults: Number.NaN })).toThrow(
			/positive integer/,
		);
	});
});

describe('fileType: tolerant resolution', () => {
	it('accepts the file types the engine already parses', () => {
		expect(resolveFormat('json', undefined)).toBe('json');
	});

	it('accepts the shorthands an agent actually sends', () => {
		expect(resolveFormat('yml', undefined)).toBe('yaml');
		expect(resolveFormat('.TOML', undefined)).toBe('toml');
		expect(resolveFormat(' jsonc ', undefined)).toBe('jsonc');
		expect(resolveFormat(undefined, 'data.tsv')).toBe('tsv');
		// `conf` is not INI: a redis or nginx config has no sections and no `=`,
		// and the INI reader took it as a valid document holding nothing. The
		// crate reads it as text, and so does this.
		expect(resolveFormat(' conf ', undefined)).toBe('unknown');
	});

	it('resolves a dotfile whose whole name is the type', () => {
		expect(resolveFormat(undefined, '.env')).toBe('env');
	});

	it('reads every dotenv spelling as dotenv, as the crate does', () => {
		// `.env.local` split on its last dot, asked `local` for a format and
		// fell to the text scan, which has no comment rule: a commented-out
		// `# OFF=600` became a finding here and not on the crate's server.
		for (const name of [
			'.env.local',
			'.env.production',
			'.env.test.local',
			'app.env',
			'env',
			'.ENV.Production',
		]) {
			expect(resolveFormat(undefined, name), name).toBe('env');
		}
	});

	it('leaves a source file and a direnv script alone', () => {
		expect(resolveFormat(undefined, 'env.ts')).toBe('typescript');
		expect(resolveFormat(undefined, 'environment.json')).toBe('json');
		expect(resolveFormat(undefined, 'sender.env.rs')).toBe('rust');
		expect(resolveFormat(undefined, '.envrc')).toBe('unknown');
	});

	it('drops every leading dot from a format name, as the crate does', () => {
		expect(resolveFormat('..json', undefined)).toBe('json');
	});

	it('infers from a filename when no format is given', () => {
		expect(resolveFormat(undefined, 'config.toml')).toBe('toml');
	});

	it('falls back to unknown rather than refusing', () => {
		// The engine scans plain text for `unknown`, so returning it is a useful
		// answer. Refusing here would be the actual bug.
		expect(resolveFormat('klingon', 'a.klingon')).toBe('unknown');
		expect(resolveFormat(undefined, undefined)).toBe('unknown');
	});

	it('advertises only formats the engine parses', () => {
		expect(SUPPORTED_FORMATS).toContain('json');
		expect(SUPPORTED_FORMATS).not.toContain('unknown');
	});

	it('does not read a prototype key as a format', () => {
		// The table was a plain object, so `ALIASES['constructor']` was Object's
		// constructor and `ALIASES['__proto__']` was Object.prototype: both
		// truthy, both returned as the file type.
		for (const name of ['constructor', '__proto__', 'toString', 'valueOf']) {
			expect(resolveFormat(name, undefined)).toBe('unknown');
			expect(resolveFormat(undefined, name)).toBe('unknown');
			expect(resolveFormat(undefined, `notes.${name}`)).toBe('unknown');
		}
	});
});

describe('tool table', () => {
	it('pins the tool names', () => {
		expect(TOOLS.map((t) => t.name)).toEqual(['extract_numbers']);
	});

	it('gives every tool a description and a closed schema', () => {
		for (const tool of TOOLS) {
			expect(tool.description.length).toBeGreaterThan(20);
			expect(tool.inputSchema.type).toBe('object');
			expect(tool.inputSchema.additionalProperties).toBe(false);
			expect(typeof tool.handler).toBe('function');
		}
	});

	it('caps results by default rather than leaving it unbounded', () => {
		const schema = TOOLS[0]?.inputSchema as {
			properties: { maxResults: { default: number } };
		};
		expect(schema.properties.maxResults.default).toBe(500);
	});
});

describe('extract_numbers', () => {
	const call = async (args: Record<string, unknown>) => {
		const tool = TOOLS[0];
		if (!tool) throw new Error('no tool');
		return (await tool.handler(args)) as {
			ok: boolean;
			data: {
				numbers: { value: number; notation: string }[];
				fileType: string;
			};
			meta: { count: number; truncated: boolean };
		};
	};

	const values = (numbers: { value: number }[]) =>
		numbers.map((found) => found.value);

	it('parses a known format', async () => {
		const result = await call({
			content: '{"port": 8080, "ratio": 1.5}',
			format: 'json',
		});
		expect(values(result.data.numbers)).toContain(8080);
		expect(values(result.data.numbers)).toContain(1.5);
		expect(result.data.numbers[0]?.notation).toBe('decimal');
		expect(result.ok).toBe(true);
	});

	it('scans plain text when no format is given', async () => {
		// The behaviour that makes this server different: no format still works.
		const result = await call({ content: 'retry after 30 seconds, up to 5' });
		expect(result.data.fileType).toBe('unknown');
		expect(values(result.data.numbers)).toContain(30);
		expect(values(result.data.numbers)).toContain(5);
	});

	it('collapses repeats only when asked', async () => {
		const content = '{"a": 42, "b": 42}';
		const kept = await call({ content, format: 'json' });
		const deduped = await call({ content, format: 'json', dedupe: true });
		expect(kept.meta.count).toBe(2);
		expect(deduped.meta.count).toBe(1);
	});

	it('truncates at maxResults and says so', async () => {
		const content = JSON.stringify(
			Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i])),
		);
		const result = await call({ content, format: 'json', maxResults: 3 });
		expect(result.meta.count).toBe(3);
		expect(result.meta.truncated).toBe(true);
	});

	it('requires content', async () => {
		await expect(call({ format: 'json' })).rejects.toThrow(
			/content is required/,
		);
	});
});

describe('protocol', () => {
	const respond = createResponder(
		{ name: 'numbers-le', version: '1.0.0' },
		TOOLS,
	);

	it("answers with its own protocol version, as the crate's server does", async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2024-11-05' },
		});
		expect(reply?.result?.protocolVersion).toBe('2025-06-18');
		expect(reply?.result?.capabilities).toEqual({ tools: {} });
		expect(reply?.result?.serverInfo).toEqual({
			name: 'numbers-le',
			version: '1.0.0',
		});
	});

	it('does not reply to a notification, a null id included', async () => {
		// A reply to a notification is the classic way to wedge a client.
		expect(
			await respond({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		).toBeNull();
		expect(
			await respond({ jsonrpc: '2.0', id: null, method: 'initialize' }),
		).toBeNull();
	});

	it("refuses notifications/initialized sent with an id as a method it does not implement, as the crate's server does", async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 7,
			method: 'notifications/initialized',
		});
		expect(reply?.error?.code).toBe(-32601);
	});

	it('refuses in the words the other two servers use', async () => {
		// Three servers ship from this repository; a client must not be able
		// to tell them apart by what it sent.
		expect(
			(await respond({ jsonrpc: '2.0', id: 1, method: 'resources/list' }))
				?.error?.message,
		).toBe('Unknown method: resources/list');
		expect(
			(
				await respond({
					jsonrpc: '2.0',
					id: 1,
					method: 'tools/call',
					params: { name: 'nope' },
				})
			)?.error?.message,
		).toBe('Unknown tool: nope');
		expect(
			(await respond({ jsonrpc: '2.0', id: 1, method: 'tools/call' }))?.error
				?.message,
		).toBe('tools/call requires a string `name`');
		expect(
			(
				await respond({
					jsonrpc: '2.0',
					id: 1,
					method: 'tools/call',
					params: { name: 3 },
				})
			)?.error?.message,
		).toBe('tools/call requires a string `name`');
	});

	it('reports an unknown method as a JSON-RPC error', async () => {
		const reply = await respond({ jsonrpc: '2.0', id: 2, method: 'nope' });
		expect(reply?.error?.code).toBe(-32601);
	});

	it('reports an unknown tool without killing the connection', async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 3,
			method: 'tools/call',
			params: { name: 'no_such_tool', arguments: {} },
		});
		expect(reply?.error?.code).toBe(-32602);
	});

	it('refuses an argument that does not fit the schema as a protocol error, in the words the other two servers use', async () => {
		// It was an isError result, which a host shows to the agent as the
		// tool's own failure; a wrong type on an optional argument was read as
		// absent. The schema is what the agent read before sending, so a
		// violation is -32602, and `additionalProperties: false` is enforced.
		for (const [args, message] of [
			[{}, 'content is required and must be a string'],
			[
				{ content: '1', maxResults: 2.5 },
				'maxResults must be a positive integer',
			],
			[{ content: '1', format: 7 }, 'format must be a string'],
			[{ content: '1', filename: 7 }, 'filename must be a string'],
			[{ content: '1', dedupe: 'yes' }, 'dedupe must be a boolean'],
			[{ content: '1', extra: true }, 'unknown argument: extra'],
			[
				{ content: '1', extra: true, another: 1 },
				'unknown arguments: another, extra',
			],
		] as const) {
			const reply = await respond({
				jsonrpc: '2.0',
				id: 4,
				method: 'tools/call',
				params: { name: 'extract_numbers', arguments: args },
			});
			expect(reply?.result, JSON.stringify(args)).toBeUndefined();
			expect(reply?.error, JSON.stringify(args)).toEqual({
				code: -32602,
				message,
			});
		}
	});
});

describe('serve: the stdio loop', () => {
	/** A fake stdin/stdout pair so the loop can be driven without a process. */
	function harness() {
		const input = new EventEmitter() as EventEmitter & {
			setEncoding?: (e: string) => void;
		};
		const written: string[] = [];
		const output = {
			write: (chunk: string) => {
				written.push(chunk);
				return true;
			},
		};
		serve(
			{ name: 'numbers-le', version: '1.0.0' },
			TOOLS,
			input as never,
			output as never,
		);
		const replies = () =>
			written
				.join('')
				.split('\n')
				.filter(Boolean)
				.map((l) => JSON.parse(l));
		return { input, replies };
	}

	const settle = () => new Promise((r) => setTimeout(r, 20));

	it('answers a request delivered as one line', async () => {
		const { input, replies } = harness();
		input.emit('data', '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
		await settle();
		expect(replies()[0]?.result?.tools).toHaveLength(1);
	});

	it('reassembles a request split across chunks', async () => {
		// stdin delivers whatever the OS gives it; a request arriving in two
		// pieces must not be dropped or double-parsed.
		const { input, replies } = harness();
		input.emit('data', '{"jsonrpc":"2.0","id":2,"me');
		input.emit('data', 'thod":"ping"}\n');
		await settle();
		expect(replies()[0]?.id).toBe(2);
	});

	it('handles several requests in one chunk', async () => {
		const { input, replies } = harness();
		input.emit(
			'data',
			'{"jsonrpc":"2.0","id":3,"method":"ping"}\n{"jsonrpc":"2.0","id":4,"method":"ping"}\n',
		);
		await settle();
		expect(replies().map((r) => r.id)).toEqual([3, 4]);
	});

	it('reports malformed JSON without dying', async () => {
		// One bad line from a client must not take the server down for everyone.
		const { input, replies } = harness();
		input.emit('data', 'not json at all\n');
		input.emit('data', '{"jsonrpc":"2.0","id":5,"method":"ping"}\n');
		await settle();
		expect(replies()[0]?.error?.code).toBe(-32700);
		expect(replies()[1]?.id).toBe(5);
	});

	it('rejects a payload that is not a JSON-RPC request', async () => {
		const { input, replies } = harness();
		input.emit('data', '{"hello":"world"}\n');
		await settle();
		expect(replies()[0]?.error?.code).toBe(-32700);
	});

	it("refuses a frame led by a byte order mark as not JSON, as the crate's server does", async () => {
		// JavaScript's trim strips the mark; Rust's does not, and serde_json
		// refuses it. The loop trims as Rust trims.
		const { input, replies } = harness();
		input.emit('data', '\uFEFF{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
		input.emit('data', '\u0085 \t\n{"jsonrpc":"2.0","id":2,"method":"ping"}\n');
		await settle();
		expect(replies().map((r) => r.error?.message ?? r.id)).toEqual([
			'Invalid JSON',
			2,
		]);
	});

	it('ignores blank lines', async () => {
		const { input, replies } = harness();
		input.emit('data', '\n\n{"jsonrpc":"2.0","id":6,"method":"ping"}\n');
		await settle();
		expect(replies()).toHaveLength(1);
	});

	it('writes nothing for a notification', async () => {
		const { input, replies } = harness();
		input.emit(
			'data',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
		);
		await settle();
		expect(replies()).toHaveLength(0);
	});

	it('refuses a frame over the limit whose newline arrives in the same chunk', async () => {
		// The over-limit check on the leftover buffer never sees a line that
		// arrives whole; the limit is on the line, not on its framing.
		const { input, replies } = harness();
		input.emit(
			'data',
			`${'x'.repeat(MAX_FRAME_BYTES + 1)}\n{"jsonrpc":"2.0","id":8,"method":"ping"}\n`,
		);
		await settle();
		expect(replies().map((r) => r.error?.message ?? r.id)).toEqual([
			`Message exceeds the ${MAX_FRAME_BYTES} byte frame limit`,
			8,
		]);
	});

	it('refuses a frame over the limit and keeps serving', async () => {
		// Input with no newline grew the buffer without bound: 64 MiB of it
		// held the process near a gigabyte and answered nothing. Past the
		// limit the frame is refused with a parse error, the rest of that line
		// is dropped as it arrives, and the next line is served.
		const { input, replies } = harness();
		input.emit('data', 'x'.repeat(MAX_FRAME_BYTES + 1));
		input.emit('data', 'y'.repeat(1000));
		input.emit('data', 'z\n{"jsonrpc":"2.0","id":9,"method":"ping"}\n');
		await settle();
		expect(replies()).toEqual([
			{
				jsonrpc: '2.0',
				id: null,
				error: {
					code: -32700,
					message: `Message exceeds the ${MAX_FRAME_BYTES} byte frame limit`,
				},
			},
			{ jsonrpc: '2.0', id: 9, result: {} },
		]);
	});
});

describe('serve: a client that reads slowly', () => {
	// The pipe to the client fills; `write` answers false. Every reply after
	// that would sit in this process until the client drained the pipe, so
	// the server stops reading until it does: what it holds is bounded by
	// the requests already in flight, not by everything the client sent.
	function slowReader() {
		const input = new PassThrough();
		const written: string[] = [];
		let full = false;
		const output = Object.assign(new EventEmitter(), {
			write: (chunk: string) => {
				written.push(chunk);
				return !full;
			},
		});
		serve(
			{ name: 'numbers-le', version: '1.0.0' },
			TOOLS,
			input,
			output as never,
		);
		return {
			input,
			output,
			written,
			fill: () => {
				full = true;
			},
			drain: () => {
				full = false;
				output.emit('drain');
			},
		};
	}

	const settle = () => new Promise((r) => setTimeout(r, 20));
	const ping = (id: number) => `{"jsonrpc":"2.0","id":${id},"method":"ping"}\n`;

	it('stops reading while the pipe is full and resumes when it drains', async () => {
		const reader = slowReader();
		reader.fill();
		reader.input.write(ping(1));
		await settle();
		expect(reader.written).toHaveLength(1);
		expect(reader.input.isPaused()).toBe(true);

		reader.input.write(ping(2));
		await settle();
		expect(reader.written).toHaveLength(1);

		reader.drain();
		await settle();
		expect(reader.input.isPaused()).toBe(false);
		expect(reader.written).toHaveLength(2);
		expect(JSON.parse(reader.written[1] ?? '').id).toBe(2);
	});

	it('reads on while the pipe accepts every reply', async () => {
		const reader = slowReader();
		reader.input.write(ping(1) + ping(2) + ping(3));
		await settle();
		expect(reader.written).toHaveLength(3);
		expect(reader.input.isPaused()).toBe(false);
	});
});
