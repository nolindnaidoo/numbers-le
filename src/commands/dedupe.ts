import * as vscode from 'vscode';
import { detectFileType, extractNumber } from '../extraction/extract';
import { dedupeNumber } from '../utils/sort';
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
		const lines = text.split('\n').filter((line) => line.trim());
		const isNumbersFile =
			lines.length > 0 &&
			lines.every((line) => {
				const trimmed = line.trim();
				return trimmed === '' || !Number.isNaN(Number(trimmed));
			});

		let numbers: readonly number[];

		if (isNumbersFile) {
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
			const fileType = detectFileType(editor.document.fileName);
			deps.notifier.info(`Deduplicating numbers from ${fileType} file...`);

			const result = extractNumber(text, fileType, editor.document.fileName);

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

		const dedupedNumbers = dedupeNumber(numbers);
		const duplicatesRemoved = numbers.length - dedupedNumbers.length;

		if (duplicatesRemoved === 0) {
			deps.notifier.info('No duplicate numbers found');
			return;
		}

		const output = dedupedNumbers.join('\n');

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
