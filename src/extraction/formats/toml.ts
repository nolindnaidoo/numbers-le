/**
 * The crate's `toml.rs`: `text.parse::<toml::Table>()` at toml 1.1 with
 * `preserve_order`. Integers and floats are numbers; a boolean or a datetime
 * holds none.
 */

import { loadToml, type TomlValue } from '../../parsers/toml/load';
import type { ExtractionResult } from '../../types';
import { answer, collect, OTHER, type Value } from './typed';

function convert(value: TomlValue): Value {
	if (value.type === 'integer')
		return { type: 'number', value: Number(value.value) };
	if (value.type === 'float') return { type: 'number', value: value.value };
	if (value.type === 'string') return { type: 'text', text: value.text };
	if (value.type === 'array')
		return { type: 'seq', items: value.items.map(convert) };
	if (value.type === 'table')
		return {
			type: 'seq',
			items: value.entries.map(([, item]) => convert(item)),
		};
	return OTHER;
}

export function extractFromToml(
	text: string,
	filepath: string,
): ExtractionResult {
	const parsed = loadToml(text);
	if (typeof parsed === 'string')
		return answer([], `Failed to parse TOML: ${parsed}`, filepath);
	return answer(collect(convert(parsed), 'typed'), undefined, filepath);
}
