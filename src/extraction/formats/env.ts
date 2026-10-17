/**
 * The crate's `dotenv.rs`: one `KEY=value` per line, read line by line, so a
 * repeated key counts each time. A value that reads strictly as a number is
 * one, once its quotes or its inline comment are gone.
 */
import type { ExtractionResult } from '../../types';
import { parseStrictNumber } from '../heuristics';
import { answer } from './typed';

function stripInlineComment(value: string): string {
	if (value.startsWith('"') || value.startsWith("'")) return value;
	const hash = value.indexOf('#');
	return hash === -1 ? value : value.slice(0, hash).trim();
}

function unquote(value: string): string {
	for (const quote of ['"', "'"]) {
		if (value.length > 1 && value.startsWith(quote) && value.endsWith(quote))
			return value.slice(1, -1);
	}
	return value;
}

function numberOnLine(rawLine: string) {
	const line = rawLine.trim();
	if (line === '' || line.startsWith('#')) return undefined;
	const content = line.startsWith('export ') ? line.slice(7).trim() : line;
	const equals = content.indexOf('=');
	if (equals === -1) return undefined;
	return parseStrictNumber(
		unquote(stripInlineComment(content.slice(equals + 1).trim())),
	);
}

export function extractFromEnv(
	text: string,
	filepath: string,
): ExtractionResult {
	const numbers = rustLines(text).flatMap((line) => numberOnLine(line) ?? []);
	return answer(numbers, undefined, filepath);
}

/** `str::lines`: split on `\n`, drop one `\r` before it, no empty last line. */
function rustLines(text: string): string[] {
	if (text === '') return [];
	const out = text.split('\n');
	if (out.at(-1) === '') out.pop();
	return out.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}
