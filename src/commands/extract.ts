import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { readConfig } from '../config/config';
import { detectFileType, extractNumber } from '../extraction/extract';
import { parseCsvLine } from '../extraction/formats/csv';
import type { FileType } from '../types';
import {
	chooseLargeOutputAction,
	confirmManyDocuments,
} from '../ui/largeOutput';
import type { CsvPromptOptions } from '../ui/prompts';
import { promptCsvOptionsIfNeeded, promptForFileType } from '../ui/prompts';
import { dedupeNumber, sortNumber } from '../utils/sort';
import type { CommandDependencies } from './index';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

// Helper function to build TextDocumentShowOptions based on config
function getShowDocumentOptions(
	config: ReturnType<typeof readConfig>,
	baseOptions: Partial<vscode.TextDocumentShowOptions> = {},
): vscode.TextDocumentShowOptions {
	const options: vscode.TextDocumentShowOptions = { ...baseOptions };
	if (config.openResultsSideBySide) {
		options.viewColumn = vscode.ViewColumn.Beside;
	}
	return options;
}

// Helper type for extraction context
type ExtractionContext = Readonly<{
	document: vscode.TextDocument;
	text: string;
	fileType: FileType;
	csvOptions: CsvPromptOptions;
	config: ReturnType<typeof readConfig>;
	deps: CommandDependencies;
}>;

// Initial validation and setup
async function validateAndPrepareExtraction(
	deps: CommandDependencies,
): Promise<Pick<ExtractionContext, 'document' | 'text' | 'fileType'> | null> {
	// Get active editor - no polling, fail fast if not available
	const editor = vscode.window.activeTextEditor;

	if (!editor) {
		deps.notifier.error(
			localize('runtime.message.error.no-editor', 'No active editor'),
		);
		return null;
	}

	// Capture document immediately to avoid TOCTOU issues
	const document = editor.document;

	// Validate document is still accessible
	try {
		const text = document.getText();
		if (text.trim().length === 0) {
			deps.notifier.info(
				localize('runtime.message.info.file-empty', 'File is empty'),
			);
			return null;
		}

		// Infer file type from filename or prompt if unknown
		let fileType = detectFileType(document.fileName);
		if (fileType === 'unknown') {
			const chosen = await promptForFileType();
			if (!chosen) return null;
			fileType = chosen;
		}

		return { document, text, fileType };
	} catch (_error) {
		// Document became invalid during access
		deps.notifier.error(
			localize(
				'runtime.message.error.document-invalid',
				'Document is no longer valid',
			),
		);
		return null;
	}
}

// Handle CSV multi-column fan-out extraction
async function handleCsvMultiColumnExtraction(
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
		(targetIndexes.length >= config.manyDocumentsThreshold ||
			estimatedTotal > config.largeOutputLinesThreshold)
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
	deps.statusBar.flash(
		localize('runtime.status.csv-opened', 'CSV opened (no auto‑copy)'),
	);
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
						localize(
							'runtime.message.error.column-stream',
							'Column {0} streaming failed: {1}',
							idx,
							error.message,
						),
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
				deps.notifier.error(
					localize(
						'runtime.message.error.open-results',
						'Could not open results',
					),
				);
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
			const cellValue = cells[columnIndex]?.trim();
			if (cellValue) {
				const num = parseFloat(cellValue);
				if (!Number.isNaN(num) && Number.isFinite(num)) {
					numbers.push(num);
				}
			}
		}
	}

	return Object.freeze(numbers);
}

// Handle CSV single streaming extraction
async function handleCsvStreamingExtraction(
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
			deps.notifier.error(
				localize(
					'runtime.message.error.extraction-failed',
					'Extraction failed',
				),
			);
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
		deps.statusBar.flash(
			localize('runtime.status.csv-opened', 'CSV opened (no auto‑copy)'),
		);
		return true; // Handled
	} catch (error: unknown) {
		if (error instanceof Error) {
			deps.notifier.error(
				localize(
					'runtime.message.error.csv-streaming',
					'CSV streaming failed: {0}',
					error.message,
				),
			);
		} else {
			deps.notifier.error(
				localize(
					'runtime.message.error.csv-streaming-unknown',
					'CSV streaming failed with unknown error',
				),
			);
		}
		return true; // Handled (with error)
	}
}

