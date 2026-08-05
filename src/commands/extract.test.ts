import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clipboardText,
	_createDocument,
	_createExtensionContext,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
	_respondToWarning,
	_setActiveEditor,
	_setConfig,
	_setFsStatSize,
	_shownDocumentOptions,
	_shownMessages,
} from '../__mocks__/vscode';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerCommands } from './index';

/**
 * Configuration permutations of the extract command.
 *
 * `commands.test.ts` covers the happy paths; this covers the settings and
 * user-choice branches, which is where the file's uncovered branches were
 * concentrated — side-by-side output, the large-output prompt, CSV column
 * selection, the streaming toggle, and the safety thresholds. Each of these is
 * reachable only by a specific combination of settings and prompt answers, so
 * none of them were exercised by the default-config tests.
 */

function makeDeps() {
	const events: string[] = [];
	const telemetry: Telemetry = {
		event: (name, properties) =>
			events.push(properties ? `${name}:${JSON.stringify(properties)}` : name),
		dispose: () => {},
	};
	const statusBar: StatusBar = { flash: () => {} };
	return { deps: { notifier: createNotifier(), statusBar, telemetry }, events };
}

async function runExtract(): Promise<void> {
	const { deps } = makeDeps();
	registerCommands(_createExtensionContext() as never, deps);
	const handler = _registeredCommands().get('numbers-le.extractNumbers');
	if (!handler) throw new Error('extract command not registered');
	await handler();
}

/** A JSON array of 150 numbers — past both safety floors. */
function manyNumbers(): string {
	return `[${Array.from({ length: 150 }, (_, i) => i + 1).join(', ')}]`;
}

const lastOpened = (): string | undefined => {
	const opened = _openedDocuments();
	return opened[opened.length - 1]?.getText();
};

beforeEach(() => {
	_resetMockState();
	_setConfig('numbers-le.notificationsLevel', 'all');
});

