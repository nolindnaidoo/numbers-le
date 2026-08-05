import * as vscode from 'vscode';
import { readConfig } from '../config/config';
import { detectFileType, extractNumber } from '../extraction/extract';
import type { FileType } from '../types';
import { chooseLargeOutputAction } from '../ui/largeOutput';
import type { CsvPromptOptions } from '../ui/prompts';
import { promptCsvOptionsIfNeeded, promptForFileType } from '../ui/prompts';
import { dedupeNumber, sortNumber } from '../utils/sort';
import {
	handleCsvMultiColumnExtraction,
	handleCsvStreamingExtraction,
} from './extractCsv';
import type { CommandDependencies } from './index';

// Helper function to build TextDocumentShowOptions based on config
export function getShowDocumentOptions(
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
export type ExtractionContext = Readonly<{
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
		deps.notifier.error(vscode.l10n.t('No active editor'));
		return null;
	}

	// Capture document immediately to avoid TOCTOU issues
	const document = editor.document;

	// Validate document is still accessible
	try {
		const text = document.getText();
		if (text.trim().length === 0) {
			deps.notifier.info(vscode.l10n.t('File is empty'));
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
		deps.notifier.error(vscode.l10n.t('Document is no longer valid'));
		return null;
	}
}

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
		deps.notifier.info(vscode.l10n.t('No numbers found'));
		return;
	}

	// Show post-processing info if dedupe or sort was applied
	if (shouldDedupe || sortEnabled) {
		deps.statusBar.flash('Dedupe/Sort applied');
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
	let copyRequested = false;
	if (
		config.safetyEnabled &&
		finalNumbers.length > config.safetyLargeOutputLinesThreshold
	) {
		const hasPostProcess = config.dedupeEnabled || config.sortEnabled;
		const hasContextualNotes = fileType === 'csv' || hasPostProcess;

		const action = await chooseLargeOutputAction(
			finalNumbers.length,
			hasContextualNotes,
		);
		if (action === 'cancel') return;
		// "Copy only" is an explicit instruction, so it copies even when the
		// automatic copy setting is off. Without this the choice delivered
		// nothing at all — no document, no clipboard — and still reported a
		// count.
		if (action === 'copy') {
			openDoc = false;
			copyRequested = true;
		}
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
				deps.notifier.error(vscode.l10n.t('Could not open results'));
			}
		}
	}

	// Optionally copy results to clipboard based on user setting (disabled for CSV)
	if (token.isCancellationRequested) return;
	let clipboardSuccess = false;
	if (copyRequested || (config.copyToClipboardEnabled && fileType !== 'csv')) {
		try {
			await vscode.env.clipboard.writeText(finalNumbers.join('\n'));
			clipboardSuccess = true;
		} catch {
			deps.notifier.warn(vscode.l10n.t('Could not copy to clipboard'));
		}
	}

	// Nothing opened and nothing copied means the results never reached the
	// user; a clipboard failure has already been reported as a warning.
	if (!openDoc && !clipboardSuccess) {
		return;
	}

	deps.telemetry.event('extracted', {
		count: String(finalNumbers.length),
		type: fileType,
	});

	deps.statusBar.flash(
		clipboardSuccess
			? 'Copied to clipboard'
			: `Extracted ${finalNumbers.length}`,
	);
}

export async function extractNumbers(deps: CommandDependencies): Promise<void> {
	deps.telemetry.event('command', { name: 'extractNumbers' });

	// Step 1: Validate and prepare
	const prepared = await validateAndPrepareExtraction(deps);
	if (!prepared) return;

	const { document, text, fileType } = prepared;
	const csvOptions = await promptCsvOptionsIfNeeded(fileType, text);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: vscode.l10n.t('Extracting numbers...'),
			cancellable: true,
		},
		async (_progress, token): Promise<void> => {
			if (token.isCancellationRequested) return;

			// Read config once for consistency
			const config = readConfig();

			// Warn for large files
			try {
				const stat = await vscode.workspace.fs.stat(document.uri);
				if (
					config.safetyEnabled &&
					stat.size > config.safetyFileSizeWarnBytes
				) {
					deps.notifier.warn(
						vscode.l10n.t(
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
}
