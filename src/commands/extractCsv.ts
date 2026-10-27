import * as vscode from 'vscode';
import { parseStrictNumber } from '../extraction/heuristics';
import { csvRows, trimAroundQuotes } from '../parsers/csv';
import { confirmManyDocuments } from '../ui/largeOutput';
import { dedupeNumber, sortNumber } from '../utils/sort';
import { type ExtractionContext, getShowDocumentOptions } from './extract';

/**
 * CSV extraction across several columns, one results document per column.
 *
 * Lifted out of extract.ts, which held command orchestration, CSV handling,
 * the normal extraction path and output routing in one 509-line file. CSV is
 * the part with its own prompts and its own error reporting, so it is the
 * natural seam.
 *
 * The document is read as records, not lines: a quoted field may hold a line
 * break, and splitting on newlines first cut such a record in two.
 */

// Handle CSV multi-column fan-out extraction
export async function handleCsvMultiColumnExtraction(
	context: ExtractionContext,
	token: vscode.CancellationToken,
): Promise<boolean> {
	const { text, csvOptions, config, deps, fileType } = context;

	if (
		fileType !== 'csv' ||
		(!csvOptions.selectAllColumns &&
			(!csvOptions.csvColumnIndexes || csvOptions.csvColumnIndexes.length <= 1))
	) {
		return false; // Not multi-column
	}

	const records = readRecords(text);
	if (records === undefined) {
		deps.notifier.error(vscode.l10n.t('Extraction failed'));
		return true; // Handled (with error)
	}
	const rows = csvOptions.csvHasHeader ? records.slice(1) : records;
	const columnCount = records[0]?.length ?? 0;
	const targetIndexes: readonly number[] = csvOptions.selectAllColumns
		? Array.from({ length: columnCount }, (_, i) => i)
		: (csvOptions.csvColumnIndexes ?? []);

	const estimatedTotal = rows.length * targetIndexes.length;

	if (
		config.safetyEnabled &&
		(targetIndexes.length >= config.safetyManyDocumentsThreshold ||
			estimatedTotal > config.safetyLargeOutputLinesThreshold)
	) {
		const ok = await confirmManyDocuments(targetIndexes.length, estimatedTotal);
		if (!ok) return true; // Handled (cancelled)
	}

	const { opened, withNumbers } = await openColumnResults(
		context,
		rows,
		targetIndexes,
		token,
	);

	// The flash said the CSV opened whether or not it had: every column empty
	// said nothing at all, and every document refused said it anyway.
	if (opened === 0) {
		if (withNumbers === 0 && !token.isCancellationRequested) {
			deps.notifier.info(vscode.l10n.t('No numbers found'));
		}
		return true; // Handled (each refusal already reported)
	}

	deps.telemetry.event('extracted', { count: 'multi', type: 'csv' });
	deps.statusBar.flash('CSV opened (no auto‑copy)');
	return true; // Handled
}

/**
 * One results document per column, skipping a column with no numbers.
 * Returns how many columns held numbers and how many documents the host
 * opened, which is what the caller may report.
 */
async function openColumnResults(
	context: ExtractionContext,
	rows: readonly (readonly string[])[],
	targetIndexes: readonly number[],
	token: vscode.CancellationToken,
): Promise<{ readonly opened: number; readonly withNumbers: number }> {
	const { config, deps } = context;
	const shouldDedupe = config.dedupeEnabled;
	const sortEnabled = config.sortEnabled;
	const sortMode = config.sortMode;
	let opened = 0;
	let withNumbers = 0;

	for (const idx of targetIndexes) {
		if (token.isCancellationRequested) break;

		const columnNumbers = columnNumbersOf(rows, idx);
		const deduped = shouldDedupe ? dedupeNumber(columnNumbers) : columnNumbers;
		const finalForColumn = sortEnabled
			? sortNumber(deduped, sortMode)
			: deduped;

		if (finalForColumn.length === 0) continue;
		withNumbers += 1;

		try {
			const doc = await vscode.workspace.openTextDocument({
				content: finalForColumn.join('\n'),
				language: 'plaintext',
			});
			await vscode.window.showTextDocument(
				doc,
				getShowDocumentOptions(config, {
					preview: false,
					preserveFocus: true,
				}),
			);
			opened += 1;
		} catch {
			// Whatever the host threw; a guard on `instanceof Error` let a string
			// through as silence.
			deps.notifier.error(vscode.l10n.t('Could not open results'));
		}
	}
	return { opened, withNumbers };
}

/**
 * The document's records as the extraction reads them: blanks around quoted
 * fields trimmed, then the csv crate's flexible records. Undefined when a
 * quoted field never closes.
 */
function readRecords(text: string): readonly (readonly string[])[] | undefined {
	const trimmed = trimAroundQuotes(text);
	if (trimmed === undefined) return undefined;
	return csvRows(trimmed, ',');
}

/**
 * The strict numbers in the one column the picker chose, header skipped when
 * it named one. Undefined when a quoted field never closes.
 */
export function csvColumnValues(
	text: string,
	columnIndex: number,
	hasHeader: boolean,
): readonly number[] | undefined {
	const records = readRecords(text);
	if (records === undefined) return undefined;
	return columnNumbersOf(hasHeader ? records.slice(1) : records, columnIndex);
}

/** The strict numbers in one column, in row order. */
function columnNumbersOf(
	rows: readonly (readonly string[])[],
	columnIndex: number,
): readonly number[] {
	const numbers = rows.flatMap((cells) => {
		const cell = cells[columnIndex];
		const found = cell ? parseStrictNumber(cell) : undefined;
		return found === undefined ? [] : [found.value];
	});
	return Object.freeze(numbers);
}