// Handle normal (non-CSV or non-streaming) extraction
async function handleNormalExtraction(
	context: ExtractionContext,
	token: vscode.CancellationToken,
): Promise<void> {
	const { text, fileType, config, deps } = context;

	const result = extractNumber(text, fileType, context.document.fileName);

	if (!result.success) {
		if (config.showParseErrors) {
			deps.notifier.error(result.errors[0]?.message || 'Extraction failed');
		}
		return;
	}

	const shouldDedupe = config.dedupeEnabled;
	const sortEnabled = config.sortEnabled;
	const sortMode = config.sortMode;

	if (token.isCancellationRequested) return;
	const dedupedNumbers = shouldDedupe
		? dedupeNumber(result.numbers)
		: result.numbers;
	const finalNumbers = sortEnabled
		? sortNumber(dedupedNumbers, sortMode)
		: dedupedNumbers;

	if (finalNumbers.length === 0) {
		deps.notifier.info(
			localize('runtime.message.info.no-numbers', 'No numbers found'),
		);
		return;
	}

	// Show post-processing info if dedupe or sort was applied
	if (shouldDedupe || sortEnabled) {
		deps.statusBar.flash(
			localize('runtime.status.postprocess', 'Dedupe/Sort applied'),
		);
	}

	await processAndOutputResults(finalNumbers, context, token);
}

// Handle final output processing
async function processAndOutputResults(
	finalNumbers: readonly number[],
	context: ExtractionContext,
	token: vscode.CancellationToken,
): Promise<void> {
	const { config, deps, fileType } = context;

	// For very large outputs, offer Open/Copy/Cancel to avoid UI lockups
	let openDoc = true;
	if (
		config.safetyEnabled &&
		finalNumbers.length > config.largeOutputLinesThreshold
	) {
		const hasPostProcess = config.dedupeEnabled || config.sortEnabled;
		const hasContextualNotes = fileType === 'csv' || hasPostProcess;

		const action = await chooseLargeOutputAction(
			finalNumbers.length,
			hasContextualNotes,
		);
		if (action === 'cancel') return;
		if (action === 'copy') openDoc = false;
	}

	if (token.isCancellationRequested) return;

	if (openDoc) {
		try {
			const resultDocument = await vscode.workspace.openTextDocument({
				content: finalNumbers.join('\n'),
				language: 'plaintext',
			});
			await vscode.window.showTextDocument(
				resultDocument,
				getShowDocumentOptions(config),
			);
		} catch (error: unknown) {
			if (error instanceof Error) {
				deps.notifier.error(
					localize(
						'runtime.message.error.open-results',
						'Could not open results',
					),
				);
			}
		}
	}

	// Optionally copy results to clipboard based on user setting (disabled for CSV)
	if (token.isCancellationRequested) return;
	let clipboardSuccess = false;
	if (config.copyToClipboardEnabled && fileType !== 'csv') {
		try {
			await vscode.env.clipboard.writeText(finalNumbers.join('\n'));
			clipboardSuccess = true;
		} catch {
			deps.notifier.warn(
				localize(
					'runtime.message.warn.clipboard-failed',
					'Could not copy to clipboard',
				),
			);
		}
	}

	deps.telemetry.event('extracted', {
		count: String(finalNumbers.length),
		type: fileType,
	});

	// Choose appropriate status message
	if (clipboardSuccess) {
		deps.statusBar.flash(
			localize('runtime.status.copied', 'Copied to clipboard'),
		);
	} else {
		deps.statusBar.flash(
			localize(
				'runtime.status.extracted',
				'Extracted {0}',
				finalNumbers.length,
			),
		);
	}
}

export async function extractNumbers(deps: CommandDependencies): Promise<void> {
	deps.telemetry.event('command', { name: 'extractNumbers' });

	// Start performance tracking
	const tracker = deps.performanceMonitor.startOperation('extract');
	let fileSize = 0;

	try {
		// Step 1: Validate and prepare
		const prepared = await validateAndPrepareExtraction(deps);
		if (!prepared) return;

		const { document, text, fileType } = prepared;
		fileSize = text.length;
		const csvOptions = await promptCsvOptionsIfNeeded(fileType, text);

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: localize(
					'runtime.progress.extract.title',
					'Extracting numbers...',
				),
				cancellable: true,
			},
			async (_progress, token): Promise<void> => {
				if (token.isCancellationRequested) return;

				// Read config once for consistency
				const config = readConfig();

				// Warn for large files
				try {
					const stat = await vscode.workspace.fs.stat(document.uri);
					if (config.safetyEnabled && stat.size > config.fileSizeWarnBytes) {
						deps.notifier.warn(
							localize(
								'runtime.message.warn.large-file',
								'Large file detected ({0} bytes). Extraction may take longer.',
								stat.size,
							),
						);
					}
				} catch {
					// ignore
				}

				if (token.isCancellationRequested) return;

				// Create extraction context
				const context: ExtractionContext = {
					document,
					text,
					fileType,
					csvOptions,
					config,
					deps,
				};

				// Step 3: Route to appropriate handler
				if (await handleCsvMultiColumnExtraction(context, token)) return;
				if (await handleCsvStreamingExtraction(context, token)) return;
				await handleNormalExtraction(context, token);
			},
		);
	} finally {
		// Record performance metrics
		const metrics = tracker.end(0, fileSize);
		deps.performanceMonitor.recordMetrics(metrics);
	}
}
