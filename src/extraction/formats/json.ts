/**
 * The crate's `json.rs`: jsonc-parser 0.33's AST, strict for JSON and with
 * comments and trailing commas for JSONC. Every property counts, a repeated
 * key included, as the AST keeps them all.
 */

import { JsoncError, type JsonValue, parseJsonc } from '../../parsers/jsonc';
import type { ExtractionResult } from '../../types';
import { answer, collect, OTHER, type Value } from './typed';

function convert(node: JsonValue): Value {
	if (node.type === 'number')
		return { type: 'number', value: Number(node.text) };
	if (node.type === 'string') return { type: 'text', text: node.value };
	if (node.type === 'array')
		return { type: 'seq', items: node.elements.map(convert) };
	if (node.type === 'object')
		return { type: 'seq', items: node.properties.map((p) => convert(p.value)) };
	return OTHER;
}

export function extractFromJson(
	text: string,
	filepath: string,
	comments = false,
): ExtractionResult {
	let root: JsonValue | undefined;
	try {
		root = parseJsonc(text, comments);
	} catch (error) {
		if (!(error instanceof JsoncError)) throw error;
		return answer([], `Failed to parse JSON: ${error.message}`, filepath);
	}
	// jsonc-parser reads an empty document as a parse of nothing.
	if (root === undefined)
		return answer(
			[],
			'Failed to parse JSON: unexpected end of input',
			filepath,
		);
	return answer(collect(convert(root), 'typed'), undefined, filepath);
}

/**
 * The crate's `extract_spanned`: each number literal the AST holds, with the
 * UTF-16 index it starts at, or none when the document does not parse.
 */
export function jsonNumberSpans(
	text: string,
	comments: boolean,
): { value: number; offset: number }[] {
	let root: JsonValue | undefined;
	try {
		root = parseJsonc(text, comments);
	} catch (error) {
		if (!(error instanceof JsoncError)) throw error;
		return [];
	}
	const out: { value: number; offset: number }[] = [];
	const visit = (node: JsonValue): void => {
		if (node.type === 'number') {
			const value = Number(node.text);
			if (Number.isFinite(value)) out.push({ value, offset: node.start });
		} else if (node.type === 'array') node.elements.forEach(visit);
		else if (node.type === 'object')
			for (const p of node.properties) visit(p.value);
	};
	if (root !== undefined) visit(root);
	return out;
}
