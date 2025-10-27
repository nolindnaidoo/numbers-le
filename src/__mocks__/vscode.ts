import { vi } from 'vitest';

export const Uri = {
	file: vi.fn((path: string) => ({
		fsPath: path,
		path,
		scheme: 'file',
		toString: () => `file://${path}`,
	})),
	parse: vi.fn((str: string) => ({
		fsPath: str.replace('file://', ''),
		path: str.replace('file://', ''),
		scheme: 'file',
		toString: () => str,
	})),
};

// Make workspace.getConfiguration a writable mock
const workspaceObj: Record<string, unknown> = {
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
		update: vi.fn(),
		has: vi.fn(),
	})),
	openTextDocument: vi.fn(),
	applyEdit: vi.fn(),
	createFileSystemWatcher: vi.fn(() => ({
		onDidCreate: vi.fn(),
		onDidDelete: vi.fn(),
		onDidChange: vi.fn(),
		dispose: vi.fn(),
	})),
	workspaceFolders: [
		{
			uri: Uri.file('/root/folder'),
			name: 'test-workspace',
			index: 0,
		},
	],
	onDidChangeConfiguration: vi.fn(() => ({
		dispose: vi.fn(),
	})),
};
export const workspace = workspaceObj;

// Create a mock editor with edit method
export const createMockEditor = (text: string, fileName = 'test.txt') => ({
	document: {
		getText: vi.fn(() => text),
		positionAt: vi.fn((offset: number) => ({
			line: 0,
			character: offset,
		})),
		fileName,
		uri: Uri.file(fileName),
	},
	edit: vi.fn((callback: any) => {
		const editBuilder = {
			replace: vi.fn(),
			insert: vi.fn(),
			delete: vi.fn(),
		};
		callback(editBuilder);
		return Promise.resolve(true);
	}),
});

// Use Object.defineProperty to make window properties writable
const windowObj: Record<string, unknown> = {};
Object.defineProperty(windowObj, 'activeTextEditor', {
	value: undefined,
	writable: true,
	configurable: true,
});
Object.assign(windowObj, {
	showInformationMessage: vi.fn(),
	showWarningMessage: vi.fn(),
	showErrorMessage: vi.fn(),
	showQuickPick: vi.fn().mockResolvedValue(undefined),
	showTextDocument: vi.fn(),
	withProgress: vi.fn((_options, task) => task({}, CancellationToken.None)),
	setStatusBarMessage: vi.fn(),
	createStatusBarItem: vi.fn(() => ({
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
		text: '',
		tooltip: '',
		command: undefined,
	})),
	createOutputChannel: vi.fn(() => ({
		appendLine: vi.fn(),
		show: vi.fn(),
		clear: vi.fn(),
		dispose: vi.fn(),
	})),
});
export const window = windowObj;

export const commands = {
	registerCommand: vi.fn(),
	executeCommand: vi.fn(),
};

export const ViewColumn = {
	One: 1,
	Two: 2,
	Three: 3,
	Active: -1,
	Beside: -2,
};

export const StatusBarAlignment = {
	Left: 1,
	Right: 2,
};

export const ProgressLocation = {
	SourceControl: 1,
	Window: 10,
	Notification: 15,
};

export const env = {
	clipboard: {
		writeText: vi.fn(),
		readText: vi.fn(),
	},
};

export const CancellationToken = {
	None: {
		isCancellationRequested: false,
		onCancellationRequested: vi.fn(),
	},
};

export const Range = vi.fn(
	(startLine: number, startChar: number, endLine: number, endChar: number) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	}),
);

export const Position = {
	create: vi.fn(),
};

export const WorkspaceEdit = vi.fn(() => ({
	replace: vi.fn(),
	insert: vi.fn(),
	delete: vi.fn(),
}));

export const TextEdit = {
	replace: vi.fn(),
	insert: vi.fn(),
	delete: vi.fn(),
};

// Mock extension context
export const mockExtensionContext = {
	subscriptions: [],
	workspaceState: {
		get: vi.fn(),
		update: vi.fn(),
	},
	globalState: {
		get: vi.fn(),
		update: vi.fn(),
		setKeysForSync: vi.fn(),
	},
	extensionPath: '/mock/extension/path',
	extensionUri: Uri.file('/mock/extension/path'),
	asAbsolutePath: vi.fn(
		(relativePath: string) => `/mock/extension/path/${relativePath}`,
	),
	storagePath: '/mock/storage/path',
	globalStoragePath: '/mock/global/storage/path',
	logPath: '/mock/log/path',
	extensionMode: 3,
};
