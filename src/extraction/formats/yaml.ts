/**
 * The crate's `yaml.rs`: saphyr 0.1's `Yaml::load_from_str`, every document
 * of a stream, a mapping's values in hashlink's order. A tagged node is not
 * resolved, so it holds no number.
 */

import { loadYaml, type YamlNode } from '../../parsers/yaml/load';
import type { ExtractionResult } from '../../types';
import { answer, collect, OTHER, type Value } from './typed';

function convert(node: YamlNode): Value {
	if (node.k === 'int') return { type: 'number', value: Number(node.v) };
	if (node.k === 'float') return { type: 'number', value: node.v };
	if (node.k === 'str') return { type: 'text', text: node.v };
	if (node.k === 'seq') return { type: 'seq', items: node.items.map(convert) };
	if (node.k === 'map')
		return {
			type: 'seq',
			items: [...node.entries.values()].map(({ value }) => convert(value)),
		};
	return OTHER;
}

export function extractFromYaml(
	text: string,
	filepath: string,
): ExtractionResult {
	const documents = loadYaml(text);
	if (typeof documents === 'string')
		return answer([], `Failed to parse YAML: ${documents}`, filepath);
	return answer(
		collect({ type: 'seq', items: documents.map(convert) }, 'typed'),
		undefined,
		filepath,
	);
}
