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
 */

const STRICT_NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** Parse a string as a number only if the entire string is numeric. */
export function parseStrictNumber(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (!STRICT_NUMBER_RE.test(trimmed)) return undefined;
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : undefined;
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
): readonly number[] {
	const numbers: number[] = [];
	walk(value, options, numbers);
	return Object.freeze(numbers);
}

function walk(value: unknown, options: CollectOptions, out: number[]): void {
	if (isExtractableNumber(value)) {
		out.push(value);
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
 * fallback has no grammar to know better, which is why it is only used
 * when the file type is unknown.
 */
const TEXT_NUMBER_RE = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g;

export function scanTextForNumbers(text: string): readonly number[] {
	const numbers: number[] = [];
	for (const match of text.matchAll(TEXT_NUMBER_RE)) {
		const value = Number(match[0]);
		if (Number.isFinite(value)) numbers.push(value);
	}
	return Object.freeze(numbers);
}
