import { beforeEach, describe, expect, it } from 'vitest';
import {
	_activeEditor,
	_clipboardText,
	_createDocument,
	_createExtensionContext,
	_getConfigUpdates,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_shownMessages,
	executedBuiltins,
} from '../__mocks__/vscode';
import { registerOpenSettingsCommand } from '../config/settings';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerHelpCommand } from './help';
import { registerCommands } from './index';

function makeDeps() {
	const events: string[] = [];
	const flashes: string[] = [];
	const telemetry: Telemetry = {
		event: (name, properties) =>
			events.push(properties ? `${name}:${JSON.stringify(properties)}` : name),
		dispose: () => {},
	};
	const statusBar: StatusBar = { flash: (text) => flashes.push(text) };
	return {
		deps: { notifier: createNotifier(), statusBar, telemetry },
		events,
		flashes,
	};
}

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
});

describe('numbers-le.extractNumbers', () => {
	it('errors when no editor is active', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		await runCommand('numbers-le.extractNumbers');
		expect(_shownMessages()[0]?.kind).toBe('error');
		expect(_shownMessages()[0]?.message).toBe('No active editor');
	});

	it('extracts JSON numbers into a new document', async () => {
		const { deps, events } = makeDeps();
		registerCommands(makeContext(), deps);
		_setActiveEditor(
			_createDocument({
				content: '{"a": 1, "b": [2.5, -3], "s": "42"}',
				fileName: '/mock/data.json',
			}),
		);
		await runCommand('numbers-le.extractNumbers');

		const opened = _openedDocuments();
		expect(opened[opened.length - 1]?.getText()).toBe('1\n2.5\n-3');
		expect(events.some((e) => e.startsWith('extracted'))).toBe(true);
	});

	it('copies to the clipboard when configured', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setConfig('numbers-le.copyToClipboardEnabled', true);
		_setActiveEditor(
			_createDocument({ content: '[1, 2, 3]', fileName: '/mock/data.json' }),
		);
		await runCommand('numbers-le.extractNumbers');
		expect(_clipboardText()).toBe('1\n2\n3');
	});

	it('surfaces parse errors only when showParseErrors is on', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setActiveEditor(
			_createDocument({ content: '{invalid', fileName: '/mock/data.json' }),
		);
		await runCommand('numbers-le.extractNumbers');
		expect(_shownMessages()).toHaveLength(0);

		_setConfig('numbers-le.showParseErrors', true);
		await runCommand('numbers-le.extractNumbers');
		expect(_shownMessages()[0]?.kind).toBe('error');
		expect(_shownMessages()[0]?.message).toContain('Failed to parse JSON');
	});

	it('reports an empty file as info at level all', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setConfig('numbers-le.notificationsLevel', 'all');
		_setActiveEditor(
			_createDocument({ content: '   ', fileName: '/mock/data.json' }),
		);
		await runCommand('numbers-le.extractNumbers');
		expect(_shownMessages()[0]?.message).toBe('File is empty');
	});

	it('fans out CSV columns into one document per column', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_respondToQuickPick((items) => (items as string[])[0]); // 'All columns'
		_setActiveEditor(
			_createDocument({
				content: 'price,qty\n1.5,2\n3.5,4\n',
				fileName: '/mock/data.csv',
			}),
		);
		await runCommand('numbers-le.extractNumbers');

		const contents = _openedDocuments().map((d) => d.getText());
		expect(contents).toContain('1.5\n3.5');
		expect(contents).toContain('2\n4');
	});
});

