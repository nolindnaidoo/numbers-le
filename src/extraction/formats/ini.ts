/**
 * The crate's `ini.rs`: rust-ini 0.21 with escapes off. INI values are
 * text, so a value that reads strictly as a number is one.
 */

import { loadIni } from '../../parsers/ini';
import type { ExtractionResult } from '../../types';
import { answer, collect } from './typed';

export function extractFromIni(
	text: string,
	filepath: string,
): ExtractionResult {
	const sections = loadIni(text);
	if (typeof sections === 'string')
		return answer([], `Failed to parse INI: ${sections}`, filepath);
	const items = sections.flatMap((section) =>
		section.properties.map(([, value]) => ({
			type: 'text' as const,
			text: value,
		})),
	);
	return answer(
		collect({ type: 'seq', items }, 'untyped'),
		undefined,
		filepath,
	);
}
