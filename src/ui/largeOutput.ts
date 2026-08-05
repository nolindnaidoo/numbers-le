import * as vscode from 'vscode';

export type LargeOutputAction = 'open' | 'copy' | 'cancel';

export async function chooseLargeOutputAction(
	count: number,
	hasContextualNotes = false,
): Promise<LargeOutputAction> {
	// Enhanced warning with contextual notes
	const baseMessage = vscode.l10n.t(
		'Detected {0} numbers. Opening large results may freeze the editor. What would you like to do?',
		count,
	);
	const notes = hasContextualNotes
		? [
				'',
				vscode.l10n.t('Notes:'),
				vscode.l10n.t('• CSV streaming/editor-first (no auto‑copy)'),
				vscode.l10n.t('• Dedupe/Sort apply to final numbers only'),
			].join('\n')
		: '';

	const fullMessage = notes ? `${baseMessage}\n${notes}` : baseMessage;

	const openLabel = vscode.l10n.t('Open results');
	const copyLabel = vscode.l10n.t('Copy only');
	const cancelLabel = vscode.l10n.t('Cancel');

	const choice = await vscode.window.showWarningMessage(
		fullMessage,
		{ modal: true },
		openLabel,
		copyLabel,
		cancelLabel,
	);
	if (!choice || choice === cancelLabel) return 'cancel';
	if (choice === copyLabel) return 'copy';
	return 'open';
}

export async function confirmManyDocuments(
	countDocs: number,
	totalLines: number,
): Promise<boolean> {
	const openLabel = vscode.l10n.t('Open results');
	const choice = await vscode.window.showWarningMessage(
		vscode.l10n.t(
			'Many results — opening {0} documents (~{1} total numbers). Proceed?',
			countDocs,
			totalLines,
		),
		{ modal: true },
		openLabel,
		vscode.l10n.t('Cancel'),
	);
	return choice === openLabel;
}
