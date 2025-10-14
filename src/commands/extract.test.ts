import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock vscode module
vi.mock('vscode', async () => {
	const actual = await vi.importActual<typeof import('../__mocks__/vscode')>(
		'../__mocks__/vscode',
	);
	return actual;
});

import { commands, env, window, workspace } from 'vscode';
import { mockExtensionContext } from '../__mocks__/vscode';
import { registerCommands } from './index';

describe('extract command', () => {
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
		flash: vi.fn(),
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

		// Reset the mock implementations
		mockStatusBar.flash.mockImplementation(() => {});
		mockNotifier.info.mockImplementation(() => {});
		mockNotifier.warn.mockImplementation(() => {});
		mockNotifier.error.mockImplementation(() => {});

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

		// Mock workspace configuration
		(workspace.getConfiguration as any).mockReturnValue({
			get: (key: string, defaultValue: any) => {
				const configs: Record<string, any> = {
					dedupeEnabled: false,
					sortEnabled: false,
					sortMode: 'off',
					analysisEnabled: false,
					postProcessOpenInNewFile: false,
					openResultsSideBySide: false,
				};
				return configs[key] ?? defaultValue;
			},
			update: vi.fn(),
			has: vi.fn(),
		});

		// Mock window.activeTextEditor
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('{"value": 123, "count": 456}'),
				fileName: '/test.json',
				languageId: 'json',
				uri: { fsPath: '/test.json' },
			},
		};

		// Mock env.clipboard
		(env.clipboard.writeText as any).mockResolvedValue(undefined);

		// Mock workspace.openTextDocument
		(workspace.openTextDocument as any).mockResolvedValue({
			lineCount: 1,
		});

		// Mock window.showTextDocument
		(window.showTextDocument as any).mockResolvedValue({
			edit: vi.fn().mockResolvedValue(true),
			document: { lineCount: 1 },
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registers extract command', () => {
		registerCommands(mockExtensionContext as any, mockDeps);

		expect(commands.registerCommand).toHaveBeenCalledWith(
			'numbers-le.extractNumbers',
			expect.any(Function),
		);
	});

	it('extracts numbers from active editor', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('{"value": 123, "count": 456}'),
				fileName: '/test.json',
			},
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.extractNumbers',
		)[1];

		await command();

		// Should open results document
		expect(workspace.openTextDocument).toHaveBeenCalled();
		// Should show status message
		expect(mockStatusBar.flash).toHaveBeenCalled();
	});

	it('handles no active editor gracefully', async () => {
		(window.activeTextEditor as any) = undefined;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.extractNumbers',
		)[1];

		await command();

		// Should show error
		expect(mockNotifier.error).toHaveBeenCalled();
	});

	it('handles empty document gracefully', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue(''),
				fileName: '/test.json',
			},
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.extractNumbers',
		)[1];

		await command();

		// Should show no numbers found message
		expect(mockNotifier.info).toHaveBeenCalled();
	});

	it('extracts numbers from CSV files', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('id,count\n1,100\n2,200\n3,300'),
				fileName: '/test.csv',
			},
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.extractNumbers',
		)[1];

		await command();

		expect(workspace.openTextDocument).toHaveBeenCalled();
		expect(mockStatusBar.flash).toHaveBeenCalled();
	});

	it('extracts numbers from YAML files', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi
					.fn()
					.mockReturnValue('port: 8080\ntimeout: 5000\nworkers: 4'),
				fileName: '/test.yaml',
			},
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.extractNumbers',
		)[1];

		await command();

		expect(workspace.openTextDocument).toHaveBeenCalled();
		expect(mockStatusBar.flash).toHaveBeenCalled();
	});

	it('sends telemetry event on successful extraction', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('{"value": 123}'),
				fileName: '/test.json',
			},
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.extractNumbers',
		)[1];

		await command();

		expect(mockTelemetry.event).toHaveBeenCalledWith(
			'extracted',
			expect.objectContaining({
				type: expect.any(String),
				count: expect.any(String),
			}),
		);
	});
});
