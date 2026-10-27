import { beforeEach, describe, expect, it } from 'vitest';
import {
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
	_translate,
} from '../__mocks__/vscode';
import { promptCsvOptionsIfNeeded, promptForFileType } from './prompts';

beforeEach(() => {
	_resetMockState();
});

describe('promptForFileType', () => {
	it('maps the picked label to the internal value', async () => {
		_respondToQuickPick((items) =>
			(items as string[]).find((label) => label === 'TOML'),
		);
		expect(await promptForFileType()).toBe('toml');
	});

	it('returns undefined when dismissed', async () => {
		_respondToQuickPick(() => undefined);
		expect(await promptForFileType()).toBeUndefined();
	});
});

describe('promptCsvOptionsIfNeeded', () => {
	it('is a no-op for non-CSV files', async () => {
		expect(await promptCsvOptionsIfNeeded('json', 'a,b\n1,2')).toEqual({});
	});

	it('offers header columns and returns the picked index', async () => {
		_respondToQuickPick((items) =>
			(items as Array<{ label: string }>).find(
				(item) => item.label === 'price',
			),
		);
		const options = await promptCsvOptionsIfNeeded('csv', 'id,price\n1,2.5\n');
		expect(options).toEqual({ csvHasHeader: true, csvColumnIndex: 1 });
	});

	it('reads a header written in a non-Latin script as a header', async () => {
		// The header test looked for an ASCII letter, so a Japanese or Cyrillic
		// header row read as data and the user was asked for column indexes by
		// number instead of being shown the column names.
		_respondToQuickPick((items) =>
			(items as Array<{ label: string }>).find((item) => item.label === '数量'),
		);
		const options = await promptCsvOptionsIfNeeded('csv', '金額,数量\n100,2\n');
		expect(options).toEqual({ csvHasHeader: true, csvColumnIndex: 1 });
	});

	it('returns the index of an unnamed column picked by its generated label, in any language', async () => {
		// The label shown was `(Column {0})` through l10n, and the pick was
		// matched back against the English `(Column N)`: in every other
		// language the match failed and the pick fell to all columns.
		_translate({ '(Column {0})': '(Spalte {0})' });
		_respondToQuickPick((items) =>
			(items as Array<{ label: string }>).find(
				(item) => item.label === '(Spalte 1)',
			),
		);
		const options = await promptCsvOptionsIfNeeded('csv', 'id,\n1,2\n');
		expect(options).toEqual({ csvHasHeader: true, csvColumnIndex: 1 });
	});

	it('returns the column that was picked when two headers share a name', async () => {
		_respondToQuickPick((items) => {
			const named = (items as Array<{ label: string }>).filter(
				(item) => item.label === 'x',
			);
			return named[1];
		});
		const options = await promptCsvOptionsIfNeeded('csv', 'x,x\n1,2\n');
		expect(options).toEqual({ csvHasHeader: true, csvColumnIndex: 1 });
	});

	it('selects all columns from the header pick', async () => {
		_respondToQuickPick((items) =>
			(items as Array<{ label: string }>).find(
				(item) => item.label === 'All columns',
			),
		);
		const options = await promptCsvOptionsIfNeeded('csv', 'id,price\n1,2\n');
		expect(options).toEqual({ csvHasHeader: true, selectAllColumns: true });
	});

	it('accepts comma-separated indexes for headerless CSVs', async () => {
		_respondToInputBox(() => '0, 2');
		const options = await promptCsvOptionsIfNeeded('csv', '1,2,3\n4,5,6\n');
		expect(options).toEqual({
			csvHasHeader: false,
			csvColumnIndexes: [0, 2],
		});
	});

	it('falls back to all columns when indexes are out of range', async () => {
		_respondToInputBox(() => '9');
		const options = await promptCsvOptionsIfNeeded('csv', '1,2\n3,4\n');
		expect(options).toEqual({ csvHasHeader: false, selectAllColumns: true });
	});
});
