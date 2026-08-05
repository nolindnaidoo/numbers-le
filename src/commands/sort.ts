import * as vscode from 'vscode';
import { detectFileType } from '../extraction/extract';
import { type SortMode, sortNumber } from '../utils/sort';
import type { CommandDependencies } from './index';
import { collectNumbers, writeResult } from './postProcessShared';

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

	const numbers = collectNumbers(editor, isNumbersFile, deps, (fileType) =>
		vscode.l10n.t('Sorting numbers from {0} file...', fileType),
	);
	if (!numbers) return;

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

	await writeResult(editor, output, deps, {
		newDocument: vscode.l10n.t(
			'Sorted {0} numbers ({1})',
			numbers.length,
			selected.label,
		),
		inPlace: `Sorted ${numbers.length} numbers (${selected.label}) in current editor`,
	});

	deps.telemetry.event('numbers.sorted', {
		count: String(numbers.length),
		fileType: isNumbersFile
			? 'numbers'
			: detectFileType(editor.document.fileName),
		sortMode: selected.value,
	});
}
