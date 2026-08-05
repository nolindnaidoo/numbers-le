import * as vscode from 'vscode';
import { readConfig } from '../config/config';
import { detectFileType, extractNumber } from '../extraction/extract';
import { type SortMode, sortNumber } from '../utils/sort';
import type { CommandDependencies } from './index';

export async function sortNumbers(deps: CommandDependencies): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		deps.notifier.warn(vscode.l10n.t('No active editor found'));
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
			deps.notifier.info(
				vscode.l10n.t('No valid numbers found in the current file'),
			);
			return;
		}
	} else {
		const fileType = detectFileType(editor.document.fileName);
		deps.notifier.info(
			vscode.l10n.t('Sorting numbers from {0} file...', fileType),
		);

		const result = extractNumber(text, fileType, editor.document.fileName);

		if (!result.success) {
			deps.notifier.error(
				`Failed to extract numbers: ${result.errors[0]?.message}`,
			);
			return;
		}

		numbers = result.numbers;

		if (numbers.length === 0) {
			deps.notifier.info(vscode.l10n.t('No numbers found in the file'));
			return;
		}
	}

	// Typed as SortMode so the choice stays typed from the quick-pick through to
	// sortNumber; a plain array widens `value` to string and forces a cast at
	// the call site, which is exactly where an invalid mode would slip past.
	const sortOptions: readonly { label: string; value: SortMode }[] = [
		{
			label: vscode.l10n.t('Numeric Ascending'),
			value: 'numeric-asc',
		},
		{
			label: vscode.l10n.t('Numeric Descending'),
			value: 'numeric-desc',
		},
		{
			label: vscode.l10n.t('Magnitude Ascending'),
			value: 'magnitude-asc',
		},
		{
			label: vscode.l10n.t('Magnitude Descending'),
			value: 'magnitude-desc',
		},
	];

	const selected = await vscode.window.showQuickPick(sortOptions, {
		placeHolder: vscode.l10n.t('Select sorting method'),
	});

	if (!selected) return;

	const sortedNumbers = sortNumber(numbers, selected.value);
	const output = sortedNumbers.join('\n');
	const config = readConfig();

	if (config.postProcessOpenInNewFile) {
		const doc = await vscode.workspace.openTextDocument({
			content: output,
			language: 'plaintext',
		});
		await vscode.window.showTextDocument(doc, {
			preview: false,
			...(config.openResultsSideBySide
				? { viewColumn: vscode.ViewColumn.Beside }
				: {}),
		});
		deps.notifier.info(
			vscode.l10n.t('Sorted {0} numbers ({1})', numbers.length, selected.label),
		);
	} else {
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
			deps.notifier.error(vscode.l10n.t('Failed to update the editor content'));
		}
	}

	deps.telemetry.event('numbers.sorted', {
		count: String(numbers.length),
		fileType: isNumbersFile
			? 'numbers'
			: detectFileType(editor.document.fileName),
		sortMode: selected.value,
	});
}
