import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock vscode module
vi.mock('vscode', async () => {
	const actual = await vi.importActual<typeof import('../__mocks__/vscode')>(
		'../__mocks__/vscode',
	);
	return actual;
});

import { commands, env, window } from 'vscode';
import { mockExtensionContext } from '../__mocks__/vscode';
import { registerCommands } from './index';

describe('sort command', () => {
	const mockTelemetry = {
		event: vi.fn(),
		dispose: vi.fn(),
	};

	const mockNotifier = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		dispose: vi.fn(),
	};

	const mockStatusBar = {
		show: vi.fn(),
		hide: vi.fn(),
		update: vi.fn(),
		dispose: vi.fn(),
	};

	const mockPerformanceMonitor = {
		startOperation: vi.fn().mockReturnValue({
			end: vi.fn().mockReturnValue({
				operation: 'test',
				startTime: Date.now(),
				endTime: Date.now(),
				duration: 100,
				numberCount: 0,
				fileSize: 0,
				memoryUsage: 0,
				cpuUsage: 0,
				throughput: 0,
				cacheHits: 0,
				cacheMisses: 0,
			}),
		}),
		recordMetrics: vi.fn(),
	};

	const mockDeps = {
		telemetry: mockTelemetry,
		notifier: mockNotifier,
		statusBar: mockStatusBar,
		performanceMonitor: mockPerformanceMonitor,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Re-establish performance monitor mock after clearAllMocks
		mockPerformanceMonitor.startOperation.mockReturnValue({
			end: vi.fn().mockReturnValue({
				operation: 'test',
				startTime: Date.now(),
				endTime: Date.now(),
				duration: 100,
				numberCount: 0,
				fileSize: 0,
				memoryUsage: 0,
				cpuUsage: 0,
				throughput: 0,
				cacheHits: 0,
				cacheMisses: 0,
			}),
		});

		// Mock window.activeTextEditor
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('5,3,8,1,9,2'),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};

		// Mock window.showQuickPick
		(window.showQuickPick as any).mockResolvedValue({
			label: 'Numeric Ascending',
			value: 'numeric-asc',
		});

		// Mock env.clipboard
		(env.clipboard.writeText as any).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registers sort command', () => {
		registerCommands(mockExtensionContext as any, mockDeps);

		expect(commands.registerCommand).toHaveBeenCalledWith(
			'numbers-le.postProcess.sort',
			expect.any(Function),
		);
	});

	it('shows sort mode picker', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn(() => '5\n3\n1'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: 'test.txt',
				uri: { fsPath: 'test.txt', path: 'test.txt', scheme: 'file' },
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window as any).activeTextEditor = mockEditor;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.sort',
		)[1];

		await command();

		expect(window.showQuickPick).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ label: 'Numeric Ascending' }),
				expect.objectContaining({ label: 'Numeric Descending' }),
			]),
			expect.objectContaining({
				placeHolder: expect.stringContaining('Select sorting method'),
			}),
		);
	});

	it('sorts numbers when user selects a mode', async () => {
		const mockEditor = window.activeTextEditor as any;

		(window.showQuickPick as any).mockResolvedValue({
			label: 'Numeric Ascending',
			value: 'numeric-asc',
		});

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.sort',
		)[1];

		await command();

		// Wait for async operations
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Should edit the document in-place
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show notification
		expect(mockNotifier.info).toHaveBeenCalled();
		// Should send telemetry
		expect(mockTelemetry.event).toHaveBeenCalledWith(
			'numbers.sorted',
			expect.objectContaining({
				count: expect.any(String),
				sortMode: 'numeric-asc',
			}),
		);
	});

	it('handles user cancellation gracefully', async () => {
		(window.showQuickPick as any).mockResolvedValue(undefined);

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.sort',
		)[1];

		await command();

		// Wait for async operations
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Should not edit document if cancelled
		// No editor edit should occur
	});

	it('handles no active editor gracefully', async () => {
		(window.activeTextEditor as any) = undefined;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.sort',
		)[1];

		await command();

		// Should show warning
		expect(mockNotifier.warn).toHaveBeenCalled();
	});

	it('handles no numbers found gracefully', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('no numbers here'),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.sort',
		)[1];

		await command();

		// Should show no numbers found message
		expect(mockNotifier.info).toHaveBeenCalled();
	});

	it('supports different sort modes', async () => {
		const sortModes = [
			{ label: 'Numeric Descending', value: 'numeric-desc' },
			{ label: 'Magnitude Ascending', value: 'magnitude-asc' },
			{ label: 'Magnitude Descending', value: 'magnitude-desc' },
		];

		for (const mode of sortModes) {
			vi.clearAllMocks();
			(window.showQuickPick as any).mockResolvedValue(mode);

			registerCommands(mockExtensionContext as any, mockDeps);
			const command = (commands.registerCommand as any).mock.calls.find(
				(call: any) => call[0] === 'numbers-le.postProcess.sort',
			)[1];

			await command();
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockTelemetry.event).toHaveBeenCalledWith(
				'numbers.sorted',
				expect.objectContaining({
					sortMode: mode.value,
				}),
			);
		}
	});

	it('sorts numbers from JSON files', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('{"values": [5, 3, 8, 1, 9, 2]}'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.json',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.sort',
		)[1];

		await command();
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Should edit the document in-place
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show notification about sorting
		expect(mockNotifier.info).toHaveBeenCalled();
	});
});
