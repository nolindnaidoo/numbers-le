import * as vscode from 'vscode';
import { detectFileType, extractNumbers } from '../extraction/extract';
import { dedupeNumbers as dedupeNumbersUtil } from '../utils/sort';
import type { CommandDependencies } from './index';

export async function dedupeNumbers(deps: CommandDependencies): Promise<void> {
	const tracker = deps.performanceMonitor.startOperation('dedupe');

	try {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			deps.notifier.warn('No active editor found');
			return;
		}

		const text = editor.document.getText();

		// Check if this looks like a numbers file (simple heuristic)
		const lines = text.split('\n').filter((line) => line.trim());
		const isNumbersFile =
			lines.length > 0 &&
			lines.every((line) => {
				const trimmed = line.trim();
				return trimmed === '' || !Number.isNaN(Number(trimmed));
			});

		let numbers: readonly number[];

		if (isNumbersFile) {
			// Parse numbers directly from the current file
			numbers = Object.freeze(
				lines
					.map((line) => Number(line.trim()))
					.filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
			);

			if (numbers.length === 0) {
				deps.notifier.info('No valid numbers found in the current file');
				return;
			}
		} else {
			// Extract numbers from the file content
			const fileType = detectFileType(editor.document.fileName);
			deps.notifier.info(`Deduplicating numbers from ${fileType} file...`);

			const result = extractNumbers(text, fileType, editor.document.fileName);

			if (!result.success) {
				deps.notifier.error(
					`Failed to extract numbers: ${result.errors[0]?.message}`,
				);
				return;
			}

			numbers = result.numbers;

			if (numbers.length === 0) {
				deps.notifier.info('No numbers found in the file');
				return;
			}
		}

		// Deduplicate numbers
		const dedupedNumbers = dedupeNumbersUtil(numbers);
		const duplicatesRemoved = numbers.length - dedupedNumbers.length;

		if (duplicatesRemoved === 0) {
			deps.notifier.info('No duplicate numbers found');
			return;
		}

		const output = dedupedNumbers.join('\n');

		// Replace the content of the current editor
		const success = await editor.edit((editBuilder) => {
			const fullRange = new vscode.Range(
				editor.document.positionAt(0),
				editor.document.positionAt(editor.document.getText().length),
			);
			editBuilder.replace(fullRange, output);
		});

		if (success) {
			deps.notifier.info(
				`Removed ${duplicatesRemoved} duplicates (${dedupedNumbers.length} unique numbers remaining) in current editor`,
			);
		} else {
			deps.notifier.error('Failed to update the editor content');
		}

		deps.telemetry.event('numbers.deduped', {
			originalCount: String(numbers.length),
			finalCount: String(dedupedNumbers.length),
			duplicatesRemoved: String(duplicatesRemoved),
			fileType: isNumbersFile
				? 'numbers'
				: detectFileType(editor.document.fileName),
		});
	} finally {
		const metrics = tracker.end(0, 0);
		deps.performanceMonitor.recordMetrics(metrics);
	}
}
