import * as vscode from 'vscode';
import { detectFileType } from '../extraction/extract';
import { dedupeNumber } from '../utils/sort';
import type { CommandDependencies } from './index';
import { collectNumbers, writeResult } from './postProcessShared';

export async function dedupeNumbers(deps: CommandDependencies): Promise<void> {
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
		vscode.l10n.t('Deduplicating numbers from {0} file...', fileType),
	);
	if (!numbers) return;

	const dedupedNumbers = dedupeNumber(numbers);
	const duplicatesRemoved = numbers.length - dedupedNumbers.length;

	if (duplicatesRemoved === 0) {
		deps.notifier.info(vscode.l10n.t('No duplicate numbers found'));
		return;
	}

	const output = dedupedNumbers.join('\n');

	await writeResult(editor, output, deps, {
		newDocument: `Removed ${duplicatesRemoved} duplicates (${dedupedNumbers.length} unique numbers remaining)`,
		inPlace: `Removed ${duplicatesRemoved} duplicates (${dedupedNumbers.length} unique numbers remaining) in current editor`,
	});

	deps.telemetry.event('numbers.deduped', {
		originalCount: String(numbers.length),
		finalCount: String(dedupedNumbers.length),
		duplicatesRemoved: String(duplicatesRemoved),
		fileType: isNumbersFile
			? 'numbers'
			: detectFileType(editor.document.fileName),
	});
}
