import { beforeEach, describe, expect, it } from 'vitest';
import {
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
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
