import * as vscode from 'vscode';
import { parseCsvLine } from '../extraction/formats/csv';

/**
 * The column pick carries its index. Matching the picked label back against
 * the header text compared a translated `(Column {0})` to the English
 * literal, so in any other language an unnamed column fell to all columns;
 * and two headers with one name always picked the first.
 */
type ColumnPick = vscode.QuickPickItem & { readonly index?: number };

// Helper to handle CSV header-based column selection
async function handleCsvHeaderBasedSelection(
	headerCells: readonly string[],
): Promise<CsvPromptOptions> {
	const picks: readonly ColumnPick[] = [
		{
			label: vscode.l10n.t('All columns'),
			description: vscode.l10n.t('Extract from all columns'),
		},
		...headerCells.map((name, index) => ({
			label: name || vscode.l10n.t('(Column {0})', index),
			description: vscode.l10n.t('Index {0}', index),
			index,
		})),
	];

	const selected = await vscode.window.showQuickPick(picks, {
		placeHolder: vscode.l10n.t('Select a CSV column or all columns'),
		matchOnDescription: true,
	});

	if (!selected) {
		return Object.freeze({}); // User cancelled
	}
	if (selected.index === undefined) {
		return Object.freeze({ csvHasHeader: true, selectAllColumns: true });
	}
	return Object.freeze({ csvHasHeader: true, csvColumnIndex: selected.index });
}

// Helper to handle CSV no-header index-based selection
async function handleCsvIndexBasedSelection(
	lines: readonly string[],
): Promise<CsvPromptOptions> {
	const idxStr = await vscode.window.showInputBox({
		prompt: vscode.l10n.t(
			'Enter column indexes (comma-separated), or leave empty for all columns',
		),
		validateInput: (val) => {
			if (val.trim() === '') return null;
			const parts = val
				.split(',')
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
			const allInts = parts.every((p) => /^(\d+)$/.test(p));
			return allInts
				? null
				: vscode.l10n.t(
						'Enter valid column indexes separated by commas, or leave empty',
					);
		},
	});

	if (!idxStr || idxStr.trim() === '') {
		return Object.freeze({ csvHasHeader: false, selectAllColumns: true });
	}

	const parts = idxStr
		.split(',')
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
	const indices = parts
		.map((p) => Number(p))
		.filter((n) => Number.isInteger(n) && n >= 0);

	// Validate against first row cell count
	const firstRowLine = lines[0];
	if (!firstRowLine) return Object.freeze({});

	const firstRow = parseCsvLine(firstRowLine);
	const inRange = indices.filter((idx) => idx >= 0 && idx < firstRow.length);

	if (inRange.length === 0) {
		vscode.window.showWarningMessage(
			vscode.l10n.t(
				'Column index out of range ({0}). Using all columns instead',
				indices.join(','),
			),
		);
		return Object.freeze({ csvHasHeader: false, selectAllColumns: true });
	}

	if (inRange.length === 1) {
		return Object.freeze({
			csvHasHeader: false,
			csvColumnIndex: inRange[0] as number,
		});
	}

	return Object.freeze({ csvHasHeader: false, csvColumnIndexes: inRange });
}

// UI prompts for selecting file type and CSV extraction options
export type CsvPromptOptions = Readonly<{
	csvHasHeader?: boolean;
	csvColumnIndex?: number;
	csvColumnIndexes?: readonly number[];
	selectAllColumns?: boolean;
}>;

export function promptForFileType(): Promise<
	'json' | 'yaml' | 'csv' | 'toml' | 'ini' | 'env' | 'unknown' | undefined
> {
	// Present QuickPick with supported types; returns internal value or undefined
	const items: readonly { label: string; value: string }[] = [
		{ label: 'JSON', value: 'json' },
		{ label: 'YAML', value: 'yaml' },
		{ label: 'CSV', value: 'csv' },
		{ label: 'TOML', value: 'toml' },
		{ label: 'INI', value: 'ini' },
		{ label: '.env', value: 'env' },
		{
			label: vscode.l10n.t('Unknown (regex fallback)'),
			value: 'unknown',
		},
	];
	return Promise.resolve(
		vscode.window
			.showQuickPick(
				items.map((i) => i.label),
				{
					placeHolder: vscode.l10n.t('Choose file type for number extraction'),
				},
			)
			.then(
				(picked) =>
					items.find((i) => i.label === picked)?.value as
						| 'json'
						| 'yaml'
						| 'csv'
						| 'toml'
						| 'ini'
						| 'env'
						| 'unknown'
						| undefined,
			),
	);
}

export async function promptCsvOptionsIfNeeded(
	extension: string,
	text: string,
): Promise<CsvPromptOptions> {
	if (extension !== 'csv') return Object.freeze({});

	const lines = text.split(/\r?\n/).filter((l): boolean => l.length > 0);
	if (lines.length === 0) return Object.freeze({});

	const firstLine = lines[0];
	if (!firstLine) return Object.freeze({});

	const headerCells = parseCsvLine(firstLine);
	// Any letter, in any script: a Japanese or Cyrillic header row is a
	// header too, and an ASCII-only test sent its user to the index prompt.
	const looksLikeHeader = headerCells.some((cell) => /\p{L}/u.test(cell));

	if (looksLikeHeader) {
		return await handleCsvHeaderBasedSelection(headerCells);
	}
	return await handleCsvIndexBasedSelection(lines);
}
