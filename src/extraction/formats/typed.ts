/**
 * The crate's `policy::Value` and `collect`: a parsed document as numbers,
 * text and containers, walked in document order. Typed formats (JSON, YAML,
 * TOML) count only what the parser resolved as a number; untyped ones (INI)
 * count text that reads as one.
 */
import type { NumberFinding, ParseError } from '../../types';
import { isExtractableNumber, parseStrictNumber } from '../heuristics';

export type Value =
	| { readonly type: 'number'; readonly value: number }
	| { readonly type: 'text'; readonly text: string }
	| { readonly type: 'other' }
	| { readonly type: 'seq'; readonly items: readonly Value[] };

export const OTHER: Value = Object.freeze({ type: 'other' });

export function collect(
	value: Value,
	coercion: 'typed' | 'untyped',
): NumberFinding[] {
	const out: NumberFinding[] = [];
	const walk = (node: Value): void => {
		if (node.type === 'number') {
			if (isExtractableNumber(node.value))
				out.push({ value: node.value, notation: 'decimal' });
		} else if (node.type === 'text') {
			if (coercion === 'untyped') {
				const parsed = parseStrictNumber(node.text);
				if (parsed !== undefined) out.push(parsed);
			}
		} else if (node.type === 'seq') {
			for (const item of node.items) walk(item);
		}
	};
	walk(value);
	return out;
}

/** The crate's answer for one format: its numbers, or its parse error. */
export function answer(
	numbers: readonly NumberFinding[],
	error: string | undefined,
	filepath: string,
) {
	const errors: ParseError[] =
		error === undefined
			? []
			: [{ type: 'parse-error', message: error, filepath }];
	return {
		success: error === undefined,
		numbers: Object.freeze(error === undefined ? [...numbers] : []),
		errors: Object.freeze(errors),
	};
}
