/**
 * One file end to end, as the Rust CLI's `scan.rs` does it, over the
 * extension's extraction engine.
 *
 * The report's shape and field order are the crate's, because stdout is
 * protocol: a script reading JSON Lines from `numbers-le` cannot know which
 * of the two binaries it is talking to.
 */
import { readFileSync } from 'node:fs';
import { basename, sep } from 'node:path';
import type { Notation } from '../types';
import { resolveFormat } from './format';
import { decodeUtf8OrThrow, rustIoMessage, withoutBom } from './ioError';
import { examine, type Located } from './locate';

export interface ReportDiagnostic {
	readonly severity: 'warning' | 'error';
	readonly code: string;
	readonly message: string;
}

/** `line` and `column` are absent, not zero, when no run in the source spells the value. */
export interface FoundNumber {
	readonly value: string;
	readonly notation: Notation;
	readonly line?: number;
	readonly column?: number;
}

export interface FileReport {
	readonly file: string;
	readonly format: string;
	readonly numbers: readonly FoundNumber[];
	readonly diagnostics: readonly ReportDiagnostic[];
	readonly summary: {
		readonly numbers: number;
		readonly unlocated: number;
	};
}

export interface ScanOptions {
	readonly dedupe: boolean;
	readonly format: string | null;
}

export const DEFAULT_SCAN: ScanOptions = Object.freeze({
	dedupe: false,
	format: null,
});

export type Scanned =
	| { readonly kind: 'text'; readonly report: FileReport }
	| { readonly kind: 'binary' };

const BINARY_WINDOW = 8 * 1024;

export function scanFile(path: string, options: ScanOptions): Scanned {
	const file = reportedPath(path);
	const format = options.format ?? formatOf(path);

	let bytes: Buffer;
	try {
		bytes = readFileSync(path);
	} catch (error) {
		return text(skipped(file, format, rustIoMessage(error)));
	}
	if (looksBinary(bytes)) return { kind: 'binary' };

	const content = decodeUtf8(bytes);
	if (content === null) return text(skipped(file, format, 'not UTF-8 text'));
	return text(scanContent(withoutBom(content), file, format, options));
}

/**
 * The report for a path the walk itself could not open. Carried as a
 * warning, so it is named and fails `--strict` without ending the run.
 */
export function unreadable(path: string, reason: string): FileReport {
	return skipped(reportedPath(path), formatOf(path), reason);
}

export function scanContent(
	content: string,
	file: string,
	format: string,
	options: ScanOptions,
): FileReport {
	const { found, parseError } = examine(content, format);
	const kept = options.dedupe ? firstOfEachValue(found) : found;
	// A parse failure is a fact about the file, not a failed run: one
	// malformed config must not fail an audit of ten thousand files.
	const diagnostics: ReportDiagnostic[] =
		parseError === null
			? []
			: [{ severity: 'warning', code: 'unparsed', message: parseError }];

	return Object.freeze({
		file,
		format,
		numbers: Object.freeze(kept.map(asFound)),
		diagnostics: Object.freeze(diagnostics),
		summary: Object.freeze({
			numbers: kept.length,
			unlocated: kept.filter((item) => item.position === null).length,
		}),
	});
}

/** grep's convention: 0 found · 1 none found · 2 could not answer. */
export function exitCode(
	reports: readonly FileReport[],
	strict: boolean,
): number {
	if (reports.some(isIncomplete)) return 2;
	if (strict && reports.some(wasSkipped)) return 2;
	return reports.some((report) => report.summary.numbers > 0) ? 0 : 1;
}

export function describe(report: FileReport, found: FoundNumber): string {
	if (found.line === undefined) return `${report.file}:-  ${found.value}`;
	return `${report.file}:${found.line}:${found.column}  ${found.value}`;
}

function formatOf(path: string): string {
	return resolveFormat(undefined, basename(path));
}

function asFound(item: Located): FoundNumber {
	if (item.position === null) {
		return { value: item.value, notation: item.notation };
	}
	return {
		value: item.value,
		notation: item.notation,
		line: item.position.line,
		column: item.position.column,
	};
}

/** The first occurrence keeps its own position. */
function firstOfEachValue(found: readonly Located[]): Located[] {
	const seen = new Set<string>();
	return found.filter((item) => {
		if (seen.has(item.value)) return false;
		seen.add(item.value);
		return true;
	});
}

function isIncomplete(report: FileReport): boolean {
	return report.diagnostics.some(
		(diagnostic) => diagnostic.severity === 'error',
	);
}

function wasSkipped(report: FileReport): boolean {
	return report.diagnostics.some((diagnostic) => diagnostic.code === 'skipped');
}

function text(report: FileReport): Scanned {
	return { kind: 'text', report };
}

function skipped(file: string, format: string, reason: string): FileReport {
	return Object.freeze({
		file,
		format,
		numbers: Object.freeze([]),
		diagnostics: Object.freeze([
			{ severity: 'warning' as const, code: 'skipped', message: reason },
		]),
		summary: Object.freeze({ numbers: 0, unlocated: 0 }),
	});
}

/** ripgrep's rule, as the crate uses it: a NUL byte in the first 8 KiB. */
function looksBinary(bytes: Buffer): boolean {
	return bytes.subarray(0, BINARY_WINDOW).includes(0);
}

function decodeUtf8(bytes: Buffer): string | null {
	try {
		return decodeUtf8OrThrow(bytes);
	} catch {
		// Invalid UTF-8 is the answer, reported by the caller as a skip.
		return null;
	}
}

/** Separators are always `/` in a report, and only where `\` is the separator. */
function reportedPath(path: string): string {
	if (sep !== '\\') return path;
	return path.replaceAll('\\', '/');
}
