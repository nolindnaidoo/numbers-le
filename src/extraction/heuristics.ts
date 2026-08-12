/**
 * Shared numeric heuristics for every format extractor.
 *
 * One policy, applied uniformly (v1.x had four divergent copies of the
 * structure walker and three hand-rolled CSV splitters):
 *
 * - Only finite numbers are extracted. NaN and ±Infinity are rejected
 *   even where a format can express them (YAML `.inf`, TOML `inf`) —
 *   an extracted "Infinity" line is noise to every downstream use, and
 *   JSON cannot express them at all, so finite-only keeps formats
 *   consistent.
 * - String coercion is opt-in per format. INI, .env, and CSV values are
 *   inherently strings, so numeric-looking strings there ARE numbers.
 *   JSON, YAML, and TOML distinguish `42` from `"42"`; quoted numbers
 *   in those formats are data, not numbers, and are never extracted.
 * - Coerced strings must be numeric in full: plain decimals with an
 *   optional sign, decimal point, and exponent. Leading-garbage parses
 *   ("12abc" → 12), dotted versions ("1.2.3" → 1.2), and JS numeric
 *   literal extensions ("0x1A", "1_000") are intentionally rejected —
 *   v1.x's parseFloat accepted the first two silently.
 * - Every finding carries the notation its source used. A parsed value
 *   arrives as `decimal` because its parser already resolved the token;
 *   a coerced string keeps what its text said, because that text is
 *   read here.
 */

import type { Notation, NumberFinding } from '../types';

const STRICT_NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Decimal or scientific, for a token matching the plain grammar above.
 * Nothing else can appear there: the strict test rejects every base
 * prefix before this is reached.
 */
export function plainNotation(token: string): Notation {
	return /[eE]/.test(token) ? 'scientific' : 'decimal';
}

/** Parse a string as a number only if the entire string is numeric. */
export function parseStrictNumber(raw: string): NumberFinding | undefined {
	const trimmed = raw.trim();
	if (!STRICT_NUMBER_RE.test(trimmed)) return undefined;
	const value = Number(trimmed);
	if (!Number.isFinite(value)) return undefined;
	return { value, notation: plainNotation(trimmed) };
}

/** True for the numbers the extractor emits: finite, actual numbers. */
export function isExtractableNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export type CollectOptions = Readonly<{
	/** Coerce full-string numerics ("42", "-1.5e3") into numbers. */
	coerceStrings: boolean;
}>;

/**
 * Depth-first walk over a parsed structure (objects, arrays, scalars),
 * collecting numbers in document order.
 */
export function collectNumbers(
	value: unknown,
	options: CollectOptions,
): readonly NumberFinding[] {
	const numbers: NumberFinding[] = [];
	walk(value, options, numbers);
	return Object.freeze(numbers);
}

function walk(
	value: unknown,
	options: CollectOptions,
	out: NumberFinding[],
): void {
	if (isExtractableNumber(value)) {
		// The parser already resolved this one, notation and all.
		out.push({ value, notation: 'decimal' });
		return;
	}

	if (typeof value === 'string') {
		if (options.coerceStrings) {
			const parsed = parseStrictNumber(value);
			if (parsed !== undefined) out.push(parsed);
		}
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) walk(item, options, out);
		return;
	}

	if (value && typeof value === 'object' && !(value instanceof Date)) {
		for (const prop of Object.values(value)) walk(prop, options, out);
	}
}

/**
 * Numbers in free-form text: plain decimals with optional sign,
 * decimal point, and exponent. "3.14.15" reads as 3.14 and 15 — the
 * fallback has no grammar to know better, which is why it is reserved
 * for prose. A source language goes to extractFromSource instead.
 */
const TEXT_NUMBER_RE = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g;

export function scanTextForNumbers(text: string): readonly NumberFinding[] {
	const numbers: NumberFinding[] = [];
	for (const match of text.matchAll(TEXT_NUMBER_RE)) {
		const value = Number(match[0]);
		if (Number.isFinite(value)) {
			numbers.push({ value, notation: plainNotation(match[0]) });
		}
	}
	return Object.freeze(numbers);
}