describe('numbers-le.postProcess.dedupe', () => {
	it('writes deduped numbers to a new document by default', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: '1\n2\n1\n3\n2' }));
		await runCommand('numbers-le.postProcess.dedupe');

		const opened = _openedDocuments();
		expect(opened[opened.length - 1]?.getText()).toBe('1\n2\n3');
	});

	it('replaces in place when postProcess.openInNewFile is off', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setConfig('numbers-le.postProcess.openInNewFile', false);
		const doc = _createDocument({ content: '5\n5\n6' });
		_setActiveEditor(doc);
		await runCommand('numbers-le.postProcess.dedupe');

		expect(_activeEditor()?._edits[0]?.text).toBe('5\n6');
		expect(doc.getText()).toBe('5\n6');
	});

	it('reports when there are no duplicates', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setConfig('numbers-le.notificationsLevel', 'all');
		_setActiveEditor(_createDocument({ content: '1\n2\n3' }));
		await runCommand('numbers-le.postProcess.dedupe');
		expect(_shownMessages()[0]?.message).toBe('No duplicate numbers found');
		expect(_openedDocuments()).toHaveLength(0);
	});
});

describe('numbers-le.postProcess.sort', () => {
	it('sorts numerically ascending via quick pick into a new document', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setActiveEditor(_createDocument({ content: '3\n1\n2' }));
		_respondToQuickPick((items) =>
			(items as Array<{ value: string }>).find(
				(item) => item.value === 'numeric-asc',
			),
		);
		await runCommand('numbers-le.postProcess.sort');

		const opened = _openedDocuments();
		expect(opened[opened.length - 1]?.getText()).toBe('1\n2\n3');
	});

	it('sorts by magnitude descending in place', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		_setConfig('numbers-le.postProcess.openInNewFile', false);
		const doc = _createDocument({ content: '-20\n3\n-10' });
		_setActiveEditor(doc);
		_respondToQuickPick((items) =>
			(items as Array<{ value: string }>).find(
				(item) => item.value === 'magnitude-desc',
			),
		);
		await runCommand('numbers-le.postProcess.sort');
		expect(doc.getText()).toBe('-20\n-10\n3');
	});

	it('does nothing when the quick pick is dismissed', async () => {
		const { deps } = makeDeps();
		registerCommands(makeContext(), deps);
		const doc = _createDocument({ content: '2\n1' });
		_setActiveEditor(doc);
		_respondToQuickPick(() => undefined);
		await runCommand('numbers-le.postProcess.sort');
		expect(doc.getText()).toBe('2\n1');
		expect(_openedDocuments()).toHaveLength(0);
	});
});

describe('numbers-le.csv.toggleStreaming', () => {
	it('flips csv.streamingEnabled at the global scope', async () => {
		const { deps, flashes } = makeDeps();
		registerCommands(makeContext(), deps);
		await runCommand('numbers-le.csv.toggleStreaming');
		expect(_getConfigUpdates()[0]).toMatchObject({
			key: 'numbers-le.csv.streamingEnabled',
			value: true,
		});
		expect(flashes[0]).toBe('CSV streaming on');

		await runCommand('numbers-le.csv.toggleStreaming');
		expect(_getConfigUpdates()[1]?.value).toBe(false);
		expect(flashes[1]).toBe('CSV streaming off');
	});
});

describe('numbers-le.openSettings', () => {
	it('opens the settings UI filtered to the extension prefix', async () => {
		const { deps } = makeDeps();
		registerOpenSettingsCommand(makeContext(), deps.telemetry);
		await runCommand('numbers-le.openSettings');
		expect(executedBuiltins[0]).toMatchObject({
			id: 'workbench.action.openSettings',
			args: ['numbers-le.'],
		});
	});
});

describe('numbers-le.help', () => {
	it('documents only commands that exist', async () => {
		const { deps } = makeDeps();
		registerHelpCommand(makeContext(), deps.telemetry);
		await runCommand('numbers-le.help');

		const opened = _openedDocuments();
		const help = opened[opened.length - 1]?.getText() ?? '';
		expect(help).toContain('# Numbers-LE Help & Documentation');
		expect(help).toContain('Toggle CSV Streaming');
		expect(help).not.toContain('Post-Process: Analyze');
		expect(help).not.toContain('OffensiveEdge');
	});
});
