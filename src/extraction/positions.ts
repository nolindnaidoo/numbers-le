import type { FileType, NumberFinding } from '../types';
import { scanSourceSpanned } from './formats/source';
import { TEXT_NUMBER_RE } from './heuristics';

export type Position = Readonly<{ line: number; column: number }>;

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/**
 * Where each extracted number starts, where that is known rather than
 * guessed: JSON (every number token, in document order), the source
 * languages and the plain-text scan (their scanners carry the offset).
 * Everything else — TOML, YAML, INI, CSV, dotenv — hands over numbers its
 * parser already resolved, and a position there would be a search for the
 * value, which can land on the digits in a key. Those get none.
 *
 * Positions attach only when the spanned scan and the extracted list agree
 * one to one; a JSON object with a repeated key, say, reports each value
 * once to `JSON.parse` and twice to a token scan, and then none is placed.
 * The crate's `mcp/extract.rs` applies the same rule.
 */
export function exactPositions(
	text: string,
	fileType: FileType,
	numbers: readonly NumberFinding[],
	isSource: boolean,
): readonly (Position | undefined)[] | undefined {
	const spanned = spannedValues(text, fileType, isSource);
	if (spanned === undefined || spanned.length !== numbers.length) {
		return undefined;
	}
	if (spanned.some((s, i) => !Object.is(s.value, numbers[i]?.value))) {
		return undefined;
	}
	const at = positionIndex(text);
	return spanned.map((s) => at(s.offset));
}

function spannedValues(
	text: string,
	fileType: FileType,
	isSource: boolean,
): readonly { value: number; offset: number }[] | undefined {
	if (isSource) {
		return scanSourceSpanned(text, fileType).map((s) => ({
			value: s.finding.value,
			offset: s.offset,
		}));
	}
	if (fileType === 'json') return jsonNumbers(text);
	if (fileType === 'unknown') {
		const out: { value: number; offset: number }[] = [];
		for (const match of text.matchAll(TEXT_NUMBER_RE)) {
			const value = Number(match[0]);
			if (Number.isFinite(value)) out.push({ value, offset: match.index });
		}
		return out;
	}
	return undefined;
}

/** Every number token of a document `JSON.parse` accepts, strings skipped. */
function jsonNumbers(text: string): { value: number; offset: number }[] {
	const out: { value: number; offset: number }[] = [];
	let i = 0;
	while (i < text.length) {
		const c = text[i] as string;
		if (c === '"') {
			i += 1;
			while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
			i += 1;
			continue;
		}
		if (c === '-' || (c >= '0' && c <= '9')) {
			JSON_NUMBER.lastIndex = i;
			const token = JSON_NUMBER.exec(text)?.[0] ?? c;
			const value = Number(token);
			if (Number.isFinite(value)) out.push({ value, offset: i });
			i += token.length;
			continue;
		}
		i += 1;
	}
	return out;
}

/** UTF-16 offset to 1-based line and UTF-16 column, as an editor counts. */
function positionIndex(text: string): (offset: number) => Position {
	const starts = [0];
	for (let i = 0; i < text.length; i++)
		if (text[i] === '\n') starts.push(i + 1);
	return (offset) => {
		let lo = 0;
		let hi = starts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if ((starts[mid] as number) <= offset) lo = mid;
			else hi = mid - 1;
		}
		return { line: lo + 1, column: offset - (starts[lo] as number) + 1 };
	};
}
