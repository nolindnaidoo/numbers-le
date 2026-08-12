import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { ExtractionResult } from '../types';
import { capped, isOk, readMaxResults, toDiagnostics } from './envelope';
import { resolveFormat, SUPPORTED_FORMATS } from './fileType';
import { TOOLS } from './tools';
import { createResponder, serve } from './transport';

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
});

describe('fileType: tolerant resolution', () => {
	it('accepts the file types the engine already parses', () => {
		expect(resolveFormat('json', undefined)).toBe('json');
	});

	it('accepts the shorthands an agent actually sends', () => {
		expect(resolveFormat('yml', undefined)).toBe('yaml');
		expect(resolveFormat('.TOML', undefined)).toBe('toml');
		expect(resolveFormat(' conf ', undefined)).toBe('ini');
	});

	it('resolves a dotfile whose whole name is the type', () => {
		expect(resolveFormat(undefined, '.env')).toBe('env');
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

	it('echoes the protocol version the client asked for', async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2024-11-05' },
		});
		expect(reply?.result?.protocolVersion).toBe('2024-11-05');
		expect(reply?.result?.serverInfo).toEqual({
			name: 'numbers-le',
			version: '1.0.0',
		});
	});

	it('does not reply to a notification', async () => {
		// A reply to a notification is the classic way to wedge a client.
		expect(
			await respond({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		).toBeNull();
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

	it('returns a tool failure as a result, not a protocol error', async () => {
		// A model can read an isError result and correct itself; a JSON-RPC error
		// reads as "the server is broken".
		const reply = await respond({
			jsonrpc: '2.0',
			id: 4,
			method: 'tools/call',
			params: { name: 'extract_numbers', arguments: {} },
		});
		expect(reply?.error).toBeUndefined();
		expect(reply?.result?.isError).toBe(true);
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
});
