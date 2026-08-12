import * as vscode from 'vscode';
import { readConfig } from '../config/config';
import { detectFileType, extractNumber } from '../extraction/extract';
import type { CommandDependencies } from './index';

/**
 * The parts dedupe and sort had in common.
 *
 * Both carried the same two blocks verbatim — collecting the numbers (a bare
 * list of numbers, or an extraction from a typed file) and writing the result
 * (a new document, or an edit over the current one). Two copies of a block
 * drift, and only one copy gets fixed; this is the one implementation.
 */

/**
 * Collect the numbers a post-process command should operate on.
 *
 * Returns null when there is nothing to do, having already told the user why —
 * the caller returns without a second message.
 *
 * @param describeSource builds the "working on a {type} file" line, which
 *   differs per command and must stay a distinct localized string.
 */
export function collectNumbers(
	editor: vscode.TextEditor,
	isNumbersFile: boolean,
	deps: CommandDependencies,
	describeSource: (fileType: string) => string,
): readonly number[] | null {
	const text = editor.document.getText();

	if (isNumbersFile) {
		const numbers = Object.freeze(
			text
				.split('\n')
				.map((line) => Number(line.trim()))
				.filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
		);
		if (numbers.length === 0) {
			deps.notifier.info(
				vscode.l10n.t('No valid numbers found in the current file'),
			);
			return null;
		}
		return numbers;
	}

	const fileType = detectFileType(editor.document.fileName);
	deps.notifier.info(describeSource(fileType));

	const result = extractNumber(text, fileType, editor.document.fileName);
	if (!result.success) {
		deps.notifier.error(
			`Failed to extract numbers: ${result.errors[0]?.message}`,
		);
		return null;
	}
	if (result.numbers.length === 0) {
		deps.notifier.info(vscode.l10n.t('No numbers found in the file'));
		return null;
	}
	// Post-processing works on the values alone; the notation belongs to
	// the report surfaces.
	return Object.freeze(result.numbers.map((found) => found.value));
}

/**
 * Write the result where the settings say, reporting what actually happened.
 *
 * `editor.edit` resolves false for a read-only document; announcing a count
 * over an untouched document is the defect this guards.
 */
export async function writeResult(
	editor: vscode.TextEditor,
	output: string,
	deps: CommandDependencies,
	messages: Readonly<{ newDocument: string; inPlace: string }>,
): Promise<void> {
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
		deps.notifier.info(messages.newDocument);
		return;
	}

	const applied = await editor.edit((editBuilder) => {
		const fullRange = new vscode.Range(
			editor.document.positionAt(0),
			editor.document.positionAt(editor.document.getText().length),
		);
		editBuilder.replace(fullRange, output);
	});

	if (!applied) {
		deps.notifier.error(vscode.l10n.t('Failed to update the editor content'));
		return;
	}
	deps.notifier.info(messages.inPlace);
}