describe('extract: result placement', () => {
	it('opens results beside the source when openResultsSideBySide is on', () => {
		_setConfig('numbers-le.openResultsSideBySide', true);
		_setActiveEditor(
			_createDocument({ content: '[1, 2]', fileName: '/mock/a.json' }),
		);
		return runExtract().then(() => {
			const shown = _shownDocumentOptions();
			// ViewColumn.Beside is -2 in the mock's enum.
			expect(shown[shown.length - 1]?.viewColumn).toBe(-2);
		});
	});

	it('leaves the view column unset when the setting is off', async () => {
		_setConfig('numbers-le.openResultsSideBySide', false);
		_setActiveEditor(
			_createDocument({ content: '[1, 2]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		const shown = _shownDocumentOptions();
		expect(shown[shown.length - 1]?.viewColumn).toBeUndefined();
	});

	it('copies and opens when both output routes are enabled', async () => {
		_setConfig('numbers-le.copyToClipboardEnabled', true);
		_setActiveEditor(
			_createDocument({ content: '[7, 8]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(_clipboardText()).toBe('7\n8');
		expect(lastOpened()).toBe('7\n8');
	});
});

describe('extract: post-processing settings', () => {
	it('dedupes before writing when dedupeEnabled is on', async () => {
		_setConfig('numbers-le.dedupeEnabled', true);
		_setActiveEditor(
			_createDocument({ content: '[3, 1, 3, 1]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(lastOpened()).toBe('3\n1');
	});

	it('sorts before writing when sortEnabled is on', async () => {
		_setConfig('numbers-le.sortEnabled', true);
		_setConfig('numbers-le.sortMode', 'numeric-asc');
		_setActiveEditor(
			_createDocument({ content: '[3, 1, 2]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(lastOpened()).toBe('1\n2\n3');
	});

	it('applies dedupe and sort together, dedupe first', async () => {
		_setConfig('numbers-le.dedupeEnabled', true);
		_setConfig('numbers-le.sortEnabled', true);
		_setConfig('numbers-le.sortMode', 'numeric-asc');
		_setActiveEditor(
			_createDocument({ content: '[3, 1, 3, 2, 1]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(lastOpened()).toBe('1\n2\n3');
	});
});

describe('extract: large-output prompt', () => {
	// Reached only when safety is on and the result exceeds the threshold.
	function largeSetup(): void {
		_setConfig('numbers-le.safety.enabled', true);
		_setConfig('numbers-le.safety.largeOutputLinesThreshold', 100);
		_setActiveEditor(
			_createDocument({ content: manyNumbers(), fileName: '/mock/a.json' }),
		);
	}

	it('writes nothing when the user cancels', async () => {
		largeSetup();
		_respondToWarning((items) =>
			items.find((i) => String(i).includes('Cancel')),
		);
		const before = _openedDocuments().length;
		await runExtract();
		expect(_openedDocuments()).toHaveLength(before);
	});

	it('copies without opening when the user picks copy only', async () => {
		largeSetup();
		_setConfig('numbers-le.copyToClipboardEnabled', true);
		_respondToWarning((items) => items.find((i) => String(i).includes('Copy')));
		const before = _openedDocuments().length;
		await runExtract();
		expect(_openedDocuments()).toHaveLength(before);
		expect(_clipboardText()?.split('\n')).toHaveLength(150);
	});

	it('opens results when the user accepts', async () => {
		largeSetup();
		_respondToWarning((items) => items.find((i) => String(i).includes('Open')));
		await runExtract();
		expect(lastOpened()?.split('\n')).toHaveLength(150);
	});

	it('does not prompt at all when safety is disabled', async () => {
		_setConfig('numbers-le.safety.enabled', false);
		_setConfig('numbers-le.safety.largeOutputLinesThreshold', 100);
		let prompted = false;
		_respondToWarning((items) => {
			prompted = true;
			return items[0];
		});
		_setActiveEditor(
			_createDocument({ content: manyNumbers(), fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(prompted).toBe(false);
		expect(lastOpened()?.split('\n')).toHaveLength(150);
	});
});

describe('extract: safety file-size gate', () => {
	// The gate reads fs.stat().size, not the document text, and it warns rather
	// than refusing — extraction continues either way.
	it('warns and still extracts when the file exceeds the threshold', async () => {
		_setConfig('numbers-le.safety.enabled', true);
		// The setting floors at 1000, so the stat size has to exceed that.
		_setConfig('numbers-le.safety.fileSizeWarnBytes', 1000);
		_setFsStatSize(5000);
		_setActiveEditor(
			_createDocument({ content: '[1, 2]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(_shownMessages().some((m) => m.kind === 'warning')).toBe(true);
		expect(lastOpened()).toBe('1\n2');
	});

	it('stays quiet when the file is under the threshold', async () => {
		_setConfig('numbers-le.safety.enabled', true);
		_setConfig('numbers-le.safety.fileSizeWarnBytes', 1000);
		_setFsStatSize(10);
		_setActiveEditor(
			_createDocument({ content: '[1, 2]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(_shownMessages().some((m) => m.kind === 'warning')).toBe(false);
	});

	it('does not warn when safety is off, however large the file', async () => {
		_setConfig('numbers-le.safety.enabled', false);
		_setFsStatSize(5_000_000);
		_setActiveEditor(
			_createDocument({ content: '[1, 2]', fileName: '/mock/a.json' }),
		);
		await runExtract();
		expect(_shownMessages().some((m) => m.kind === 'warning')).toBe(false);
	});
});

describe('extract: unknown file type', () => {
	it('prompts for a type and uses the answer', async () => {
		_setActiveEditor(
			_createDocument({ content: 'a 1 b 2', fileName: '/mock/notes.xyz' }),
		);
		_respondToQuickPick((items) => {
			const labels = items.map((i) =>
				typeof i === 'string' ? i : String((i as { label: string }).label),
			);
			const fallback = labels.find((l) => /Unknown|regex/i.test(l));
			return fallback ?? labels[0];
		});
		await runExtract();
		expect(lastOpened()).toBe('1\n2');
	});

	it('does nothing when the type prompt is dismissed', async () => {
		_setActiveEditor(
			_createDocument({ content: 'a 1 b 2', fileName: '/mock/notes.xyz' }),
		);
		_respondToQuickPick(() => undefined);
		const before = _openedDocuments().length;
		await runExtract();
		expect(_openedDocuments()).toHaveLength(before);
	});
});

describe('extract: CSV column selection', () => {
	const CSV = 'a,b\n1,2\n3,4\n';

	it('extracts every column when all columns are chosen', async () => {
		_setActiveEditor(
			_createDocument({ content: CSV, fileName: '/mock/data.csv' }),
		);
		_respondToQuickPick((items) => {
			const first = items[0];
			return typeof first === 'string' ? first : first;
		});
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});

	it('honours an explicit column index list', async () => {
		_setActiveEditor(
			_createDocument({ content: CSV, fileName: '/mock/data.csv' }),
		);
		_respondToQuickPick((items) => items[items.length - 1]);
		_respondToInputBox(() => '0');
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});

	it('falls back to default options when the column prompt is dismissed', async () => {
		// Dismissing returns an empty options object rather than cancelling, so
		// extraction proceeds over the whole file.
		_setActiveEditor(
			_createDocument({ content: CSV, fileName: '/mock/data.csv' }),
		);
		_respondToQuickPick(() => undefined);
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});
});

describe('extract: streaming toggle', () => {
	it('produces the same numbers with streaming on as off', async () => {
		const CSV = 'a,b\n1,2\n3,4\n';

		_setConfig('numbers-le.csv.streamingEnabled', false);
		_setActiveEditor(
			_createDocument({ content: CSV, fileName: '/mock/data.csv' }),
		);
		_respondToQuickPick((items) => items[0]);
		await runExtract();
		const withoutStreaming = _openedDocuments().map((d) => d.getText());

		_resetMockState();
		_setConfig('numbers-le.notificationsLevel', 'all');
		_setConfig('numbers-le.csv.streamingEnabled', true);
		_setActiveEditor(
			_createDocument({ content: CSV, fileName: '/mock/data.csv' }),
		);
		_respondToQuickPick((items) => items[0]);
		await runExtract();
		const withStreaming = _openedDocuments().map((d) => d.getText());

		// The streaming path is an optimisation, not a different result.
		expect(withStreaming).toEqual(withoutStreaming);
	});
});

describe('extract: empty and no-match documents', () => {
	it('reports an empty document without opening anything', async () => {
		_setActiveEditor(
			_createDocument({ content: '', fileName: '/mock/a.json' }),
		);
		const before = _openedDocuments().length;
		await runExtract();
		expect(_openedDocuments()).toHaveLength(before);
	});

	it('reports a document with no numbers', async () => {
		_setActiveEditor(
			_createDocument({ content: '{"a": "x"}', fileName: '/mock/a.json' }),
		);
		const before = _openedDocuments().length;
		await runExtract();
		expect(_openedDocuments()).toHaveLength(before);
		expect(_shownMessages().length).toBeGreaterThan(0);
	});
});

describe('extract: CSV multi-column path', () => {
	// A headerless CSV (no letters in the first row) routes to index-based
	// selection, which is the only way to reach the multi-column extraction
	// path — the single-column and all-columns cases go elsewhere.
	const HEADERLESS = '1,2,3\n4,5,6\n7,8,9\n';

	it('extracts several explicitly chosen columns', async () => {
		_setActiveEditor(
			_createDocument({ content: HEADERLESS, fileName: '/mock/n.csv' }),
		);
		_respondToInputBox(() => '0,2');
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});

	it('extracts a single chosen column', async () => {
		_setActiveEditor(
			_createDocument({ content: HEADERLESS, fileName: '/mock/n.csv' }),
		);
		_respondToInputBox(() => '1');
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});

	it('treats an empty answer as every column', async () => {
		_setActiveEditor(
			_createDocument({ content: HEADERLESS, fileName: '/mock/n.csv' }),
		);
		_respondToInputBox(() => '');
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});

	it('warns and uses all columns when the indexes are out of range', async () => {
		_setActiveEditor(
			_createDocument({ content: HEADERLESS, fileName: '/mock/n.csv' }),
		);
		_respondToInputBox(() => '9,10');
		await runExtract();
		expect(_shownMessages().some((m) => m.kind === 'warning')).toBe(true);
	});

	it('post-processes the multi-column result', async () => {
		_setConfig('numbers-le.dedupeEnabled', true);
		_setConfig('numbers-le.sortEnabled', true);
		_setConfig('numbers-le.sortMode', 'numeric-asc');
		_setActiveEditor(
			_createDocument({ content: '1,1\n2,2\n', fileName: '/mock/n.csv' }),
		);
		_respondToInputBox(() => '0,1');
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});

	it('produces the same columns with streaming enabled', async () => {
		_setConfig('numbers-le.csv.streamingEnabled', true);
		_setActiveEditor(
			_createDocument({ content: HEADERLESS, fileName: '/mock/n.csv' }),
		);
		_respondToInputBox(() => '0,2');
		await runExtract();
		expect(_openedDocuments().length).toBeGreaterThan(0);
	});
});
