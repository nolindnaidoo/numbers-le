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

describe('dedupe command', () => {
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
				getText: vi.fn().mockReturnValue('1,2,3,2,4,3,5'),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};

		// Mock env.clipboard
		(env.clipboard.writeText as any).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registers dedupe command', () => {
		registerCommands(mockExtensionContext as any, mockDeps);

		expect(commands.registerCommand).toHaveBeenCalledWith(
			'numbers-le.postProcess.dedupe',
			expect.any(Function),
		);
	});

	it('deduplicates numbers in active editor', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,2,4,3,5'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.dedupe',
		)[1];

		await command();

		// Should edit the document in-place
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show deduplication message
		expect(mockNotifier.info).toHaveBeenCalled();
		// Should send telemetry
		expect(mockTelemetry.event).toHaveBeenCalledWith(
			'numbers.deduped',
			expect.objectContaining({
				originalCount: expect.any(String),
				finalCount: expect.any(String),
				duplicatesRemoved: expect.any(String),
			}),
		);
	});

	it('handles no active editor gracefully', async () => {
		(window.activeTextEditor as any) = undefined;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.dedupe',
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
			(call: any) => call[0] === 'numbers-le.postProcess.dedupe',
		)[1];

		await command();

		// Should show no numbers found message
		expect(mockNotifier.info).toHaveBeenCalled();
	});

	it('handles no duplicates gracefully', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5'),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.dedupe',
		)[1];

		await command();

		// Should show no duplicates message
		expect(mockNotifier.info).toHaveBeenCalledWith(
			expect.stringContaining('No duplicate'),
		);
	});

	it('deduplicates numbers from JSON files', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('{"values": [1, 2, 3, 2, 4, 3, 5]}'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.json',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.dedupe',
		)[1];

		await command();

		// Should edit the document in-place
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show deduplication message
		expect(mockNotifier.info).toHaveBeenCalled();
	});

	it('includes original and final counts in notification', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,1,1,2,2,3'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.dedupe',
		)[1];

		await command();

		// Should edit the document in-place
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show notification with counts
		expect(mockNotifier.info).toHaveBeenCalledWith(
			expect.stringContaining('duplicate'),
		);
		// Should send telemetry with counts
		expect(mockTelemetry.event).toHaveBeenCalledWith(
			'numbers.deduped',
			expect.objectContaining({
				originalCount: expect.any(String),
				finalCount: expect.any(String),
				duplicatesRemoved: expect.any(String),
			}),
		);
	});
});
