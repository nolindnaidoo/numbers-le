/**
 * Every number in a document and where it was found, as the Rust CLI's
 * `extract/locate.rs` places it.
 *
 * JSON, the source languages and the plain-text scan know their offsets, so
 * they are placed exactly. Every other format hands over values its parser
 * already resolved, and each is paired with the next numeric run in the text
 * that parses to the same double, forward only. A value no run spells, such
 * as TOML's `0x1A`, has no position.
 */
import { extractNumber, isSourceLanguage } from '../extraction/extract';
import { jsonNumberSpans } from '../extraction/formats/json';
import { scanSourceSpanned } from '../extraction/formats/source';
import { plainNotation } from '../extraction/heuristics';
import type {
	ExtractionResult,
	FileType,
	Notation,
	NumberFinding,
} from '../types';
import { canonical } from './format';

export type Position = Readonly<{ line: number; column: number }>;

export type Located = Readonly<{
	value: string;
	notation: Notation;
	position: Position | null;
}>;

type Spanned = Readonly<{ finding: NumberFinding; offset: number }>;

/**
 * The crate's text scan. Its `\d` is Unicode's, so a run that opens with a
 * digit from another script is consumed and then refused by the parse,
 * where an ASCII-only `\d` would report the ASCII digits after it.
 */
const TEXT_NUMBER =
	/[+-]?(?:\p{Nd}+(?:\.\p{Nd}*)?|\.\p{Nd}+)(?:[eE][+-]?\p{Nd}+)?/gu;

/** A number as JavaScript prints it, which is what the crate reproduces. */
export function render(value: number): string {
	return String(value);
}

/** Every number, placed, and why the document was refused if it was. */
export type Examined = Readonly<{
	found: readonly Located[];
	parseError: string | null;
}>;

/** The formats the crate's `parse_error` asks a parser about. */
const PARSED: readonly FileType[] = Object.freeze([
	'json',
	'jsonc',
	'yaml',
	'toml',
	'ini',
	'csv',
	'tsv',
]);

export function examine(text: string, format: string): Examined {
	const key = canonical(format);
	const at = positionIndex(text);
	const spans = spanned(text, key);
	if (spans !== undefined) {
		return Object.freeze({
			found: spans.map((span) => located(span.finding, at(span.offset))),
			parseError: spans.length === 0 ? refusal(text, key) : null,
		});
	}
	const result = extractNumber(text, key, '');
	const runs = textRuns(text);
	let cursor = 0;
	const found = result.numbers.map((finding) => {
		// Forward only: a run above the cursor belongs to a number already
		// reported, and taking it would put the report out of order.
		const index = nextRun(runs, cursor, finding.value);
		if (index === -1) return located(finding, null);
		cursor = index + 1;
		return located(finding, at((runs[index] as Spanned).offset));
	});
	return Object.freeze({ found, parseError: crateWording(result, key) });
}

/** A JSON document with no numbers may still be one the parser refused. */
function refusal(text: string, key: FileType): string | null {
	if (key !== 'json' && key !== 'jsonc') return null;
	return crateWording(extractNumber(text, key, ''), key);
}

/**
 * The crate says `Failed to parse <FORMAT>: ` before every parser's own
 * words, CSV included, and only for the formats it parses. The words after
 * it are each parser's and cannot match.
 */
function crateWording(result: ExtractionResult, key: FileType): string | null {
	const first = result.errors[0];
	if (!first || !PARSED.includes(key)) return null;
	return first.message;
}

/** Bit equality, as the crate compares: `-0` and `0` are different runs. */
function nextRun(
	runs: readonly Spanned[],
	from: number,
	value: number,
): number {
	for (let index = from; index < runs.length; index++) {
		if (Object.is((runs[index] as Spanned).finding.value, value)) return index;
	}
	return -1;
}

function located(finding: NumberFinding, position: Position | null): Located {
	return Object.freeze({
		value: render(finding.value),
		notation: finding.notation,
		position,
	});
}

function spanned(text: string, key: FileType): readonly Spanned[] | undefined {
	if (key === 'json' || key === 'jsonc') {
		return jsonNumberSpans(text, key === 'jsonc').map(({ value, offset }) => ({
			finding: { value, notation: 'decimal' },
			offset,
		}));
	}
	if (key === 'unknown') return textRuns(text);
	if (isSourceLanguage(key)) return scanSourceSpanned(text, key);
	return undefined;
}

/**
 * Every number token of a document the parser accepts, duplicate keys
 * included, because the crate walks the syntax tree rather than the object
 * `JSON.parse` builds from it. A document it refuses has none.
 */
function textRuns(text: string): readonly Spanned[] {
	const runs: Spanned[] = [];
	for (const match of text.matchAll(TEXT_NUMBER)) {
		const value = Number(match[0]);
		// `Number` reads only ASCII digits, as Rust's `f64` parse does.
		if (!/^[+\-.0-9eE]+$/.test(match[0]) || !Number.isFinite(value)) continue;
		runs.push({
			finding: { value, notation: plainNotation(match[0]) },
			offset: match.index,
		});
	}
	return runs;
}

/** UTF-16 offset to a 1-based line and a 1-based UTF-16 column. */
export function positionIndex(text: string): (offset: number) => Position {
	const starts = [0];
	for (let index = 0; index < text.length; index++) {
		if (text.charCodeAt(index) === 10) starts.push(index + 1);
	}
	return (offset) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if ((starts[middle] as number) > offset) {
				high = middle - 1;
				continue;
			}
			low = middle;
		}
		return Object.freeze({
			line: low + 1,
			column: offset - (starts[low] as number) + 1,
		});
	};
}
