import * as vscode from 'vscode';
import { extractNumber } from '../extraction/extract';
import { parseCsvLine } from '../extraction/formats/csv';
import { parseStrictNumber } from '../extraction/heuristics';
import { confirmManyDocuments } from '../ui/largeOutput';
import type { CsvPromptOptions } from '../ui/prompts';
import { dedupeNumber, sortNumber } from '../utils/sort';
import { type ExtractionContext, getShowDocumentOptions } from './extract';

/**
 * CSV extraction: multi-column selection and the streaming path.
 *
 * Lifted out of extract.ts, which held command orchestration, CSV handling,
 * the normal extraction path and output routing in one 509-line file. CSV is
 * the part with its own prompts, its own streaming reader and its own error
 * reporting, so it is the natural seam.
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

	// Determine target column indexes
	const firstNonEmptyLine =
		text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
	const columnCount = parseCsvLine(firstNonEmptyLine).length;
	const targetIndexes: readonly number[] = csvOptions.selectAllColumns
		? Array.from({ length: columnCount }, (_, i) => i)
		: (csvOptions.csvColumnIndexes ?? []);

	// Estimate total output lines for safety warning
	const totalLinesInDoc = text.split(/\r?\n/).length;
	const rowsEstimate = Math.max(
		totalLinesInDoc - (csvOptions.csvHasHeader ? 1 : 0),
		0,
	);
	const estimatedTotal = rowsEstimate * targetIndexes.length;

	if (
		config.safetyEnabled &&
		(targetIndexes.length >= config.safetyManyDocumentsThreshold ||
			estimatedTotal > config.safetyLargeOutputLinesThreshold)
	) {
		const ok = await confirmManyDocuments(targetIndexes.length, estimatedTotal);
		if (!ok) return true; // Handled (cancelled)
	}

	const streamingEnabled = config.csvStreamingEnabled;

	if (streamingEnabled) {
		await handleStreamingMultiColumn(context, targetIndexes, token);
	} else {
		await handleNonStreamingMultiColumn(context, targetIndexes, token);
	}

	deps.telemetry.event('extracted', { count: 'multi', type: 'csv' });
	deps.statusBar.flash('CSV opened (no auto‑copy)');
	return true; // Handled
}

// Streaming multi-column helper
async function handleStreamingMultiColumn(
	context: ExtractionContext,
	targetIndexes: readonly number[],
	token: vscode.CancellationToken,
): Promise<void> {
	const { text, csvOptions, config, deps } = context;

	try {
		for (const idx of targetIndexes) {
			if (token.isCancellationRequested) break;

			try {
				const doc = await vscode.workspace.openTextDocument({
					content: '',
					language: 'plaintext',
				});
				const editorForResults = await vscode.window.showTextDocument(
					doc,
					getShowDocumentOptions(config, {
						preview: false,
						preserveFocus: true,
					}),
				);

				// Extract numbers from this column
				const columnNumbers = extractColumnNumbers(text, idx, csvOptions);

				// Apply post-processing
				const shouldDedupe = config.dedupeEnabled;
				const sortEnabled = config.sortEnabled;
				const sortMode = config.sortMode;

				let processedNumbers = shouldDedupe
					? dedupeNumber(columnNumbers)
					: columnNumbers;
				processedNumbers = sortEnabled
					? sortNumber(processedNumbers, sortMode)
					: processedNumbers;

				if (processedNumbers.length === 0) continue;

				// Stream results to editor
				const content = processedNumbers.join('\n');
				await editorForResults.edit((eb) => {
					const end = new vscode.Position(
						editorForResults.document.lineCount,
						0,
					);
					eb.insert(end, content);
				});
			} catch (error: unknown) {
				if (error instanceof Error) {
					deps.notifier.error(
						`Column ${idx} streaming failed: ${error.message}`,
					);
				}
				// Continue with next column
			}
		}
	} finally {
		// Cleanup handled by VS Code
	}
}

// Non-streaming multi-column helper
async function handleNonStreamingMultiColumn(
	context: ExtractionContext,
	targetIndexes: readonly number[],
	token: vscode.CancellationToken,
): Promise<void> {
	const { text, csvOptions, config, deps } = context;
	const shouldDedupe = config.dedupeEnabled;
	const sortEnabled = config.sortEnabled;
	const sortMode = config.sortMode;

	for (const idx of targetIndexes) {
		if (token.isCancellationRequested) return;

		const columnNumbers = extractColumnNumbers(text, idx, csvOptions);
		const deduped = shouldDedupe ? dedupeNumber(columnNumbers) : columnNumbers;
		const finalForColumn = sortEnabled
			? sortNumber(deduped, sortMode)
			: deduped;

		if (finalForColumn.length === 0) continue;

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
		} catch (error: unknown) {
			if (error instanceof Error) {
				deps.notifier.error(vscode.l10n.t('Could not open results'));
			}
		}
	}
}

// Extract numbers from a specific CSV column
function extractColumnNumbers(
	text: string,
	columnIndex: number,
	csvOptions: CsvPromptOptions,
): readonly number[] {
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	const numbers: number[] = [];
	const startRow = csvOptions.csvHasHeader ? 1 : 0;

	for (let i = startRow; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const cells = parseCsvLine(line);
		if (columnIndex < cells.length) {
			const cellValue = cells[columnIndex];
			if (cellValue) {
				const num = parseStrictNumber(cellValue);
				if (num !== undefined) {
					numbers.push(num);
				}
			}
		}
	}

	return Object.freeze(numbers);
}

// Handle CSV single streaming extraction
export async function handleCsvStreamingExtraction(
	context: ExtractionContext,
	_token: vscode.CancellationToken,
): Promise<boolean> {
	const { text, config, deps, fileType } = context;

	if (fileType !== 'csv' || !config.csvStreamingEnabled) {
		return false; // Not streaming CSV
	}

	try {
		const doc = await vscode.workspace.openTextDocument({
			content: '',
			language: 'plaintext',
		});
		const editorForResults = await vscode.window.showTextDocument(
			doc,
			getShowDocumentOptions(config, {
				preview: false,
			}),
		);

		// Extract numbers (simplified streaming for now)
		const result = extractNumber(text, fileType, context.document.fileName);
		if (!result.success) {
			deps.notifier.error(vscode.l10n.t('Extraction failed'));
			return true;
		}

		let numbers = result.numbers;
		if (config.dedupeEnabled) {
			numbers = dedupeNumber(numbers);
		}
		if (config.sortEnabled && config.sortMode !== 'off') {
			numbers = sortNumber(numbers, config.sortMode);
		}

		const content = numbers.join('\n');
		await editorForResults.edit((eb) => {
			const end = new vscode.Position(editorForResults.document.lineCount, 0);
			eb.insert(end, content);
		});

		deps.telemetry.event('extracted', { count: 'stream', type: 'csv' });
		deps.statusBar.flash('CSV opened (no auto‑copy)');
		return true; // Handled
	} catch (error: unknown) {
		if (error instanceof Error) {
			deps.notifier.error(
				vscode.l10n.t('CSV streaming failed: {0}', error.message),
			);
		} else {
			deps.notifier.error(
				vscode.l10n.t('CSV streaming failed with unknown error'),
			);
		}
		return true; // Handled (with error)
	}
}

// Handle normal (non-CSV or non-streaming) extraction
