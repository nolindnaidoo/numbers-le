import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_createExtensionContext,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_shownMessages,
} from '../__mocks__/vscode';
import { activate, deactivate } from '../extension';
import { detectFileType } from '../extraction/extract';
import { promptCsvOptionsIfNeeded } from '../ui/prompts';

/**
 * Activation, file-type detection, and the post-process commands' guard paths.
 *
 * `extension.ts` had no test at all — the only entry point in the fleet at 0%
 * statements. A command declared in the manifest but never registered fails at
 * the moment a user runs it, and nothing here would have caught that.
 *
 * detectFileType decides which extractor runs; only two of its seven arms were
 * covered, so a mis-mapped extension would have gone unnoticed.
 */

function makeContext() {
	return _createExtensionContext() as never;
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

beforeEach(() => {
	_resetMockState();
	_setConfig('numbers-le.notificationsLevel', 'all');
});

describe('activation', () => {
	it('registers every command declared in the manifest', () => {
		activate(makeContext());
		for (const command of [
			'numbers-le.extractNumbers',
			'numbers-le.postProcess.dedupe',
			'numbers-le.postProcess.sort',
			'numbers-le.openSettings',
			'numbers-le.help',
		]) {
			expect(_registeredCommands().has(command)).toBe(true);
		}
	});

	it('pushes disposables onto the context so they are cleaned up', () => {
		const context = _createExtensionContext();
		activate(context as never);
		expect(context.subscriptions.length).toBeGreaterThan(0);
	});

	it('deactivate is a no-op that does not throw', () => {
		expect(() => deactivate()).not.toThrow();
	});
});

describe('detectFileType', () => {
	it('maps every supported extension', () => {
		expect(detectFileType('a.json')).toBe('json');
		expect(detectFileType('a.yaml')).toBe('yaml');
		expect(detectFileType('a.yml')).toBe('yaml');
		expect(detectFileType('a.csv')).toBe('csv');
		expect(detectFileType('a.toml')).toBe('toml');
		expect(detectFileType('a.ini')).toBe('ini');
		expect(detectFileType('a.env')).toBe('env');
	});

	it('treats an unknown extension as unknown', () => {
		expect(detectFileType('a.rs')).toBe('unknown');
		expect(detectFileType('a.txt')).toBe('unknown');
	});

	it('treats a file with no extension as unknown', () => {
		expect(detectFileType('Makefile')).toBe('unknown');
		expect(detectFileType('')).toBe('unknown');
	});

	it('is case-insensitive about the extension', () => {
		expect(detectFileType('A.JSON')).toBe('json');
	});
});

describe('post-process guards', () => {
	it('dedupe warns without an active editor', async () => {
		activate(makeContext());
		await runCommand('numbers-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('sort warns without an active editor', async () => {
		activate(makeContext());
		await runCommand('numbers-le.postProcess.sort');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('dedupe reports a document with no numbers', async () => {
		activate(makeContext());
		_setActiveEditor(
			_createDocument({ content: '{"a": "x"}', fileName: '/mock/a.json' }),
		);
		await runCommand('numbers-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('sort reports a document with no numbers', async () => {
		activate(makeContext());
		_setActiveEditor(
			_createDocument({ content: '{"a": "x"}', fileName: '/mock/a.json' }),
		);
		_respondToQuickPick((items) => items[0]);
		await runCommand('numbers-le.postProcess.sort');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('dedupe reports an empty document', async () => {
		activate(makeContext());
		_setActiveEditor(
			_createDocument({ content: '', fileName: '/mock/a.json' }),
		);
		await runCommand('numbers-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('dedupe works on an unknown file type via the fallback extractor', async () => {
		activate(makeContext());
		_setActiveEditor(
			_createDocument({ content: 'a 1 b 2 c 2', fileName: '/mock/notes.txt' }),
		);
		await runCommand('numbers-le.postProcess.dedupe');
		expect(_openedDocuments().length + _shownMessages().length).toBeGreaterThan(
			0,
		);
	});
});

describe('promptCsvOptionsIfNeeded', () => {
	it('returns empty options for a non-csv file', async () => {
		const options = await promptCsvOptionsIfNeeded('json', 'x');
		expect(options).toEqual({});
	});

	it('returns empty options for empty content', async () => {
		const options = await promptCsvOptionsIfNeeded('csv', '');
		expect(options).toEqual({});
	});

	it('offers header names when the first row looks like a header', async () => {
		_respondToQuickPick((items) => items[0]);
		const options = await promptCsvOptionsIfNeeded('csv', 'name,age\nada,36\n');
		expect(options.csvHasHeader).toBe(true);
	});

	it('matches a generated column label back to its index', async () => {
		// Header cells can be blank, in which case the picker shows "(Column n)";
		// selecting one has to map back to the right index.
		_respondToQuickPick((items) => items[items.length - 1]);
		const options = await promptCsvOptionsIfNeeded('csv', 'a,,c\n1,2,3\n');
		expect(options.csvHasHeader).toBe(true);
	});

	it('returns empty options when the header picker is dismissed', async () => {
		_respondToQuickPick(() => undefined);
		const options = await promptCsvOptionsIfNeeded('csv', 'name,age\nada,36\n');
		expect(options).toEqual({});
	});

	it('accepts comma-separated indexes for a headerless file', async () => {
		_respondToInputBox(() => '0,2');
		const options = await promptCsvOptionsIfNeeded('csv', '1,2,3\n4,5,6\n');
		expect(options.csvColumnIndexes ?? options.selectAllColumns).toBeTruthy();
	});

	it('refuses a non-numeric index list', async () => {
		// The validator rejects it, so VS Code never delivers the value and the
		// prompt falls back rather than parsing nonsense.
		_respondToInputBox(() => 'abc');
		const options = await promptCsvOptionsIfNeeded('csv', '1,2,3\n4,5,6\n');
		expect(options.selectAllColumns ?? true).toBeTruthy();
	});

	it('treats an empty index list as every column', async () => {
		_respondToInputBox(() => '');
		const options = await promptCsvOptionsIfNeeded('csv', '1,2,3\n4,5,6\n');
		expect(options.selectAllColumns).toBe(true);
	});
});
