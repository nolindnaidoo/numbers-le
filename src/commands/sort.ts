import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { detectFileType, extractNumber } from '../extraction/extract';
import { type SortMode, sortNumber } from '../utils/sort';
import type { CommandDependencies } from './index';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export async function sortNumbers(deps: CommandDependencies): Promise<void> {
	const tracker = deps.performanceMonitor.startOperation('sort');

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
			deps.notifier.info(`Sorting numbers from ${fileType} file...`);

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

		const sortOptions = [
			{
				label: localize('runtime.sort.pick.numeric-asc', 'Numeric Ascending'),
				value: 'numeric-asc',
			},
			{
				label: localize('runtime.sort.pick.numeric-desc', 'Numeric Descending'),
				value: 'numeric-desc',
			},
			{
				label: localize(
					'runtime.sort.pick.magnitude-asc',
					'Magnitude Ascending',
				),
				value: 'magnitude-asc',
			},
			{
				label: localize(
					'runtime.sort.pick.magnitude-desc',
					'Magnitude Descending',
				),
				value: 'magnitude-desc',
			},
		];

		const selected = await vscode.window.showQuickPick(sortOptions, {
			placeHolder: localize(
				'runtime.sort.pick.placeholder',
				'Select sorting method',
			),
		});

		if (!selected) return;

		const sortedNumbers = sortNumber(numbers, selected.value as SortMode);
		const output = sortedNumbers.join('\n');

		const success = await editor.edit((editBuilder) => {
			const fullRange = new vscode.Range(
				editor.document.positionAt(0),
				editor.document.positionAt(editor.document.getText().length),
			);
			editBuilder.replace(fullRange, output);
		});

		if (success) {
			deps.notifier.info(
				`Sorted ${numbers.length} numbers (${selected.label}) in current editor`,
			);
		} else {
			deps.notifier.error('Failed to update the editor content');
		}

		deps.telemetry.event('numbers.sorted', {
			count: String(numbers.length),
			fileType: isNumbersFile
				? 'numbers'
				: detectFileType(editor.document.fileName),
			sortMode: selected.value,
		});
	} finally {
		const metrics = tracker.end(0, 0);
		deps.performanceMonitor.recordMetrics(metrics);
	}
}
